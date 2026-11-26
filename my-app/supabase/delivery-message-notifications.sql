-- Run after delivery-messages.sql. Only the intended recipient can mark
-- messages as read. Existing messages start unread for their recipient.
alter table public.delivery_messages add column if not exists read_at timestamptz;
create index if not exists delivery_messages_unread_idx on public.delivery_messages(order_id)
  where read_at is null;

create or replace function public.delivery_message_unread_counts()
returns table (order_id uuid, unread_count bigint)
language sql stable security definer set search_path = ''
as $$
  select m.order_id, count(*)
  from public.delivery_messages m
  join public.orders o on o.id = m.order_id and o.delivery_man_id = m.driver_id
  where m.read_at is null and m.sender_id <> auth.uid()
    and o.delivery_status in ('confirmed', 'out_for_delivery', 'delivered')
    and o.status <> 'cancelled'
    and (o.customer_id = auth.uid() or o.delivery_man_id = auth.uid())
  group by m.order_id;
$$;
revoke all on function public.delivery_message_unread_counts() from public, anon;
grant execute on function public.delivery_message_unread_counts() to authenticated;

create or replace function public.mark_delivery_messages_read(p_order_id uuid, p_message_ids uuid[])
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Please sign in.'; end if;
  update public.delivery_messages m set read_at = now()
  from public.orders o
  where o.id = p_order_id and m.order_id = o.id and o.delivery_man_id = m.driver_id
    and o.delivery_status in ('confirmed', 'out_for_delivery', 'delivered')
    and o.status <> 'cancelled'
    and (o.customer_id = auth.uid() or o.delivery_man_id = auth.uid())
    and m.sender_id <> auth.uid() and m.read_at is null and m.id = any(p_message_ids);
end;
$$;
revoke all on function public.mark_delivery_messages_read(uuid, uuid[]) from public, anon;
grant execute on function public.mark_delivery_messages_read(uuid, uuid[]) to authenticated;
