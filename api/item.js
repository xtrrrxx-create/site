// Vercel Serverless Function — server-rendered product page for SEO + social
// link previews (Google, Discord, Twitter). Resolves a product from the
// Picksly ID embedded in the slug, injects per-product <title>/meta/OG/JSON-LD
// into index.html, and ships the SPA which hydrates the full detail view.
//
// URL: /products/<category>/<name-slug>-<PICKSLYID>?color=<variant>

import fs from 'fs';
import path from 'path';

const SITE = 'https://www.jarvis-finder.com';

function esc(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function stripEmojis(s) {
    return String(s ?? '')
        .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
        .replace(/[\u{2600}-\u{27BF}]/gu, '')
        .replace(/[\u{FE00}-\u{FEFF}]/gu, '')
        .replace(/️/g, '').trim();
}
function slugify(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'item';
}
// Pull the Picksly id (WD…/TB…/AL…/1688…) from the trailing slug token.
function pickslyIdFromSlug(slug) {
    const m = String(slug || '').match(/(WD|TB|AL|1688)\d+/i);
    return m ? m[0].toUpperCase() : '';
}
function titleCase(s) {
    return String(s || '').replace(/\b\w/g, c => c.toUpperCase());
}
// Square OG image through the wsrv proxy (jpg for max crawler compatibility),
// honouring any admin "#ro=&oy=&z=" framing baked into the stored img URL.
function ogImage(rawImg) {
    let u = String(rawImg || '').trim();
    if (!u) return `${SITE}/og-image.png`;
    let ro = 0;
    const h = u.indexOf('#');
    if (h >= 0) { const m = u.slice(h + 1).match(/ro=(\d+)/); if (m) ro = parseInt(m[1], 10) % 360; u = u.slice(0, h); }
    if (!/^https?:\/\//i.test(u)) return `${SITE}/og-image.png`;
    let out = `https://wsrv.nl/?url=${encodeURIComponent(u)}&w=800&h=800&fit=cover&output=jpg&q=85`;
    if (ro) out += `&ro=${ro}`;
    return out;
}

let cachedHtml = null;
async function readIndexHtml(req) {
    if (cachedHtml) return cachedHtml;
    // 1) Local file (works when Vercel bundles it via includeFiles).
    for (const p of [path.join(process.cwd(), 'index.html'), path.join(process.cwd(), 'public', 'index.html')]) {
        try { cachedHtml = fs.readFileSync(p, 'utf8'); return cachedHtml; } catch (_) {}
    }
    // 2) Fallback: fetch the static index.html from this deployment.
    try {
        const host = process.env.VERCEL_URL || (req && req.headers && req.headers.host);
        if (host) {
            const r = await fetch(`https://${host}/index.html`);
            if (r.ok) { cachedHtml = await r.text(); return cachedHtml; }
        }
    } catch (_) {}
    return null;
}

function injectMeta(html, p, color) {
    let title = stripEmojis(p.title || 'Product');
    if (color) title = `${title} ${titleCase(color)}`;
    const slug = slugify(stripEmojis(p.title || 'item'));
    const pid = pickslyIdFromSlug(p.picksly) || '';
    const cat = (p.category || '').trim();
    const catSlug = slugify(cat || 'item');
    let url = `${SITE}/products/${catSlug}/${slug}-${pid}`;
    if (color) url += `?color=${encodeURIComponent(color)}`;
    const priceCny = parseFloat(String(p.price).replace(/[^0-9.]/g, '')) || 0;
    const seller = (p.seller && !/^-?\d+$/.test(String(p.seller).trim())) ? String(p.seller).trim() : '';
    const img = ogImage(p.img);
    const pageTitle = `${title}${cat ? ' – ' + cat : ''} | Jarvis Finder`;
    const desc = `${title}${seller ? ' by ' + seller : ''} — ¥${priceCny.toFixed(0)} CNY. View QC photos and buy through your favourite agent on Jarvis Finder.`;

    const jsonld = {
        '@context': 'https://schema.org', '@type': 'Product',
        name: title, image: [img], category: cat || undefined,
        brand: seller ? { '@type': 'Brand', name: seller } : undefined,
        offers: { '@type': 'Offer', price: priceCny.toFixed(2), priceCurrency: 'CNY', availability: 'https://schema.org/InStock', url },
    };

    let out = html;
    out = out.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(pageTitle)}</title>`);
    out = out.replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i, `<meta name="description" content="${esc(desc)}" />`);
    out = out.replace(/<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i, `<link rel="canonical" href="${esc(url)}" />`);
    out = out.replace(/<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:url" content="${esc(url)}" />`);
    out = out.replace(/<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:title" content="${esc(pageTitle)}" />`);
    out = out.replace(/<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:description" content="${esc(desc)}" />`);
    out = out.replace(/<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:image" content="${esc(img)}" />`);
    out = out.replace(/<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/i, `<meta name="twitter:title" content="${esc(pageTitle)}" />`);
    out = out.replace(/<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/i, `<meta name="twitter:description" content="${esc(desc)}" />`);
    out = out.replace(/<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/?>/i, `<meta name="twitter:image" content="${esc(img)}" />`);

    // Non-executable payloads (CSP-safe: script-src 'self' allows ld+json and
    // application/json data blocks, but NOT inline executable scripts).
    const inject =
        `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>` +
        `<script type="application/json" id="jf-product-data">${JSON.stringify(p).replace(/</g, '\\u003c')}</script>` +
        `</head>`;
    return out.replace(/<\/head>/i, inject);
}

export default async function handler(req, res) {
    const slug = (req.query.path || '').toString();
    const color = (req.query.color || '').toString().slice(0, 40);
    const pid = pickslyIdFromSlug(slug);
    const html = await readIndexHtml(req);

    if (!pid || !html) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send(html || '<!doctype html><meta http-equiv="refresh" content="0;url=/">');
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
    try {
        const base = new URL(SUPABASE_URL);
        if (base.protocol !== 'https:' || !/\.supabase\.(co|in)$/i.test(base.hostname)) throw new Error('bad url');
        // Match the product whose picks.ly link contains the id.
        const r = await fetch(
            `${base.protocol}//${base.host}/rest/v1/products?select=id,title,price,img,kakobuy,picksly,category,batch,seller&picksly=ilike.*${encodeURIComponent(pid)}*&limit=1`,
            { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
        );
        const rows = r.ok ? await r.json() : [];
        const p = Array.isArray(rows) && rows[0];
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=86400');
        if (!p) return res.status(200).send(html);
        return res.status(200).send(injectMeta(html, p, color));
    } catch (e) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send(html);
    }
}
