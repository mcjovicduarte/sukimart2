-- Run after driver-live-location.sql. A driver may share their location once
-- they have accepted an assigned order, until it is completed or cancelled.
create or replace function public.share_delivery_location(p_order_id uuid, p_lat double precision, p_lng double precision)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_delivery_man() or not exists (
    select 1 from public.orders o where o.id = p_order_id
      and o.delivery_man_id = auth.uid()
      and o.status in ('new', 'preparing', 'on_the_way')
      and o.delivery_status in ('confirmed', 'out_for_delivery')
  ) then raise exception 'Location can only be shared for your accepted order.'; end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Invalid location.';
  end if;
  insert into public.delivery_live_locations(order_id, driver_id, lat, lng, updated_at)
  values (p_order_id, auth.uid(), p_lat, p_lng, now())
  on conflict (order_id) do update set driver_id = excluded.driver_id, lat = excluded.lat, lng = excluded.lng, updated_at = now();
end;
$$;
revoke all on function public.share_delivery_location(uuid, double precision, double precision) from public;
grant execute on function public.share_delivery_location(uuid, double precision, double precision) to authenticated;

create or replace function public.customer_delivery_location(p_order_id uuid)
returns table (lat double precision, lng double precision, updated_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select l.lat, l.lng, l.updated_at
  from public.delivery_live_locations l
  join public.orders o on o.id = l.order_id and o.delivery_man_id = l.driver_id
  where o.id = p_order_id and o.customer_id = auth.uid()
    and o.status in ('new', 'preparing', 'on_the_way')
    and o.delivery_status in ('confirmed', 'out_for_delivery')
    and l.updated_at > now() - interval '2 minutes';
$$;
revoke all on function public.customer_delivery_location(uuid) from public;
grant execute on function public.customer_delivery_location(uuid) to authenticated;
