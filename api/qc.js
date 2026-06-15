// Vercel Serverless Function — Picksly QC API proxy.
// API key stays server-side. Host allowlist + origin check + method allowlist
// to prevent abuse of paid Picksly quota by third parties.

const ALLOWED_ORIGINS = new Set([
    'https://jarvis-finder.com',
    'https://www.jarvis-finder.com',
]);

// Hostnames whose product URLs we are willing to forward to Picksly.
// Suffix match only — `weidian.com.evil.tld` will NOT pass.
const ALLOWED_HOST_SUFFIXES = [
    'taobao.com',
    'tmall.com',
    'weidian.com',
    '1688.com',
    'kakobuy.com',
    'cnfans.com',
    'hipobuy.com',
    'acbuy.com',
    'mulebuy.com',
    'sugargoo.com',
    'cssbuy.com',
    'joyagoo.com',
    'oopbuy.com',
    'litbuy.com',
    'gtbuy.com',
    'allchinabuy.com',
    'superbuy.com',
    'pandabuy.com',
    'wegobuy.com',
];

function hostAllowed(hostname) {
    const h = String(hostname || '').toLowerCase();
    return ALLOWED_HOST_SUFFIXES.some(s => h === s || h.endsWith('.' + s));
}

// Kakobuy short-link domains (e.g. https://ikako.vip/xtdn3). These 30x-redirect
// to a full kakobuy.com product URL. We follow the redirect server-side (the
// browser can't — CORS) and forward the resolved URL instead.
const SHORTENER_HOSTS = new Set(['ikako.vip']);

function isShortener(hostname) {
    const h = String(hostname || '').toLowerCase().replace(/^www\./, '');
    return SHORTENER_HOSTS.has(h);
}

// Resolve a short link to its final destination by following redirects, then
// return the final URL. Returns null on failure.
async function resolveShortLink(u) {
    try {
        const r = await fetch(u, {
            redirect: 'follow',
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; jarvis-finder/1.0)' },
        });
        return r.url || null;
    } catch {
        return null;
    }
}

// In-memory rate limiter. Vercel reuses warm function instances so the Map
// persists across invocations on the same instance. NOT shared across regions
// or cold starts — that means a determined attacker can scale past it by
// hitting many regions, but it's enough to stop a single misbehaving script
// from burning through Picksly quota in a tight loop. For a stronger global
// limit we'd need Vercel KV / Upstash Redis (paid).
const RL_WINDOW_MS = 5 * 60 * 1000;       // 5 minutes
const RL_MAX_PER_WINDOW = 60;             // 60 requests / IP / 5 min
const RL_BURST_WINDOW_MS = 10 * 1000;     // 10 second burst window
const RL_BURST_MAX = 10;                  // max 10 requests in any 10s
const rlMap = new Map();                  // ip -> { count, resetAt, burst, burstResetAt }

// UA filter — same as /api/products. Not security, just friction for dumb bots.
const BLOCKED_UA = /(curl|wget|python-requests|libwww-perl|httpclient|scrapy|httrack|nikto|sqlmap|masscan|nmap|zgrab|semrush|ahrefs|mj12bot|dotbot|petalbot|bytespider)/i;

function corrId() {
    return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
}

