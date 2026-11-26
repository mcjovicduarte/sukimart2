-- Run after admin-dashboard.sql. This migration does not create an Auth user.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('customer','admin','delivery'));
alter table public.orders add column if not exists delivery_man_id uuid references public.profiles(user_id);
alter table public.orders add column if not exists delivery_status text not null default 'pending' check (delivery_status in ('pending','confirmed','out_for_delivery','delivered'));
alter table public.orders add column if not exists delivery_lat double precision check (delivery_lat between -90 and 90);
alter table public.orders add column if not exists delivery_lng double precision check (delivery_lng between -180 and 180);
alter table public.orders add column if not exists delivered_at timestamptz;

create or replace function public.is_delivery_man() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where user_id = auth.uid() and role = 'delivery');
$$;
drop policy if exists "Drivers read assigned orders" on public.orders;
create policy "Drivers read assigned orders" on public.orders for select to authenticated using (delivery_man_id = auth.uid() and public.is_delivery_man());
drop policy if exists "Drivers read assigned items" on public.order_items;
create policy "Drivers read assigned items" on public.order_items for select to authenticated using (public.is_delivery_man() and exists(select 1 from public.orders where id = order_id and delivery_man_id = auth.uid()));
drop policy if exists "Drivers read assigned customer profiles" on public.profiles;
create policy "Drivers read assigned customer profiles" on public.profiles for select to authenticated using (public.is_delivery_man() and exists(select 1 from public.orders where customer_id = profiles.user_id and delivery_man_id = auth.uid()));

create or replace function public.delivery_advance(p_order_id uuid, p_status text) returns void language plpgsql security definer set search_path = '' as $$
declare o public.orders%rowtype; v_order_status text;
begin
  if not public.is_delivery_man() then raise exception 'Delivery role required'; end if;
  select * into o from public.orders where id = p_order_id and delivery_man_id = auth.uid() for update;
  if not found then raise exception 'Assigned order not found'; end if;
  if o.status in ('cancelled','completed') or not ((o.delivery_status = 'pending' and p_status = 'confirmed') or (o.delivery_status = 'confirmed' and p_status = 'out_for_delivery' and o.status = 'preparing') or (o.delivery_status = 'out_for_delivery' and p_status = 'delivered' and o.status = 'on_the_way')) then
    raise exception 'Invalid delivery transition or order is not ready';
  end if;
  v_order_status := case p_status when 'out_for_delivery' then 'on_the_way' when 'delivered' then 'completed' else o.status end;
  update public.orders set delivery_status = p_status, status = v_order_status, delivered_at = case when p_status = 'delivered' then now() else delivered_at end where id = o.id;
  if p_status = 'confirmed' then
    insert into public.order_status_history(order_id,status,note,created_by) values(o.id,o.status,'Delivery accepted',auth.uid());
    insert into public.notifications(user_id,order_id,title,message) values(o.customer_id,o.id,'Delivery confirmed','Your delivery has been accepted by the delivery person.');
  end if;
  insert into public.notifications(user_id,order_id,title,message)
    select user_id,o.id,'Delivery updated','Order #' || upper(substr(replace(o.id::text,'-',''),1,8)) || ': ' || replace(p_status,'_',' ') from public.profiles where role = 'admin';
end $$;
revoke all on function public.delivery_advance(uuid,text) from public;
grant execute on function public.delivery_advance(uuid,text) to authenticated;

create or replace function public.assign_delivery(p_order_id uuid, p_driver_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare o public.orders%rowtype;
begin
  if not public.is_admin() then raise exception 'Administrator role required'; end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if o.status in ('completed','cancelled','on_the_way') or o.delivery_status <> 'pending' then raise exception 'This delivery can no longer be reassigned'; end if;
  if p_driver_id is not null and not exists(select 1 from public.profiles where user_id = p_driver_id and role = 'delivery') then raise exception 'Select a valid delivery person'; end if;
  update public.orders set delivery_man_id = p_driver_id where id = p_order_id;
end $$;
revoke all on function public.assign_delivery(uuid,uuid) from public;
grant execute on function public.assign_delivery(uuid,uuid) to authenticated;
