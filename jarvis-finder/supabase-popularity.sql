-- Run this ONCE in Supabase Dashboard → SQL Editor → New Query.
-- Sets up the global popularity counter for the "Most Popular" marquee.
-- Safe to re-run (idempotent).

-- 1. Table: one row per product title, with click counter.
create table if not exists public.product_clicks (
    title       text primary key,
    clicks      integer not null default 0,
    updated_at  timestamptz not null default now()
);

-- 2. Row-level security: anon can READ (so /api/popular works with the
-- anon key), but cannot INSERT/UPDATE the table directly. Writes go
-- through the RPC below, which runs with elevated privileges.
alter table public.product_clicks enable row level security;

drop policy if exists "anon_read_clicks" on public.product_clicks;
create policy "anon_read_clicks"
    on public.product_clicks
    for select
    to anon
    using (true);

-- 3. Atomic increment via RPC. SECURITY DEFINER means the function runs
-- as its owner (typically postgres), so it can write even though the
-- caller (anon) has no direct write privilege on the table.
create or replace function public.increment_click(p_title text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if p_title is null or length(trim(p_title)) = 0 then
        return;
    end if;
    insert into public.product_clicks (title, clicks, updated_at)
    values (trim(p_title), 1, now())
    on conflict (title) do update
        set clicks = product_clicks.clicks + 1,
            updated_at = now();
end;
$$;

-- 4. Allow the anon role to call the RPC (the function itself enforces
-- via SECURITY DEFINER what it does — the anon role only sees a no-op
-- contract: "give me a title, I increment it").
grant execute on function public.increment_click(text) to anon;

-- 5. Index for the top-N read path used by /api/popular.
create index if not exists product_clicks_clicks_desc_idx
    on public.product_clicks (clicks desc);
