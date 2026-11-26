-- One-time conversion of existing products to box pricing.
-- Each current price increases by exactly ₱120. Existing stock quantities
-- are not converted; review them in Product Management afterwards.
-- Re-running this script will not increase the prices again.
create table if not exists public.product_price_migrations (
  migration_key text primary key,
  applied_at timestamptz not null default now()
);
alter table public.product_price_migrations enable row level security;
revoke all on public.product_price_migrations from public, anon, authenticated;

do $$
begin
  perform pg_catalog.pg_advisory_xact_lock(73142019, 2);
  if not exists (
    select 1 from public.product_price_migrations where migration_key = 'per-box-plus-120-v1'
  ) then
    update public.products
    set name = case when name ~* '\s*\(per box\)\s*$' then name
                    else rtrim(name) || ' (per box)' end,
        price = price + 120,
        updated_at = now();
    insert into public.product_price_migrations(migration_key) values ('per-box-plus-120-v1');
  end if;
end;
$$;
