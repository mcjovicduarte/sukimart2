-- Run after admin-dashboard.sql. Customer/admin chat; safe to run again.
create table if not exists public.customer_messages (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(user_id) on delete cascade,
  sender_id uuid not null references public.profiles(user_id) on delete cascade,
  body text not null check (length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists customer_messages_conversation_idx on public.customer_messages(customer_id, created_at, id);
alter table public.customer_messages enable row level security;
revoke all on public.customer_messages from anon, authenticated;
grant select on public.customer_messages to authenticated;
grant insert (customer_id, sender_id, body) on public.customer_messages to authenticated;

drop policy if exists "Customers and admins read conversations" on public.customer_messages;
create policy "Customers and admins read conversations" on public.customer_messages for select to authenticated
using (public.is_admin() or (customer_id = auth.uid() and exists (select 1 from public.profiles where user_id = auth.uid() and role = 'customer')));

drop policy if exists "Customers and admins send messages" on public.customer_messages;
create policy "Customers and admins send messages" on public.customer_messages for insert to authenticated
with check (
  sender_id = auth.uid()
  and exists (select 1 from public.profiles where user_id = customer_id and role = 'customer')
  and (public.is_admin() or (customer_id = auth.uid() and exists (select 1 from public.profiles where user_id = auth.uid() and role = 'customer')))
);
