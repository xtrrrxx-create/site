-- Add the seller column used by the admin app (auto-filled from picks.ly)
-- and shown as "Category | Seller" on product cards.
-- Run once in the Supabase SQL editor of the project that holds `products`.

alter table public.products add column if not exists seller text;
