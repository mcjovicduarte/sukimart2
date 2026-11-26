-- Run in the Supabase SQL Editor after the base profile setup.
-- Shared with customer profiles; safe to run if customer-profile.sql was applied.
alter table public.profiles add column if not exists phone text not null default '';
