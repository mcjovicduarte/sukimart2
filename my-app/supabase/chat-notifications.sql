-- Run after customer-chat.sql. Read state is changed only through the function below.
alter table public.customer_messages add column if not exists read_at timestamptz;
create index if not exists customer_messages_unread_idx on public.customer_messages(customer_id, sender_id) where read_at is null;

create or replace function public.chat_unread_counts()
returns table (conversation_id uuid, unread_count bigint)
language sql stable security definer set search_path = '' as $$
  select m.customer_id, count(*)
  from public.customer_messages m
  join public.profiles sender on sender.user_id = m.sender_id
  where m.read_at is null and auth.uid() is not null
    and ((public.is_admin() and sender.role = 'customer')
      or (m.customer_id = auth.uid() and sender.role = 'admin'
          and exists(select 1 from public.profiles where user_id = auth.uid() and role = 'customer')))
  group by m.customer_id;
$$;

create or replace function public.chat_mark_read(p_customer_id uuid, p_message_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Please sign in.'; end if;
  if public.is_admin() then
    update public.customer_messages m set read_at = now()
    from public.profiles sender
    where m.customer_id = p_customer_id and m.id = any(p_message_ids) and m.read_at is null
      and sender.user_id = m.sender_id and sender.role = 'customer';
  elsif p_customer_id = auth.uid() and exists(select 1 from public.profiles where user_id = auth.uid() and role = 'customer') then
    update public.customer_messages m set read_at = now()
    from public.profiles sender
    where m.customer_id = auth.uid() and m.id = any(p_message_ids) and m.read_at is null
      and sender.user_id = m.sender_id and sender.role = 'admin';
  else
    raise exception 'You cannot update this conversation.';
  end if;
end $$;
revoke all on function public.chat_unread_counts() from public;
revoke all on function public.chat_mark_read(uuid,uuid[]) from public;
grant execute on function public.chat_unread_counts() to authenticated;
grant execute on function public.chat_mark_read(uuid,uuid[]) to authenticated;
