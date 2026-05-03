module.exports = async function handler(req, res) {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        return res.status(500).json({ error: 'Server misconfigured' });
    }

    const pageSize = 1000;
    let all = [];
    let offset = 0;

    try {
        while (true) {
            const r = await fetch(
                `${SUPABASE_URL}/rest/v1/products?select=title,price,img,kakobuy,picksly,category,batch&order=id.asc&limit=${pageSize}&offset=${offset}`,
                { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
            );
            if (!r.ok) throw new Error('Supabase error ' + r.status);
            const page = await r.json();
            all = all.concat(page);
            if (page.length < pageSize) break;
            offset += pageSize;
        }
    } catch (err) {
        return res.status(502).json({ error: 'Failed to fetch products' });
    }

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.setHeader('Access-Control-Allow-Origin', 'https://www.jarvis-finder.com');
    res.json(all);
};
