export default async function handler(req, res) {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error('Missing env vars:', { url: !!SUPABASE_URL, key: !!SUPABASE_KEY });
        return res.status(500).json({ error: 'Server misconfigured' });
    }

    try {
        const r = await fetch(
            `${SUPABASE_URL}/rest/v1/products?select=title,price,img,kakobuy,picksly,category,batch&order=id.asc&limit=1000`,
            { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
        );

        if (!r.ok) {
            const body = await r.text();
            console.error('Supabase error:', r.status, body);
            return res.status(502).json({ error: 'Supabase error', status: r.status, body });
        }

        const data = await r.json();
        res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
        return res.json(data);

    } catch (err) {
        console.error('Fetch error:', err.message);
        return res.status(502).json({ error: err.message });
    }
}
