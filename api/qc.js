// Vercel Serverless Function — Picksly QC API proxy
// API key stays server-side, never exposed to client.

export default async function handler(req, res) {
    // Only GET allowed
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const { url } = req.query;
    if (!url) {
        return res.status(400).json({ success: false, error: 'Missing url parameter' });
    }

    const apiKey = process.env.PICKSLY_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ success: false, error: 'API key not configured' });
    }

    try {
        const pickslyRes = await fetch(
            `https://partner.picks.ly/api/qc/search?url=${encodeURIComponent(url)}&limit=50&page=1`,
            {
                headers: {
                    'X-API-Key': apiKey,
                    'User-Agent': 'jarvis-finder/1.0',
                },
            }
        );

        const data = await pickslyRes.json();

        // Pastreaza status code-ul original (200, 404, 429, etc.)
        return res.status(pickslyRes.status).json(data);

    } catch (err) {
        return res.status(502).json({ success: false, error: 'Upstream error' });
    }
}
