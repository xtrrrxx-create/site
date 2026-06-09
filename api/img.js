// Vercel Serverless Function — watermarking image proxy.
//
// Fetches a product image from an allow-listed CDN, resizes / rotates it, and
// bakes a tiled "https://www.jarvis-finder.com/" watermark INTO the pixels
// before serving webp. Anyone who copies the image (right-click save, scrape,
// hotlink) gets the watermark with it. The dense tiling survives cropping.
//
// GET /api/img?url=<encoded original>&w=<width>&ro=<degrees>
//
// Edge-cached aggressively: each (url,w,ro) is processed once, then served
// from Vercel's cache, so the sharp work happens at most once per variant.

import sharp from 'sharp';
import { WM_PATH, WM_W, WM_H } from './_wm-path.js';

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

const MAX_W = 1000;

function hostAllowed(hostname) {
    const h = String(hostname || '').toLowerCase();
    return ALLOWED_HOST_SUFFIX.some(s => h === s || h.endsWith('.' + s));
}

// Tiled watermark sized to the final image, matching the watermark.ws preview:
// white wordmark at ~20% opacity, soft black drop shadow, repeated in staggered
// horizontal rows. Uses the pre-vectorised path (no server fonts needed).
function watermarkSvg(width, height) {
    // ~3 wordmarks across the image.
    const s = (width * 0.30) / WM_W;
    const textW = WM_W * s;
    const textH = WM_H * s;
    const gapX = Math.round(width * 0.05);
    const gapY = Math.round(textH * 0.9);
    const tileW = Math.round(textW + gapX);
    const rowH = Math.round(textH + gapY);
    const tileH = rowH * 2; // two rows so we can stagger (brick) the second one

    const word = (tx, ty) =>
        `<g transform="translate(${tx.toFixed(1)} ${ty.toFixed(1)}) scale(${s.toFixed(4)})"><path d="${WM_PATH}"/></g>`;

    const y1 = Math.round(gapY / 2);
    const y2 = rowH + y1;
    const half = Math.round(tileW / 2);

    return Buffer.from(
        `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <filter id="sh" x="-10%" y="-10%" width="120%" height="130%">
                    <feDropShadow dx="0" dy="3" stdDeviation="2.2"
                                  flood-color="black" flood-opacity="0.55"/>
                </filter>
                <pattern id="wm" width="${tileW}" height="${tileH}" patternUnits="userSpaceOnUse"
                         patternTransform="rotate(-30)">
                    <g fill="#ffffff" fill-opacity="0.10" filter="url(#sh)">
                        ${word(0, y1)}
                        ${word(half, y2)}
                        ${word(half - tileW, y2)}
                    </g>
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
