-- Run after delivery-minimum.sql. This configures one active store/branch.
create table if not exists public.store_settings (
  id boolean primary key default true check (id),
  latitude double precision not null check (latitude between 4.3 and 10.4),
  longitude double precision not null check (longitude between 118.5 and 127)
);
insert into public.store_settings(id, latitude, longitude)
values (true, 8.1720049, 124.2496712) on conflict (id) do nothing;
alter table public.store_settings enable row level security;
revoke all on public.store_settings from public, anon, authenticated;
grant select on public.store_settings to authenticated;
drop policy if exists "Authenticated users read store location" on public.store_settings;
create policy "Authenticated users read store location" on public.store_settings
  for select to authenticated using (true);

create or replace function public.set_store_location(p_lat double precision, p_lng double precision)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Administrator access required.'; end if;
  if p_lat is null or p_lng is null or p_lat not between 4.3 and 10.4 or p_lng not between 118.5 and 127 then
    raise exception 'Select a store location in the Mindanao map area.';
  end if;
  insert into public.store_settings(id, latitude, longitude) values (true, p_lat, p_lng)
  on conflict (id) do update set latitude = excluded.latitude, longitude = excluded.longitude;
end;
$$;
revoke all on function public.set_store_location(double precision, double precision) from public, anon;
grant execute on function public.set_store_location(double precision, double precision) to authenticated;

create or replace function public.place_order_with_location(
  items jsonb, p_delivery_address text, p_payment_method text,
  p_delivery_lat double precision, p_delivery_lng double precision
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_order_id uuid;
  v_distance double precision;
  v_minimum numeric := 0;
  v_total numeric;
  v_store_lat double precision;
  v_store_lng double precision;
begin
  if auth.uid() is null then raise exception 'You must be signed in to place an order.'; end if;
  if p_payment_method is distinct from 'Pickup and pay at store' then
    if nullif(btrim(p_delivery_address), '') is null then raise exception 'Enter the complete delivery address.'; end if;
    if p_delivery_lat is null or p_delivery_lng is null or p_delivery_lat not between 4.3 and 10.4
      or p_delivery_lng not between 118.5 and 127 then
      raise exception 'Select and confirm a delivery location in the Mindanao map area.';
    end if;
    select latitude, longitude into v_store_lat, v_store_lng from public.store_settings where id = true;
    if not found then raise exception 'The store location is not configured. Contact the store.'; end if;
    v_distance := 2 * 6371 * asin(sqrt(least(1.0,
      power(sin(radians(p_delivery_lat - v_store_lat) / 2), 2) +
      cos(radians(v_store_lat)) * cos(radians(p_delivery_lat)) *
      power(sin(radians(p_delivery_lng - v_store_lng) / 2), 2)
    )));
    v_minimum := case when v_distance <= 3 then 0 when v_distance <= 5 then 200
      when v_distance <= 10 then 500 else 1000 end;
  else
    p_delivery_address := '';
    p_delivery_lat := null;
    p_delivery_lng := null;
  end if;
  v_order_id := public.place_order(items, p_delivery_address, p_payment_method);
  select total into v_total from public.orders where id = v_order_id and customer_id = auth.uid();
  if v_total < v_minimum then
    raise exception 'This delivery requires a minimum order of ₱%. Please add more items.', v_minimum;
  end if;
  update public.orders set delivery_lat = p_delivery_lat, delivery_lng = p_delivery_lng
    where id = v_order_id and customer_id = auth.uid();
  return v_order_id;
end;
$$;
revoke all on function public.place_order_with_location(jsonb,text,text,double precision,double precision) from public, anon;
grant execute on function public.place_order_with_location(jsonb,text,text,double precision,double precision) to authenticated;
revoke execute on function public.place_order(jsonb,text,text) from public, anon, authenticated;
