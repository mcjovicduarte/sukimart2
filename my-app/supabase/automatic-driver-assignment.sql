-- Run after delivery.sql and customer-driver-contact.sql.
-- A driver is available when they have no unfinished assigned order.
-- Pickup orders are excluded. Waiting orders are assigned oldest first.

-- Replace the old demo-only dispatch trigger, which skipped driver acceptance.
drop trigger if exists auto_assign_delivery_on_dispatch on public.orders;

create or replace function public.assign_waiting_deliveries()
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_order_id uuid;
  v_driver_id uuid;
begin
  -- Serialize assignment across concurrent orders and driver changes.
  perform pg_catalog.pg_advisory_xact_lock(73142019, 1);
  loop
    select p.user_id into v_driver_id
    from public.profiles p
    where p.role = 'delivery'
      and not exists (
        select 1 from public.orders active_order
        where active_order.delivery_man_id = p.user_id
          and active_order.status not in ('completed', 'cancelled')
          and active_order.delivery_status <> 'delivered'
      )
    order by p.user_id
    limit 1;
    exit when v_driver_id is null;

    select o.id into v_order_id
    from public.orders o
    where o.delivery_man_id is null
      and o.delivery_status = 'pending'
      and o.status in ('new', 'preparing')
      and o.payment_method is distinct from 'Pickup and pay at store'
    order by o.created_at, o.id
    for update skip locked
    limit 1;
    exit when v_order_id is null;

    update public.orders set delivery_man_id = v_driver_id where id = v_order_id;
  end loop;
end;
$$;
revoke all on function public.assign_waiting_deliveries() from public, anon, authenticated;

create or replace function public.queue_delivery_assignment()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if pg_catalog.pg_trigger_depth() = 1 then
    perform public.assign_waiting_deliveries();
  end if;
  return null;
end;
$$;
revoke all on function public.queue_delivery_assignment() from public, anon, authenticated;

drop trigger if exists queue_delivery_after_order on public.orders;
create trigger queue_delivery_after_order
after insert or update of status, delivery_status, delivery_man_id on public.orders
for each row execute function public.queue_delivery_assignment();

drop trigger if exists queue_delivery_after_driver on public.profiles;
create trigger queue_delivery_after_driver
after insert or update of role on public.profiles
for each row when (new.role = 'delivery')
execute function public.queue_delivery_assignment();

-- Do not let manual dispatch bypass the driver's acceptance.
create or replace function public.require_delivery_acceptance()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'on_the_way' and old.status is distinct from new.status
    and new.payment_method is distinct from 'Pickup and pay at store' then
    if old.delivery_man_id is null or old.delivery_status <> 'confirmed' then
      raise exception 'A delivery driver must accept this order before it can be dispatched.';
    end if;
    new.delivery_status := 'out_for_delivery';
  elsif new.status = 'completed' and old.status is distinct from new.status
    and new.delivery_man_id is not null then
    new.delivery_status := 'delivered';
    new.delivered_at := coalesce(new.delivered_at, now());
  end if;
  return new;
end;
$$;
revoke all on function public.require_delivery_acceptance() from public, anon, authenticated;
drop trigger if exists require_delivery_acceptance on public.orders;
create trigger require_delivery_acceptance before update of status on public.orders
for each row execute function public.require_delivery_acceptance();

-- Admins no longer manually override the automatic one-order-per-driver queue.
revoke execute on function public.assign_delivery(uuid, uuid) from public, anon, authenticated;

-- Assign any eligible orders that were already waiting.
select public.assign_waiting_deliveries();
