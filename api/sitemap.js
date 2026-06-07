// Vercel Serverless Function — XML sitemap of all product pages for Google.

const SITE = 'https://www.jarvis-finder.com';

function slugify(s) {
    return String(s || '').toLowerCase()
        .replace(/[\u{1F000}-\u{1FFFF}]/gu, '').replace(/[\u{2600}-\u{27BF}]/gu, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'item';
}
function pickslyId(picksly) {
    const m = String(picksly || '').match(/(WD|TB|AL|1688)\d+/i);
    return m ? m[0].toUpperCase() : '';
}

export default async function handler(req, res) {
    const staticUrls = ['/', '/products', '/stores', '/tutorials', '/qccheck', '/tools'];
    let products = [];
    try {
        const base = new URL(process.env.SUPABASE_URL);
        if (base.protocol === 'https:' && /\.supabase\.(co|in)$/i.test(base.hostname)) {
            const r = await fetch(
                `${base.protocol}//${base.host}/rest/v1/products?select=title,picksly,category&limit=50000`,
                { headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}` } }
            );
            if (r.ok) products = await r.json();
        }
    } catch (_) {}

    const seen = new Set();
    const items = [];
    for (const p of products) {
        const pid = pickslyId(p.picksly);
        if (!pid || seen.has(pid)) continue;
        seen.add(pid);
        const cat = slugify(p.category || 'item');
        const name = slugify(p.title || 'item');
        items.push(`${SITE}/products/${cat}/${name}-${pid}`);
    }

    const urls = staticUrls.map(u => SITE + (u === '/' ? '/' : u)).concat(items);
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        urls.map(u => `  <url><loc>${u.replace(/&/g, '&amp;')}</loc></url>`).join('\n') +
        `\n</urlset>`;

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).send(xml);
}
