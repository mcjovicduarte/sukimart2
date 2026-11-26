-- Run after delivery.sql and customer-location.sql in the Supabase SQL Editor.
alter table public.profiles add column if not exists phone text not null default '';
alter table public.profiles add column if not exists delivery_address text not null default '';
alter table public.profiles add column if not exists delivery_lat double precision;
alter table public.profiles add column if not exists delivery_lng double precision;

-- Customers may edit only these fields, never their role or another profile.
create or replace function public.update_customer_profile(
  p_full_name text, p_phone text, p_address text,
  p_lat double precision, p_lng double precision
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Please sign in.'; end if;
  if nullif(btrim(p_full_name), '') is null then raise exception 'Enter your full name.'; end if;
  if nullif(btrim(p_address), '') is null then raise exception 'Enter your delivery address.'; end if;
  if p_lat is null or p_lng is null or p_lat not between 4.3 and 10.4 or p_lng not between 118.5 and 127 then
    raise exception 'Select a location in the Mindanao map area.';
  end if;
  update public.profiles set full_name = btrim(p_full_name), phone = coalesce(btrim(p_phone), ''),
    delivery_address = btrim(p_address), delivery_lat = p_lat, delivery_lng = p_lng
  where user_id = auth.uid() and role = 'customer';
  if not found then raise exception 'Customer profile not found.'; end if;
end $$;
revoke all on function public.update_customer_profile(text,text,text,double precision,double precision) from public;
grant execute on function public.update_customer_profile(text,text,text,double precision,double precision) to authenticated;
