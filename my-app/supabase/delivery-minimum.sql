-- Run after customer-location.sql and admin-dashboard.sql.
-- Distance is straight-line from the store, not road distance.
-- Keep the store coordinates and tiers in sync with utils/delivery-minimum.ts.
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
    v_distance := 2 * 6371 * asin(sqrt(least(1.0,
      power(sin(radians(p_delivery_lat - 8.1720049) / 2), 2) +
      cos(radians(8.1720049)) * cos(radians(p_delivery_lat)) *
      power(sin(radians(p_delivery_lng - 124.2496712) / 2), 2)
    )));
    v_minimum := case when v_distance <= 3 then 0 when v_distance <= 5 then 200
      when v_distance <= 10 then 500 else 1000 end;
  else
    p_delivery_address := '';
    p_delivery_lat := null;
    p_delivery_lng := null;
  end if;

  -- place_order calculates the total from locked product prices. Raising below
  -- rolls back the entire transaction, including stock and assignment changes.
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

-- Block the older checkout RPC from bypassing the location and minimum checks.
revoke execute on function public.place_order(jsonb,text,text) from public, anon, authenticated;
do $$ begin
  if to_regprocedure('public.place_order(jsonb)') is not null then
    revoke execute on function public.place_order(jsonb) from public, anon, authenticated;
  end if;
end $$;
