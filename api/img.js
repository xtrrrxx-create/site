// Vercel Serverless Function — watermarking image proxy.
//
// Fetches a product image from an allow-listed CDN, resizes / rotates it, and
// bakes a tiled "jarvis-finder.com" watermark INTO the pixels before serving
// webp. Anyone who copies the image (right-click save, scrape, hotlink) gets
// the watermark with it. The diagonal tiled pattern survives cropping.
//
// GET /api/img?url=<encoded original>&w=<width>&ro=<degrees>
//
// Edge-cached aggressively: each (url,w,ro) is processed once, then served
// from Vercel's cache, so the sharp work happens at most once per variant.

import sharp from 'sharp';

// Only proxy images from CDNs we actually use. Prevents this endpoint from
// being turned into a generic SSRF/processing tool against arbitrary hosts.
const ALLOWED_HOST_SUFFIX = [
    'geilicdn.com',     // Weidian
    'kakobuy.com',      // Kakobuy storage
    'alicdn.com',       // Taobao / 1688
    'acbuy.com',        // AcBuy
    'supabase.co',      // our own QC-image bucket
    'picks.ly',
];

const WATERMARK_TEXT = 'jarvis-finder.com';
const MAX_W = 1000;

function hostAllowed(hostname) {
    const h = String(hostname || '').toLowerCase();
    return ALLOWED_HOST_SUFFIX.some(s => h === s || h.endsWith('.' + s));
}

// Tiled diagonal watermark sized to the final image. Semi-transparent white
// text with a faint dark stroke so it stays legible on light and dark photos.
function watermarkSvg(width, height) {
    const fontSize = Math.max(13, Math.round(width / 22));
    const tile = fontSize * 11; // spacing between repeats
    return Buffer.from(
        `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <pattern id="wm" width="${tile}" height="${tile}" patternUnits="userSpaceOnUse"
                         patternTransform="rotate(-30)">
                    <text x="0" y="${Math.round(tile / 2)}"
                          font-family="Arial, Helvetica, sans-serif"
                          font-size="${fontSize}" font-weight="700"
                          fill="rgba(255,255,255,0.30)"
                          stroke="rgba(0,0,0,0.18)" stroke-width="0.6">${WATERMARK_TEXT}</text>
                </pattern>
            </defs>
            <rect width="${width}" height="${height}" fill="url(#wm)"/>
        </svg>`
    );
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const raw = String(req.query.url || '');
    if (!raw) return res.status(400).json({ error: 'Missing url' });

    let target;
    try {
        target = new URL(raw);
    } catch {
        return res.status(400).json({ error: 'Bad url' });
    }
    if (target.protocol !== 'https:' || !hostAllowed(target.hostname)) {
        return res.status(403).json({ error: 'Forbidden host' });
    }

    const width = Math.max(80, Math.min(MAX_W, parseInt(req.query.w, 10) || 460));
    const ro = ((parseInt(req.query.ro, 10) || 0) % 360 + 360) % 360;

    try {
        const upstream = await fetch(target.toString(), {
            headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'image/*' },
        });
        if (!upstream.ok) return res.status(502).json({ error: 'Upstream error' });
        const input = Buffer.from(await upstream.arrayBuffer());

        let pipeline = sharp(input, { failOn: 'none' });
        if (ro) pipeline = pipeline.rotate(ro, { background: { r: 255, g: 255, b: 255, alpha: 1 } });
        pipeline = pipeline.resize({ width, withoutEnlargement: true });

        // Need final dimensions to size the watermark layer.
        const resized = await pipeline.toBuffer();
        const meta = await sharp(resized).metadata();
        const out = await sharp(resized)
            .composite([{ input: watermarkSvg(meta.width, meta.height), blend: 'over' }])
            .webp({ quality: 82 })
            .toBuffer();

        res.setHeader('Content-Type', 'image/webp');
        res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        return res.status(200).send(out);
    } catch (err) {
        console.error('[api/img] failed', err && err.message);
        return res.status(502).json({ error: 'Image error' });
    }
}
