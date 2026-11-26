-- ============================================================
-- Sukimart admin dashboard
-- Run this ENTIRE file in Supabase -> SQL Editor -> Run.
-- Safe to run more than once.
-- ============================================================

-- ============================================================
-- 1. Extend the existing tables (no data is removed)
-- ============================================================

alter table public.profiles
  add column if not exists email text not null default '';

alter table public.orders
  add column if not exists delivery_address text not null default '',
  add column if not exists payment_method text not null default 'Cash on Delivery',
  add column if not exists updated_at timestamptz not null default now();

-- Move the old statuses onto the new workflow.
alter table public.orders drop constraint if exists orders_status_check;
update public.orders set status = 'new' where status = 'pending';
update public.orders set status = 'preparing' where status = 'processing';
alter table public.orders
  add constraint orders_status_check
  check (status in ('new', 'preparing', 'on_the_way', 'completed', 'cancelled'));

-- Let PostgREST join orders to the customer profile in one request.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'orders_customer_profile_fkey'
  ) then
    alter table public.orders
      add constraint orders_customer_profile_fkey
      foreign key (customer_id) references public.profiles (user_id);
  end if;
exception
  when foreign_key_violation then
    raise notice 'Skipped profile foreign key: some orders have no matching profile.';
end;
$$;

-- ============================================================
-- 2. New tables: categories, status history, notifications
-- ============================================================

create table if not exists public.categories (
  name text primary key,
  created_at timestamptz not null default now()
);

create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  status text not null,
  note text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  order_id uuid references public.orders (id) on delete cascade,
  title text not null,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists order_status_history_order_idx
  on public.order_status_history (order_id, created_at);
create index if not exists notifications_user_idx
  on public.notifications (user_id, read, created_at desc);

-- ============================================================
-- 3. Keep profile rows in sync with auth users (name + email)
-- ============================================================

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, '')
  )
  on conflict (user_id) do update
    set email = excluded.email,
        full_name = case
          when public.profiles.full_name = '' then excluded.full_name
          else public.profiles.full_name
        end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

-- Backfill email addresses for accounts that already exist.
update public.profiles as p
set email = coalesce(u.email, '')
from auth.users as u
where u.id = p.user_id
  and p.email = '';

-- ============================================================
-- 4. Categories: every product category becomes a filter option
-- ============================================================

create or replace function public.ensure_product_category()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if btrim(new.category) <> '' then
    insert into public.categories (name)
    values (btrim(new.category))
    on conflict (name) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_product_category on public.products;
create trigger on_product_category
  after insert or update of category on public.products
  for each row execute function public.ensure_product_category();

insert into public.categories (name)
select distinct btrim(category)
from public.products
where btrim(category) <> ''
on conflict (name) do nothing;

-- ============================================================
-- 5. Order status workflow + automatic customer notifications
-- ============================================================

create or replace function public.order_status_label(p_status text)
returns text
language sql
immutable
as $$
  select case p_status
    when 'new' then 'New order'
    when 'preparing' then 'Preparing'
    when 'on_the_way' then 'On the way'
    when 'completed' then 'Completed'
    when 'cancelled' then 'Cancelled'
    else initcap(replace(p_status, '_', ' '))
  end;
$$;

-- Initial history entry + "order received" notification.
create or replace function public.handle_new_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := upper(substr(replace(new.id::text, '-', ''), 1, 8));
begin
  insert into public.order_status_history (order_id, status, note, created_by)
  values (new.id, new.status, 'Order placed by the customer.', new.customer_id);

  insert into public.notifications (user_id, order_id, title, message)
  values (
    new.customer_id,
    new.id,
    'Order received',
    'We received order #' || v_code || '. We will let you know as soon as it is being prepared.'
  );

  return new;
end;
$$;

drop trigger if exists on_order_created on public.orders;
create trigger on_order_created
  after insert on public.orders
  for each row execute function public.handle_new_order();

-- Every status change writes history, notifies the customer, and stamps updated_at.
create or replace function public.handle_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := upper(substr(replace(new.id::text, '-', ''), 1, 8));
  v_title text;
  v_message text;
begin
  new.updated_at := now();

  if new.status is not distinct from old.status then
    return new;
  end if;

  case new.status
    when 'preparing' then
      v_title := 'Your order is being prepared';
      v_message := 'Order #' || v_code || ' is being packed and will be out for delivery soon.';
    when 'on_the_way' then
      v_title := 'Your order is on the way';
      v_message := 'Order #' || v_code || ' is out for delivery. Please keep your phone nearby.';
    when 'completed' then
      v_title := 'Order delivered';
      v_message := 'Order #' || v_code || ' has been delivered. Thank you for shopping at Sukimart!';
    when 'cancelled' then
      v_title := 'Order cancelled';
      v_message := 'Order #' || v_code || ' was cancelled. Contact the store if you need help.';
    else
      v_title := 'Order updated';
      v_message := 'Order #' || v_code || ' is now ' || public.order_status_label(new.status) || '.';
  end case;

  insert into public.order_status_history (order_id, status, note, created_by)
  values (new.id, new.status, null, auth.uid());

  insert into public.notifications (user_id, order_id, title, message)
  values (new.customer_id, new.id, v_title, v_message);

  return new;
