// Vercel Serverless Function — site visit logger.
// POST /api/visit  body: { "visitor": "<random id>", "path": "/products" }
// Inserts a row into site_visits via the SECURITY DEFINER RPC log_visit so the
// anon key cannot write the table directly. Used to compute total visits,
// unique visitors and "online now" in /api/stats.

const ALLOWED_ORIGINS = new Set([
    'https://jarvis-finder.com',
    'https://www.jarvis-finder.com',
]);

const BLOCKED_UA = /(curl|wget|python-requests|libwww-perl|httpclient|scrapy|httrack|nikto|sqlmap|masscan|nmap|zgrab|semrush|ahrefs|mj12bot|dotbot|petalbot|bytespider)/i;

const RL_WINDOW_MS = 60 * 1000;
const RL_MAX = 40;
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
    const visitor = body && typeof body.visitor === 'string' ? body.visitor.trim().slice(0, 64) : '';
    const path = body && typeof body.path === 'string' ? body.path.trim().slice(0, 200) : '/';
    if (!visitor) return res.status(400).json({ error: 'Missing visitor' });

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error('[api/visit] missing supabase env');
        return res.status(500).json({ error: 'Server misconfigured' });
    }

    let base;
    try { base = new URL(SUPABASE_URL); } catch { return res.status(500).json({ error: 'Server misconfigured' }); }
    if (base.protocol !== 'https:' || !/\.supabase\.(co|in)$/i.test(base.hostname)) {
        return res.status(500).json({ error: 'Server misconfigured' });
    }

    try {
        const r = await fetch(`${base.protocol}//${base.host}/rest/v1/rpc/log_visit`, {
            method: 'POST',
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                Prefer: 'return=minimal',
            },
            body: JSON.stringify({ p_visitor: visitor, p_path: path }),
        });
        if (!r.ok) {
            console.error('[api/visit] rpc failed', r.status);
            return res.status(502).json({ error: 'Upstream error' });
        }
    } catch (err) {
        console.error('[api/visit] fetch failed', err && err.message);
        return res.status(502).json({ error: 'Upstream error' });
    }

    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(204).end();
}
