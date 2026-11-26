-- ============================================================
-- Sukimart: attach the bundled product photos to existing rows
-- ============================================================
-- The shop already shows a matching photo whenever `image_url` is
-- empty, so running this is optional. It is useful if you want the
-- value stored in the database (for exports, reports, or the admin
-- edit form).
--
-- Safe to re-run: it only fills rows whose image_url is still empty,
-- so pictures chosen in the admin page are never overwritten.
--
-- Run in Supabase -> SQL Editor.
-- ============================================================

update public.products as p
set image_url = seed.image_url
from (
  values
    ('Century Tuna Flakes in Oil',      '/products/Century Tuna.jpg'),
    ('Skyflakes Crackers',              '/products/Skyflakes.jpg'),
    ('Piattos Cheese',                  '/products/Piattos.jpg'),
    ('C2 Green Tea Apple',              '/products/C2.jpg'),
    ('Kopiko Black 3-in-1',             '/products/Kopiko.jpg'),
    ('Bear Brand Powdered Milk 300g',   '/products/Bear Brand.jpg'),
    ('Silver Swan Soy Sauce 385ml',     '/products/Silver Swan Soy.jpg'),
    ('Datu Puti Vinegar 385ml',         '/products/Datu Puti.jpg'),
    ('Tide Bar 130g',                   '/products/Tide Bar.jpg'),
    ('Safeguard Soap 60g',              '/products/Safeguard.jpg'),
    ('Egg (per piece)',                 '/products/Egg.jpg')
) as seed(name, image_url)
where p.name = seed.name
  and (p.image_url is null or btrim(p.image_url) = '');

-- Verify
select name, image_url
from public.products
order by name;
