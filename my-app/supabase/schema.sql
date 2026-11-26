create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  description text not null default '',
  category text not null default 'General',
  price numeric(10, 2) not null check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users (id) on delete cascade,
  total numeric(10, 2) not null check (total >= 0),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10, 2) not null check (unit_price >= 0)
);

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

insert into public.profiles (user_id, full_name)
select
  id,
  coalesce(raw_user_meta_data ->> 'full_name', '')
from auth.users
on conflict (user_id) do nothing;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = (select auth.uid())
      and role = 'admin'
  );
$$;

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, update on public.orders to authenticated;
grant select on public.order_items to authenticated;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "Customers and admins can read available products" on public.products;
create policy "Customers and admins can read available products"
  on public.products for select to authenticated
  using (active or (select public.is_admin()));

drop policy if exists "Admins can manage products" on public.products;
create policy "Admins can manage products"
  on public.products for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Customers can read their own orders" on public.orders;
create policy "Customers can read their own orders"
  on public.orders for select to authenticated
  using (customer_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "Admins can update orders" on public.orders;
create policy "Admins can update orders"
  on public.orders for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Customers and admins can read order items" on public.order_items;
create policy "Customers and admins can read order items"
  on public.order_items for select to authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1
      from public.orders
      where orders.id = order_items.order_id
        and orders.customer_id = (select auth.uid())
    )
  );

create or replace function public.place_order(items jsonb)
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

  insert into public.orders (customer_id, total)
  values (current_user_id, order_total)
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

revoke all on function public.place_order(jsonb) from public;
grant execute on function public.place_order(jsonb) to authenticated;
