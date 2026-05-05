// Vercel Serverless Function — popularity click tracker.
// POST /api/click  body: { "title": "<product title>" }
// Increments product_clicks.clicks for that title via Supabase RPC.
// The RPC is SECURITY DEFINER so the anon key cannot write the table directly.

const ALLOWED_ORIGINS = new Set([
    'https://jarvis-finder.com',
    'https://www.jarvis-finder.com',
]);

const BLOCKED_UA = /(curl|wget|python-requests|libwww-perl|httpclient|scrapy|httrack|nikto|sqlmap|masscan|nmap|zgrab|semrush|ahrefs|mj12bot|dotbot|petalbot|bytespider)/i;

// Per-IP rate limit. A real user can't physically click 60 buy buttons
// in a minute; this stops a script from inflating popularity for free.
const RL_WINDOW_MS = 60 * 1000;
const RL_MAX = 30;
const rlMap = new Map();

function clientIp(req) {
    const xff = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    return xff || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

function rateLimit(ip) {
    const now = Date.now();
    let e = rlMap.get(ip);
    if (!e || e.resetAt < now) { e = { count: 0, resetAt: now + RL_WINDOW_MS }; rlMap.set(ip, e); }
    if (rlMap.size > 1000 && Math.random() < 0.02) {
        for (const [k, v] of rlMap) if (v.resetAt < now) rlMap.delete(k);
    }
    if (e.count >= RL_MAX) return false;
    e.count++;
    return true;
}

async function readJson(req) {
    if (req.body && typeof req.body === 'object') return req.body;
    return await new Promise(resolve => {
        let raw = '';
        req.on('data', c => { raw += c; if (raw.length > 4096) { req.destroy(); resolve(null); } });
        req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch { resolve(null); } });
        req.on('error', () => resolve(null));
    });
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Origin check — reject browser POSTs from other sites. sendBeacon may
    // omit Origin in some browsers, so accept missing-Origin only when the
    // referer is on our domain.
    const origin = req.headers.origin;
    const referer = req.headers.referer || '';
    const refererOk =
        referer.startsWith('https://jarvis-finder.com/') ||
        referer.startsWith('https://www.jarvis-finder.com/');
    if (origin) {
        if (!ALLOWED_ORIGINS.has(origin)) return res.status(403).json({ error: 'Forbidden' });
    } else if (!refererOk) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    const ua = String(req.headers['user-agent'] || '');
    if (!ua || BLOCKED_UA.test(ua)) return res.status(403).json({ error: 'Forbidden' });

    if (!rateLimit(clientIp(req))) return res.status(429).json({ error: 'Too many requests' });

    const body = await readJson(req);
    const title = body && typeof body.title === 'string' ? body.title.trim().slice(0, 300) : '';
    if (!title) return res.status(400).json({ error: 'Missing title' });

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error('[api/click] missing supabase env');
        return res.status(500).json({ error: 'Server misconfigured' });
    }

    let base;
    try { base = new URL(SUPABASE_URL); } catch { return res.status(500).json({ error: 'Server misconfigured' }); }
    if (base.protocol !== 'https:' || !/\.supabase\.(co|in)$/i.test(base.hostname)) {
        return res.status(500).json({ error: 'Server misconfigured' });
    }

    try {
        const r = await fetch(`${base.protocol}//${base.host}/rest/v1/rpc/increment_click`, {
            method: 'POST',
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                Prefer: 'return=minimal',
            },
            body: JSON.stringify({ p_title: title }),
        });
        if (!r.ok) {
            console.error('[api/click] rpc failed', r.status);
            return res.status(502).json({ error: 'Upstream error' });
        }
    } catch (err) {
        console.error('[api/click] fetch failed', err && err.message);
        return res.status(502).json({ error: 'Upstream error' });
    }

    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(204).end();
}
