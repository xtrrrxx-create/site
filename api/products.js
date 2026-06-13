// Vercel Serverless Function — Supabase products proxy.
// Hides anon key from frontend. Read-only, GET only, generic errors,
// per-IP rate limit + UA filter to discourage scrapers.

const ALLOWED_ORIGINS = new Set([
    'https://jarvis-finder.com',
    'https://www.jarvis-finder.com',
]);

// Per-IP rate limit. The catalog is cached at the Vercel edge
// (s-maxage=60), so legitimate users almost never hit this function.
// Anything that bypasses the cache (cache-buster query, no-cache header)
// counts toward this budget. In-memory; per warm instance only.
const RL_WINDOW_MS = 60 * 1000;
// The catalogue is edge-cached (s-maxage), so real users rarely reach this
// function. 20 leaves headroom for refreshes / multiple tabs while still
// throttling a scraper that busts the cache. (8 was too low — tripped 429s
// during normal use.)
const RL_MAX = 20;
const rlMap = new Map();

// Block obvious scrapers/automation by UA. We do NOT rely on this for
// security (UA is trivially spoofed) — it's a low-friction filter that
// stops dumb wget/curl loops without blocking real browsers.
const BLOCKED_UA = /(curl|wget|python-requests|libwww-perl|httpclient|scrapy|httrack|nikto|sqlmap|masscan|nmap|zgrab|semrush|ahrefs|mj12bot|dotbot|petalbot|bytespider)/i;

function clientIp(req) {
    const xff = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    return xff || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

function checkRateLimit(ip) {
    const now = Date.now();
    let entry = rlMap.get(ip);
    if (!entry || entry.resetAt < now) {
        entry = { count: 0, resetAt: now + RL_WINDOW_MS };
        rlMap.set(ip, entry);
    }
    if (rlMap.size > 1000 && Math.random() < 0.02) {
        for (const [k, v] of rlMap) if (v.resetAt < now) rlMap.delete(k);
    }
    if (entry.count >= RL_MAX) {
        return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
    }
    entry.count++;
    return { ok: true };
}

// Short, opaque correlation ID. Logged server-side, sent to client only on
// 5xx so a user can quote it in a bug report without us echoing internals.
function corrId() {
    return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
}

export default async function handler(req, res) {
    const cid = corrId();

    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Browsers omit Origin on same-origin GETs, so we can only reject a
    // *present* Origin that isn't ours. Missing Origin is allowed (real users
    // on the SPA, plus preview deployments). UA filter + rate limit below do
    // the heavier lifting.
    const origin = req.headers.origin;
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    const ua = String(req.headers['user-agent'] || '');
    if (!ua || BLOCKED_UA.test(ua)) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    const ip = clientIp(req);
    const rl = checkRateLimit(ip);
    if (!rl.ok) {
        res.setHeader('Retry-After', String(rl.retryAfter));
        return res.status(429).json({ error: 'Too many requests' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error(`[api/products ${cid}] missing supabase env`);
        return res.status(500).json({ error: 'Server misconfigured', cid });
    }

    // Defense-in-depth: ensure SUPABASE_URL is a valid https Supabase host before
    // we ever fetch from it. Prevents an accidentally-misconfigured env from
    // turning this proxy into an SSRF tool against arbitrary internal hosts.
    let supabaseBase;
    try {
        supabaseBase = new URL(SUPABASE_URL);
    } catch {
        console.error(`[api/products ${cid}] SUPABASE_URL is not a valid URL`);
        return res.status(500).json({ error: 'Server misconfigured', cid });
    }
    if (supabaseBase.protocol !== 'https:' || !/\.supabase\.(co|in)$/i.test(supabaseBase.hostname)) {
        console.error(`[api/products ${cid}] SUPABASE_URL host not allowed`);
        return res.status(500).json({ error: 'Server misconfigured', cid });
    }

    const pageSize = 1000;
    let all = [];
    let offset = 0;

    try {
        while (true) {
            const base = `${supabaseBase.protocol}//${supabaseBase.host}`;
            const r = await fetch(
                `${base}/rest/v1/products?select=id,title,price,img,kakobuy,picksly,category,batch,seller&order=id.asc&limit=${pageSize}&offset=${offset}`,
                { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
            );
            if (!r.ok) {
                // Log details server-side, return generic to client.
                const body = await r.text().catch(() => '');
                console.error(`[api/products ${cid}] upstream`, r.status, body.slice(0, 500));
                return res.status(502).json({ error: 'Upstream error', cid });
            }
            const page = await r.json();
            all = all.concat(page);
            if (page.length < pageSize) break;
            offset += pageSize;
            // Safety cap so a misconfigured DB cannot loop forever.
            if (offset > 50000) break;
        }
    } catch (err) {
        console.error(`[api/products ${cid}] fetch failed`, err && err.message);
        return res.status(502).json({ error: 'Upstream error', cid });
    }

    // Long edge cache: the catalogue (~1.5 MB) changes only when the admin adds
    // products, so re-fetching it from Supabase every few seconds was burning
    // the whole bandwidth quota. 6 h fresh + 24 h stale-while-revalidate means
    // Supabase is hit a handful of times a day per edge region instead of
    // thousands. New products appear within 6 h, or instantly on a redeploy
    // (a new deployment busts the CDN cache).
    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Vary', 'Origin');
    return res.json(all);
}