function clientIp(req) {
    // x-forwarded-for: original client IP first, comma-separated
    const xff = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    return xff || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

function checkRateLimit(ip) {
    const now = Date.now();
    let entry = rlMap.get(ip);
    if (!entry) {
        entry = { count: 0, resetAt: now + RL_WINDOW_MS, burst: 0, burstResetAt: now + RL_BURST_WINDOW_MS };
        rlMap.set(ip, entry);
    }
    if (entry.resetAt < now) {
        entry.count = 0;
        entry.resetAt = now + RL_WINDOW_MS;
    }
    if (entry.burstResetAt < now) {
        entry.burst = 0;
        entry.burstResetAt = now + RL_BURST_WINDOW_MS;
    }
    // Opportunistic cleanup so the map doesn't grow forever — sweep on every
    // 50th call. Keeps memory bounded on warm instances over long uptimes.
    if (rlMap.size > 1000 && Math.random() < 0.02) {
        for (const [k, v] of rlMap) {
            if (v.resetAt < now && v.burstResetAt < now) rlMap.delete(k);
        }
    }
    if (entry.burst >= RL_BURST_MAX) {
        return { ok: false, retryAfter: Math.ceil((entry.burstResetAt - now) / 1000) };
    }
    if (entry.count >= RL_MAX_PER_WINDOW) {
        return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
    }
    entry.count++;
    entry.burst++;
    return { ok: true, remaining: RL_MAX_PER_WINDOW - entry.count };
}

export default async function handler(req, res) {
    const cid = corrId();

    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const ua = String(req.headers['user-agent'] || '');
    if (!ua || BLOCKED_UA.test(ua)) {
        return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    // Origin check — reject browser fetches from other sites.
    // Modern browsers always send Sec-Fetch-Site; Origin is only sent for
    // cross-origin or non-GET. So we accept the request when ANY of:
    //   - Sec-Fetch-Site is same-origin / same-site / none (our own page)
    //   - Origin is in our allowlist (cross-origin from our domain — rare)
    //   - Referer is on our domain (legacy browsers)
    // Cross-site browser fetches (Sec-Fetch-Site: cross-site) are blocked.
    const sfs = req.headers['sec-fetch-site'];
    const origin = req.headers.origin;
    const referer = req.headers.referer || '';
    const sameSite = sfs === 'same-origin' || sfs === 'same-site' || sfs === 'none';
    const originOk = origin && ALLOWED_ORIGINS.has(origin);
    const refererOk = referer.startsWith('https://jarvis-finder.com/') ||
                      referer.startsWith('https://www.jarvis-finder.com/');
    if (!(sameSite || originOk || refererOk)) {
        return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    // Rate limit by client IP. Pre-validation so a flood of bad URLs still
    // counts toward the cap — otherwise an attacker could probe for free.
    const ip = clientIp(req);
    const rl = checkRateLimit(ip);
    if (!rl.ok) {
        res.setHeader('Retry-After', String(rl.retryAfter));
        return res.status(429).json({ success: false, error: 'Too many requests', retryAfter: rl.retryAfter });
    }
    res.setHeader('X-RateLimit-Remaining', String(rl.remaining));

    const { url } = req.query;
    if (!url || typeof url !== 'string') {
        return res.status(400).json({ success: false, error: 'Missing url parameter' });
    }
    if (url.length > 2048) {
        return res.status(400).json({ success: false, error: 'URL too long' });
    }

    // Validate the URL: must be http(s) and the hostname must be on the allowlist.
    let parsed;
    try {
        parsed = new URL(url);
    } catch {
        return res.status(400).json({ success: false, error: 'Invalid URL' });
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return res.status(400).json({ success: false, error: 'Invalid URL' });
    }

    // Kakobuy short link (ikako.vip/…) → follow the redirect to the real URL.
    if (isShortener(parsed.hostname)) {
        const resolved = await resolveShortLink(parsed.toString());
        let rp;
        try { rp = resolved ? new URL(resolved) : null; } catch { rp = null; }
        if (!rp || (rp.protocol !== 'http:' && rp.protocol !== 'https:') || isShortener(rp.hostname)) {
            return res.status(400).json({ success: false, error: 'Could not resolve short link' });
        }
        parsed = rp;
    }

    if (!hostAllowed(parsed.hostname)) {
        return res.status(400).json({ success: false, error: 'Unsupported host' });
    }

    const apiKey = process.env.PICKSLY_API_KEY;
    if (!apiKey) {
        console.error(`[api/qc ${cid}] PICKSLY_API_KEY not set`);
        return res.status(500).json({ success: false, error: 'Server misconfigured', cid });
    }

    try {
        // Strip embedded credentials and fragment before forwarding upstream.
        // - Credentials would otherwise show up in Picksly logs and pollute
        //   the cache key (`s-maxage=600`) with attacker-chosen variants.
        // - Fragments are not used by Picksly and are pure cache-buster fuel.
        parsed.username = '';
        parsed.password = '';
        parsed.hash = '';
        const cleanUrl = parsed.toString();
        const pickslyRes = await fetch(
            `https://partner.picks.ly/api/qc/search?url=${encodeURIComponent(cleanUrl)}&limit=50&page=1`,
            {
                headers: {
                    'X-API-Key': apiKey,
                    'User-Agent': 'jarvis-finder/1.0',
                },
            }
        );

        // Forward Picksly's own structured response (status 200/404/etc).
        // Picksly's payloads are public-product data, safe to expose. We do not
        // forward any of our own headers or env data.
        const data = await pickslyRes.json().catch(() => ({ success: false, error: 'Upstream error' }));
        // Echo back the URL we actually forwarded (after short-link resolution) so
        // the client can derive the picks.ly / Buy Now links for short/agent links.
        if (data && typeof data === 'object') data.resolvedUrl = cleanUrl;
        res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1800');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Vary', 'Origin');
        return res.status(pickslyRes.status).json(data);

    } catch (err) {
        console.error(`[api/qc ${cid}] upstream failed`, err && err.message);
        return res.status(502).json({ success: false, error: 'Upstream error', cid });
    }
}
