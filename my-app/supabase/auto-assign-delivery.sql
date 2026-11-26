-- Run after admin-dashboard.sql and delivery.sql.
-- New transitions to "on the way" assign the demo driver when no driver
-- has already been selected. Existing orders are not changed by this script.
create or replace function public.auto_assign_delivery_on_dispatch()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_driver uuid;
begin
  if new.status = 'on_the_way' and old.status is distinct from new.status
     and new.payment_method is distinct from 'Pickup and pay at store' then
    if new.delivery_man_id is null then
      select user_id into v_driver from public.profiles
      where lower(email) = 'delivery@gmail.com' and role = 'delivery'
      limit 1;
      if v_driver is null then
        raise exception 'Cannot dispatch: delivery@gmail.com is not configured as a delivery person. Assign a delivery person first.';
      end if;
      new.delivery_man_id := v_driver;
    end if;
    new.delivery_status := 'out_for_delivery';
  elsif new.status = 'completed' and old.status is distinct from new.status and new.delivery_man_id is not null then
    new.delivery_status := 'delivered';
    new.delivered_at := coalesce(new.delivered_at, now());
  end if;
  return new;
end $$;

drop trigger if exists auto_assign_delivery_on_dispatch on public.orders;
create trigger auto_assign_delivery_on_dispatch before update of status on public.orders
for each row execute function public.auto_assign_delivery_on_dispatch();
