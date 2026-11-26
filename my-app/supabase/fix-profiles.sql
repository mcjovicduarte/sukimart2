-- ============================================================
-- Sukimart: repair missing customer/admin profiles
-- ============================================================
-- Run this in Supabase -> SQL Editor if the app shows
-- "Supabase role setup is missing" or an account cannot sign in.
-- It is safe to run more than once.
-- ============================================================

-- 1. Give every auth user a profile row (existing admins keep their role).
insert into public.profiles (user_id, full_name, email, role)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'full_name', ''),
  coalesce(u.email, ''),
  'customer'
from auth.users as u
left join public.profiles as p on p.user_id = u.id
where p.user_id is null
on conflict (user_id) do nothing;

-- 2. Keep the signup trigger healthy (name + email).
create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, '')
  )
  on conflict (user_id) do update
    set email = excluded.email,
        full_name = case
          when public.profiles.full_name = '' then excluded.full_name
          else public.profiles.full_name
        end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

-- 3. Users can read their own profile; admins can read everyone.
alter table public.profiles enable row level security;
grant select on public.profiles to authenticated;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- 4. Let the app self-heal a missing profile. The check stops anyone from
--    creating an admin profile for themselves.
grant insert on public.profiles to authenticated;

drop policy if exists "Users can create their own profile" on public.profiles;
create policy "Users can create their own profile"
  on public.profiles for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and role = 'customer'
  );

-- 5. Report the result.
select
  (select count(*) from auth.users) as auth_users,
  (select count(*) from public.profiles) as profiles,
  (
    select count(*)
    from auth.users as u
    left join public.profiles as p on p.user_id = u.id
    where p.user_id is null
  ) as missing_profiles,
  (select count(*) from public.profiles where role = 'admin') as admins;
