// Vercel Serverless Function — top-N most-clicked product titles.
// GET /api/popular  -> [{ title, clicks }, ...]  capped at 15.
// Public, edge-cached for 60s. Frontend joins these titles with the catalog
// to render the "Most Popular" marquee on the home page.

const ALLOWED_ORIGINS = new Set([
    'https://jarvis-finder.com',
    'https://www.jarvis-finder.com',
]);

const BLOCKED_UA = /(curl|wget|python-requests|libwww-perl|httpclient|scrapy|httrack|nikto|sqlmap|masscan|nmap|zgrab|semrush|ahrefs|mj12bot|dotbot|petalbot|bytespider)/i;

const TOP_N = 15;

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const origin = req.headers.origin;
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    const ua = String(req.headers['user-agent'] || '');
    if (!ua || BLOCKED_UA.test(ua)) return res.status(403).json({ error: 'Forbidden' });

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error('[api/popular] missing supabase env');
        return res.status(500).json({ error: 'Server misconfigured' });
    }

    let base;
    try { base = new URL(SUPABASE_URL); } catch { return res.status(500).json({ error: 'Server misconfigured' }); }
    if (base.protocol !== 'https:' || !/\.supabase\.(co|in)$/i.test(base.hostname)) {
        return res.status(500).json({ error: 'Server misconfigured' });
    }

    try {
        const r = await fetch(
            `${base.protocol}//${base.host}/rest/v1/product_clicks?select=title,clicks&order=clicks.desc&limit=${TOP_N}`,
            { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
        );
        if (!r.ok) {
            // Table may not exist yet on a fresh install — return [] so the
            // frontend falls back to "newest" instead of erroring out.
            console.error('[api/popular] upstream', r.status);
            res.setHeader('Cache-Control', 's-maxage=10');
            return res.json([]);
        }
        const data = await r.json();
        res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Vary', 'Origin');
        return res.json(Array.isArray(data) ? data : []);
    } catch (err) {
        console.error('[api/popular] fetch failed', err && err.message);
        return res.status(502).json({ error: 'Upstream error' });
    }
}
