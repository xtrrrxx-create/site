// Vercel Serverless Function — XML sitemap of all product pages for Google.

const SITE = 'https://www.jarvis-finder.com';

export default async function handler(req, res) {
    // Anti-scraping: we intentionally do NOT enumerate individual product pages
    // here. Listing every product (with its source WD/TB/AL id in the slug) is
    // exactly what lets a competitor's bot bulk-discover and copy the whole
    // catalog. Only the general/category pages are advertised to crawlers.
    const staticUrls = ['/', '/products', '/stores', '/tutorials', '/qccheck', '/tools'];

    const urls = staticUrls.map(u => SITE + (u === '/' ? '/' : u));
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        urls.map(u => `  <url><loc>${u.replace(/&/g, '&amp;')}</loc></url>`).join('\n') +
        `\n</urlset>`;

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).send(xml);
}