end;
$$;

drop trigger if exists on_order_status_change on public.orders;
create trigger on_order_status_change
  before update on public.orders
  for each row execute function public.handle_order_status_change();

-- Only valid transitions are allowed. The trigger above handles the rest.
create or replace function public.update_order_status(
  p_order_id uuid,
  p_status text
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_allowed boolean := false;
begin
  if not public.is_admin() then
    raise exception 'Only administrators can update order status.';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found.';
  end if;

  v_allowed := case v_order.status
    when 'new' then p_status in ('preparing', 'cancelled')
    when 'preparing' then p_status in ('on_the_way', 'cancelled')
    when 'on_the_way' then p_status = 'completed'
    else false
  end;

  if not v_allowed then
    raise exception 'An order cannot move from "%" to "%".',
      public.order_status_label(v_order.status),
      public.order_status_label(p_status);
  end if;

  update public.orders
  set status = p_status
  where id = p_order_id;

  select * into v_order
  from public.orders
  where id = p_order_id;

  return v_order;
end;
$$;

revoke all on function public.update_order_status(uuid, text) from public;
grant execute on function public.update_order_status(uuid, text) to authenticated;

-- ============================================================
-- 6. Order placement now stores delivery details
-- ============================================================

drop function if exists public.place_order(jsonb);

create or replace function public.place_order(
  items jsonb,
  p_delivery_address text default '',
  p_payment_method text default 'Cash on Delivery'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  order_id uuid;
  order_total numeric(10, 2) := 0;
  item record;
  selected_product public.products%rowtype;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to place an order.';
  end if;

  if items is null
    or jsonb_typeof(items) <> 'array'
    or jsonb_array_length(items) = 0 then
    raise exception 'Add at least one product to your order.';
  end if;

  for item in
    select submitted.product_id, sum(submitted.quantity)::integer as quantity
    from jsonb_to_recordset(items) as submitted(product_id uuid, quantity integer)
    group by submitted.product_id
    order by submitted.product_id
  loop
    if item.product_id is null or item.quantity is null or item.quantity <= 0 then
      raise exception 'Order items must have a product and a positive quantity.';
    end if;

    select *
    into selected_product
    from public.products
    where id = item.product_id
      and active
    for update;

    if not found then
      raise exception 'A product in your order is no longer available.';
    end if;

    if selected_product.stock < item.quantity then
      raise exception 'Not enough stock for "%".', selected_product.name;
    end if;

    update public.products
    set stock = stock - item.quantity,
        updated_at = now()
    where id = selected_product.id;

    order_total := order_total + selected_product.price * item.quantity;
  end loop;

  insert into public.orders (
    customer_id,
    total,
    status,
    delivery_address,
    payment_method
  )
  values (
    current_user_id,
    order_total,
    'new',
    coalesce(nullif(btrim(p_delivery_address), ''), 'Pickup at store'),
    coalesce(nullif(btrim(p_payment_method), ''), 'Cash on Delivery')
  )
  returning id into order_id;

  insert into public.order_items (
    order_id,
    product_id,
    product_name,
    quantity,
    unit_price
  )
  select
    order_id,
    product.id,
    product.name,
    submitted.quantity,
    product.price
  from (
    select
      line.product_id,
      sum(line.quantity)::integer as quantity
    from jsonb_to_recordset(items) as line(product_id uuid, quantity integer)
    group by line.product_id
  ) as submitted
  join public.products as product on product.id = submitted.product_id;

  return order_id;
end;
$$;

revoke all on function public.place_order(jsonb, text, text) from public;
grant execute on function public.place_order(jsonb, text, text) to authenticated;

-- ============================================================
-- 7. Row level security for the new tables
-- ============================================================

alter table public.categories enable row level security;
alter table public.order_status_history enable row level security;
alter table public.notifications enable row level security;

grant select, insert, update, delete on public.categories to authenticated;
grant select on public.order_status_history to authenticated;
grant select, update on public.notifications to authenticated;

drop policy if exists "Everyone can read categories" on public.categories;
create policy "Everyone can read categories"
  on public.categories for select to authenticated
  using (true);

drop policy if exists "Admins manage categories" on public.categories;
create policy "Admins manage categories"
  on public.categories for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Customers and admins read order history" on public.order_status_history;
create policy "Customers and admins read order history"
  on public.order_status_history for select to authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1 from public.orders
      where orders.id = order_status_history.order_id
        and orders.customer_id = (select auth.uid())
    )
  );

drop policy if exists "Customers read their notifications" on public.notifications;
create policy "Customers read their notifications"
  on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Customers mark their notifications read" on public.notifications;
create policy "Customers mark their notifications read"
  on public.notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ============================================================
-- 8. Verify
-- ============================================================

select
  (select count(*) from public.products) as products,
  (select count(*) from public.orders) as orders,
  (select count(*) from public.categories) as categories,
  (select count(*) from public.notifications) as notifications,
  (select count(*) from public.profiles where role = 'admin') as admins;
