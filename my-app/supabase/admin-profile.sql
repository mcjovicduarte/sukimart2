-- Run after the base profile and admin setup. Safe to run more than once.
alter table public.profiles add column if not exists phone text not null default '';

-- Only the signed-in admin's name and phone can be changed by this function.
create or replace function public.update_admin_profile(p_full_name text, p_phone text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator access required.';
  end if;
  if p_full_name is null or length(btrim(p_full_name)) = 0 or length(btrim(p_full_name)) > 100 then
    raise exception 'Enter a name of up to 100 characters.';
  end if;
  if p_phone is null or length(btrim(p_phone)) > 25 or
    (btrim(p_phone) <> '' and (btrim(p_phone) !~ '^[+0-9 ()-]+$'
      or length(regexp_replace(p_phone, '[^0-9]', '', 'g')) < 7)) then
    raise exception 'Enter a valid contact number with at least 7 digits.';
  end if;
  update public.profiles set full_name = btrim(p_full_name), phone = btrim(p_phone)
  where user_id = auth.uid() and role = 'admin';
  if not found then raise exception 'Administrator profile not found.'; end if;
end;
$$;
revoke all on function public.update_admin_profile(text, text) from public, anon;
grant execute on function public.update_admin_profile(text, text) to authenticated;
