// Vercel Serverless Function — Supabase products proxy.
// Hides anon key from frontend. Read-only, GET only, generic errors.

const ALLOWED_ORIGINS = new Set([
    'https://jarvis-finder.com',
    'https://www.jarvis-finder.com',
]);

export default async function handler(req, res) {
    // Method allowlist — only GET allowed.
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Soft origin check: if a browser sends an Origin header, it must be ours.
    // Direct curl/server-to-server has no Origin and is allowed (this is a public
    // catalog), but cross-site browser fetches from other domains are rejected.
    const origin = req.headers.origin;
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error('[api/products] missing supabase env');
        return res.status(500).json({ error: 'Server misconfigured' });
    }

    // Defense-in-depth: ensure SUPABASE_URL is a valid https Supabase host before
    // we ever fetch from it. Prevents an accidentally-misconfigured env from
    // turning this proxy into an SSRF tool against arbitrary internal hosts.
    let supabaseBase;
    try {
        supabaseBase = new URL(SUPABASE_URL);
    } catch {
        console.error('[api/products] SUPABASE_URL is not a valid URL');
        return res.status(500).json({ error: 'Server misconfigured' });
    }
    if (supabaseBase.protocol !== 'https:' || !/\.supabase\.(co|in)$/i.test(supabaseBase.hostname)) {
        console.error('[api/products] SUPABASE_URL host not allowed');
        return res.status(500).json({ error: 'Server misconfigured' });
    }

    const pageSize = 1000;
    let all = [];
    let offset = 0;

    try {
        while (true) {
            const base = `${supabaseBase.protocol}//${supabaseBase.host}`;
            const r = await fetch(
                `${base}/rest/v1/products?select=title,price,img,kakobuy,picksly,category,batch&order=id.asc&limit=${pageSize}&offset=${offset}`,
                { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
            );
            if (!r.ok) {
                // Log details server-side, return generic to client.
                const body = await r.text().catch(() => '');
                console.error('[api/products] upstream error', r.status, body.slice(0, 500));
                return res.status(502).json({ error: 'Upstream error' });
            }
            const page = await r.json();
            all = all.concat(page);
            if (page.length < pageSize) break;
            offset += pageSize;
            // Safety cap so a misconfigured DB cannot loop forever.
            if (offset > 50000) break;
        }
    } catch (err) {
        console.error('[api/products] fetch failed', err && err.message);
        return res.status(502).json({ error: 'Upstream error' });
    }

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Vary', 'Origin');
    return res.json(all);
}
