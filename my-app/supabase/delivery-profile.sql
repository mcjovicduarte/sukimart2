-- Run after delivery.sql. Safe to run more than once.
alter table public.profiles add column if not exists phone text not null default '';

-- Drivers can change only their own contact number, never their role or another profile.
create or replace function public.update_delivery_contact(p_phone text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Please sign in.'; end if;
  if p_phone is null or length(btrim(p_phone)) > 25
    or btrim(p_phone) !~ '^[+0-9 ()-]+$'
    or length(regexp_replace(p_phone, '[^0-9]', '', 'g')) < 7 then
    raise exception 'Enter a valid contact number with at least 7 digits.';
  end if;
  update public.profiles set phone = btrim(p_phone)
  where user_id = auth.uid() and role = 'delivery';
  if not found then raise exception 'Delivery driver profile not found.'; end if;
end;
$$;
revoke all on function public.update_delivery_contact(text) from public;
grant execute on function public.update_delivery_contact(text) to authenticated;
