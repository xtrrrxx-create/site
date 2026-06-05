// Vercel Serverless Function — private analytics for the owner dashboard.
// GET /api/stats?token=<ADMIN_TOKEN>
// Returns: { total_visits, unique_visitors, today_visits, online_now, top_items }
// Protected by the ADMIN_TOKEN env var. The Supabase anon key lives only on the
// server, so this is the only way to read aggregate stats.

const BLOCKED_UA = /(curl|wget|python-requests|libwww-perl|httpclient|scrapy|httrack|nikto|sqlmap|masscan|nmap|zgrab)/i;

// Constant-time-ish string compare to avoid trivially timing the token.
function safeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const ua = String(req.headers['user-agent'] || '');
    if (BLOCKED_UA.test(ua)) return res.status(403).json({ error: 'Forbidden' });

    const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
    if (!ADMIN_TOKEN) {
        console.error('[api/stats] missing ADMIN_TOKEN env');
        return res.status(500).json({ error: 'Server misconfigured' });
    }
    const provided = (req.headers['x-admin-token'] || req.query.token || '').toString();
    if (!safeEqual(provided, ADMIN_TOKEN)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        return res.status(500).json({ error: 'Server misconfigured' });
    }

    let base;
    try { base = new URL(SUPABASE_URL); } catch { return res.status(500).json({ error: 'Server misconfigured' }); }
    if (base.protocol !== 'https:' || !/\.supabase\.(co|in)$/i.test(base.hostname)) {
        return res.status(500).json({ error: 'Server misconfigured' });
    }

    try {
        const r = await fetch(`${base.protocol}//${base.host}/rest/v1/rpc/get_site_stats`, {
            method: 'POST',
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
            },
            body: '{}',
        });
        if (!r.ok) {
            console.error('[api/stats] rpc failed', r.status);
            return res.status(502).json({ error: 'Upstream error' });
        }
        const data = await r.json();
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        return res.json(data || {});
    } catch (err) {
        console.error('[api/stats] fetch failed', err && err.message);
        return res.status(502).json({ error: 'Upstream error' });
    }
}
