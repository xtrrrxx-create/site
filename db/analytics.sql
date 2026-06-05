-- ────────────────────────────────────────────────────────────────────────────
-- Jarvis Finder — analytics (visits + dashboard stats)
-- Run this ONCE in the Supabase SQL editor (Dashboard → SQL → New query → Run).
-- Requires the existing product_clicks table (already used by /api/popular).
-- ────────────────────────────────────────────────────────────────────────────

-- One row per page load.
create table if not exists public.site_visits (
    id          bigint generated always as identity primary key,
    visitor_id  text,
    path        text,
    ts          timestamptz not null default now()
);

create index if not exists site_visits_ts_idx      on public.site_visits (ts);
create index if not exists site_visits_visitor_idx on public.site_visits (visitor_id);

-- Insert a visit. SECURITY DEFINER so the anon key can call it via /api/visit
-- without being able to write the table directly.
create or replace function public.log_visit(p_visitor text, p_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.site_visits (visitor_id, path)
    values (left(coalesce(p_visitor, ''), 64), left(coalesce(p_path, '/'), 200));
end;
$$;

-- Aggregate stats for the owner dashboard (/api/stats → /admin).
create or replace function public.get_site_stats()
returns json
language sql
security definer
set search_path = public
as $$
    select json_build_object(
        'total_visits',    (select count(*) from public.site_visits),
        'unique_visitors', (select count(distinct visitor_id) from public.site_visits),
        'today_visits',    (select count(*) from public.site_visits where ts >= date_trunc('day', now())),
        'online_now',      (select count(distinct visitor_id) from public.site_visits
                            where ts > now() - interval '5 minutes'),
        'top_items',       (select coalesce(json_agg(t), '[]'::json) from (
                                select title, clicks
                                from public.product_clicks
                                order by clicks desc
                                limit 30
                            ) t)
    );
$$;

-- /api/visit (anon key) needs to insert visits. get_site_stats is read only
-- by the local Electron admin (service key), so it is NOT granted to anon.
grant execute on function public.log_visit(text, text) to anon;

-- Optional: keep the table from growing forever (delete visits older than 1 year).
-- delete from public.site_visits where ts < now() - interval '365 days';
