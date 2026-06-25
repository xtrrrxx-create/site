// Vercel Serverless Function — seller-name translation proxy.
// The frontend can't call Google's gtx endpoint directly (CORS), so we proxy it
// server-to-server here. Chinese seller names come in newline-joined via ?q=,
// we translate zh-CN → en and return the lines. Results are edge-cached for a
// long time (names are stable), so each distinct batch hits Google at most a
// handful of times per region.

const ALLOWED_ORIGINS = new Set([
    'https://jarvis-finder.com',
    'https://www.jarvis-finder.com',
]);

const BLOCKED_UA = /(curl|wget|python-requests|libwww-perl|httpclient|scrapy|httrack|nikto|sqlmap|masscan|nmap|zgrab|semrush|ahrefs|mj12bot|dotbot|petalbot|bytespider)/i;

// Guardrails so a single request can't be abused as an open translation relay.
const MAX_CHARS = 4000;   // ~40 seller names per batch, comfortably
const MAX_LINES = 60;

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
    if (!ua || BLOCKED_UA.test(ua)) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    const q = String(req.query.q || '');
    if (!q.trim()) return res.status(400).json({ error: 'Missing q' });
    if (q.length > MAX_CHARS || q.split('\n').length > MAX_LINES) {
        return res.status(413).json({ error: 'Batch too large' });
    }

    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=zh-CN&tl=en&dt=t&q=${encodeURIComponent(q)}`;
        const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!r.ok) return res.status(502).json({ error: 'Upstream error' });
        const data = await r.json();
        const text = (data[0] || []).map(seg => seg[0]).join('');
        const lines = text.split('\n');

        // Names are stable → cache aggressively at the edge (30d fresh, 1y SWR).
        res.setHeader('Cache-Control', 's-maxage=2592000, stale-while-revalidate=31536000');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Vary', 'Origin');
        return res.json({ lines });
    } catch (err) {
        return res.status(502).json({ error: 'Upstream error' });
    }
}
