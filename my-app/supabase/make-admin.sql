-- ============================================================
-- Sukimart: make an account an administrator
-- ============================================================
-- 1. Create the account first: open the app -> Create Account, or
--    Supabase Dashboard -> Authentication -> Users -> Add user.
-- 2. Replace the email below with that account's email.
-- 3. Paste this file into Supabase -> SQL Editor -> Run.
-- ============================================================

do $$
declare
  admin_email text := 'you@example.com'; -- <-- change this
  target_id uuid;
begin
  select id into target_id
  from auth.users
  where lower(email) = lower(admin_email);

  if target_id is null then
    raise exception 'No account exists for %. Create the account first, then run this script again.', admin_email;
  end if;

  insert into public.profiles (user_id, full_name, email, role)
  select
    u.id,
    coalesce(u.raw_user_meta_data ->> 'full_name', ''),
    coalesce(u.email, ''),
    'admin'
  from auth.users as u
  where u.id = target_id
  on conflict (user_id) do update
    set role = 'admin',
        email = excluded.email;

  raise notice '%, you are now an administrator.', admin_email;
end;
$$;

-- Verify: every admin account in the project
select email, full_name, role, created_at
from public.profiles
order by role desc, created_at;
