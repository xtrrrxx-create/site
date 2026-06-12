-- ════════════════════════════════════════════════════════════════════════
-- Discord login + per-user favourites — run ONCE in the Supabase SQL editor
-- (Dashboard → SQL → New query → paste → Run).
--
-- Prereqs (do these in the dashboard, not here):
--   1. Authentication → Providers → Discord → enable, paste Client ID/Secret
--      from a Discord OAuth app (https://discord.com/developers/applications).
--   2. In the Discord app: OAuth2 → Redirects, add:
--        https://<PROJECT-REF>.supabase.co/auth/v1/callback
--   3. Authentication → URL Configuration → Site URL:
--        https://www.jarvis-finder.com
--      and add Redirect URLs:
--        https://www.jarvis-finder.com, https://jarvis-finder.com,
--        http://localhost:5599  (for local testing)
--   4. Add a SERVICE-ROLE key to Vercel env as SUPABASE_SERVICE_ROLE_KEY
--      (Project Settings → API → service_role secret). /api/products,
--      /api/click and /api/popular use it to bypass the lock-down below.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Lock the catalogue: anon key (now exposed to the browser for auth)
--       must NOT be able to read products directly, bypassing /api/products.
--       service_role bypasses grants/RLS, so the server proxy keeps working.
revoke select on table public.products from anon, authenticated;

-- ── 2. Favourites table — one row per (user, product).
create table if not exists public.favorites (
    user_id     uuid        not null references auth.users(id) on delete cascade,
    product_id  bigint      not null,
    created_at  timestamptz not null default now(),
    primary key (user_id, product_id)
);

alter table public.favorites enable row level security;

-- Each user may only see/insert/delete their own rows.
drop policy if exists "favorites_select_own" on public.favorites;
create policy "favorites_select_own" on public.favorites
    for select using (auth.uid() = user_id);

drop policy if exists "favorites_insert_own" on public.favorites;
create policy "favorites_insert_own" on public.favorites
    for insert with check (auth.uid() = user_id);

drop policy if exists "favorites_delete_own" on public.favorites;
create policy "favorites_delete_own" on public.favorites
    for delete using (auth.uid() = user_id);

grant select, insert, delete on table public.favorites to authenticated;
