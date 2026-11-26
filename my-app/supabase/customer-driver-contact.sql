-- Run after delivery-profile.sql. Only the order's customer sees the assigned
-- driver's name and phone, and only after the driver has accepted the order.
create or replace function public.customer_delivery_contacts()
returns table (order_id uuid, full_name text, phone text)
language sql stable security definer set search_path = ''
as $$
  select o.id, p.full_name, p.phone
  from public.orders o
  join public.profiles p on p.user_id = o.delivery_man_id and p.role = 'delivery'
  where o.customer_id = auth.uid()
    and o.delivery_status in ('confirmed', 'out_for_delivery', 'delivered')
    and o.status <> 'cancelled';
$$;
revoke all on function public.customer_delivery_contacts() from public;
grant execute on function public.customer_delivery_contacts() to authenticated;

-- A driver can edit only their own name and contact number.
create or replace function public.update_delivery_profile(p_full_name text, p_phone text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Please sign in.'; end if;
  if p_full_name is null or length(btrim(p_full_name)) = 0 or length(btrim(p_full_name)) > 100 then
    raise exception 'Enter a name of up to 100 characters.';
  end if;
  if p_phone is null or length(btrim(p_phone)) > 25 or btrim(p_phone) !~ '^[+0-9 ()-]+$'
    or length(regexp_replace(p_phone, '[^0-9]', '', 'g')) < 7 then
    raise exception 'Enter a valid contact number with at least 7 digits.';
  end if;
  update public.profiles set full_name = btrim(p_full_name), phone = btrim(p_phone)
  where user_id = auth.uid() and role = 'delivery';
  if not found then raise exception 'Delivery driver profile not found.'; end if;
end;
$$;
revoke all on function public.update_delivery_profile(text, text) from public;
grant execute on function public.update_delivery_profile(text, text) to authenticated;
