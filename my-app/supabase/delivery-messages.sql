-- Run after delivery.sql. Messages are private to an order's customer and
-- currently assigned driver, after the driver accepts that order.
create table if not exists public.delivery_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  driver_id uuid not null references public.profiles(user_id),
  sender_id uuid not null references public.profiles(user_id),
  body text not null check (length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists delivery_messages_order_idx on public.delivery_messages(order_id, created_at, id);
alter table public.delivery_messages enable row level security;
revoke all on public.delivery_messages from public, anon, authenticated;
grant select on public.delivery_messages to authenticated;
drop policy if exists "Order participants read delivery messages" on public.delivery_messages;
create policy "Order participants read delivery messages" on public.delivery_messages
for select to authenticated using (
  exists (select 1 from public.orders o
    where o.id = delivery_messages.order_id
      and o.delivery_man_id = delivery_messages.driver_id
      and o.delivery_status in ('confirmed', 'out_for_delivery', 'delivered')
      and o.status <> 'cancelled'
      and (o.customer_id = auth.uid() or o.delivery_man_id = auth.uid()))
);

create or replace function public.send_delivery_message(p_order_id uuid, p_body text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_driver_id uuid;
begin
  if auth.uid() is null then raise exception 'Please sign in.'; end if;
  if p_body is null or length(btrim(p_body)) not between 1 and 2000 then
    raise exception 'Enter a message of up to 2000 characters.';
  end if;
  select o.delivery_man_id into v_driver_id from public.orders o
    where o.id = p_order_id and o.delivery_man_id is not null
      and o.delivery_status in ('confirmed', 'out_for_delivery', 'delivered')
      and o.status <> 'cancelled'
      and (o.customer_id = auth.uid() or o.delivery_man_id = auth.uid())
    for share;
  if not found then raise exception 'Messaging is unavailable for this order.'; end if;
  insert into public.delivery_messages(order_id, driver_id, sender_id, body)
  values (p_order_id, v_driver_id, auth.uid(), btrim(p_body));
end;
$$;
revoke all on function public.send_delivery_message(uuid, text) from public, anon;
grant execute on function public.send_delivery_message(uuid, text) to authenticated;
