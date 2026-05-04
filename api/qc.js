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

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ success: false, error: 'Method not allowed' });
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
    if (!hostAllowed(parsed.hostname)) {
        return res.status(400).json({ success: false, error: 'Unsupported host' });
    }

    const apiKey = process.env.PICKSLY_API_KEY;
    if (!apiKey) {
        console.error('[api/qc] PICKSLY_API_KEY not set');
        return res.status(500).json({ success: false, error: 'Server misconfigured' });
    }

    try {
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
        res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1800');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        return res.status(pickslyRes.status).json(data);

    } catch (err) {
        console.error('[api/qc] upstream failed', err && err.message);
        return res.status(502).json({ success: false, error: 'Upstream error' });
    }
}
