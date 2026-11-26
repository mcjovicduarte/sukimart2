-- Run once in the Supabase SQL Editor after the existing order setup.
-- The number is a permanent, store-wide reference; existing UUIDs do not change.
begin;
lock table public.orders in access exclusive mode;
create sequence if not exists public.orders_order_number_seq as bigint;
alter table public.orders add column if not exists order_number bigint;
alter table public.orders alter column order_number set default nextval('public.orders_order_number_seq'::regclass);

-- If this migration is rerun, continue above all previously assigned numbers.
do $$
declare v_max bigint; v_sequence bigint;
begin
  select max(order_number) into v_max from public.orders;
  if v_max is not null then
    select last_value into v_sequence from public.orders_order_number_seq;
    perform setval('public.orders_order_number_seq'::regclass, greatest(v_max, v_sequence), true);
  end if;
end $$;

-- Number older orders in their existing chronological order.
with numbered as materialized (
  select id, nextval('public.orders_order_number_seq'::regclass) as number
  from public.orders where order_number is null order by created_at, id
)
update public.orders o set order_number = numbered.number from numbered where o.id = numbered.id;
alter table public.orders alter column order_number set not null;
create unique index if not exists orders_order_number_unique on public.orders (order_number);
alter sequence public.orders_order_number_seq owned by public.orders.order_number;
grant usage, select on sequence public.orders_order_number_seq to authenticated;
commit;
