-- Run after admin-dashboard.sql and delivery.sql in the Supabase SQL Editor.
-- Wrap the existing transactional checkout so stock, order, and coordinates
-- are committed together. Pickup orders do not require a delivery pin.
create or replace function public.place_order_with_location(
  items jsonb, p_delivery_address text, p_payment_method text,
  p_delivery_lat double precision, p_delivery_lng double precision
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_order_id uuid;
begin
  if auth.uid() is null then raise exception 'You must be signed in to place an order.'; end if;
  if p_payment_method is distinct from 'Pickup and pay at store' then
    if nullif(btrim(p_delivery_address), '') is null then
      raise exception 'Enter the complete delivery address.';
    end if;
    if p_delivery_lat is null or p_delivery_lng is null
      or p_delivery_lat not between 4.3 and 10.4
      or p_delivery_lng not between 118.5 and 127 then
      raise exception 'Select and confirm a delivery location in the Mindanao map area.';
    end if;
  else
    p_delivery_address := '';
    p_delivery_lat := null;
    p_delivery_lng := null;
  end if;
  v_order_id := public.place_order(items, p_delivery_address, p_payment_method);
  update public.orders set delivery_lat = p_delivery_lat, delivery_lng = p_delivery_lng
    where id = v_order_id and customer_id = auth.uid();
  return v_order_id;
end $$;
revoke all on function public.place_order_with_location(jsonb,text,text,double precision,double precision) from public;
grant execute on function public.place_order_with_location(jsonb,text,text,double precision,double precision) to authenticated;

-- Prevent bypassing the delivery-location requirement through the old RPC.
revoke execute on function public.place_order(jsonb,text,text) from public, authenticated;
do $$ begin
  if to_regprocedure('public.place_order(jsonb)') is not null then
    revoke execute on function public.place_order(jsonb) from public, authenticated;
  end if;
end $$;
