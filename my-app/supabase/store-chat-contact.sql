-- Run after customer-chat.sql and admin-profile.sql.
-- Customers receive only one store contact, not access to admin profiles.
create or replace function public.store_chat_contact()
returns table (full_name text, phone text)
language sql stable security definer set search_path = ''
as $$
  select p.full_name, p.phone
  from public.profiles p
  where p.role = 'admin' and nullif(btrim(p.phone), '') is not null
    and exists (select 1 from public.profiles customer
      where customer.user_id = auth.uid() and customer.role = 'customer')
  order by (
    select max(m.created_at) from public.customer_messages m
    where m.customer_id = auth.uid() and m.sender_id = p.user_id
  ) desc nulls last, p.user_id
  limit 1;
$$;
revoke all on function public.store_chat_contact() from public, anon;
grant execute on function public.store_chat_contact() to authenticated;
