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

const MAX_W = 1000;

// "jarvis-finder.com" pre-converted to a vector path (Arial Bold, fontSize 100,
// natural box ~806x112). Baked in so the server needs NO fonts installed —
// Vercel has none, which otherwise renders SVG <text> as tofu boxes.
const WM_PATH = 'M20.61 31.64L6.88 31.64L6.88 18.95L20.61 18.95L20.61 31.64ZM6.88 38.67L20.61 38.67L20.61 88.92Q20.61 98.83 19.31 102.91Q18.02 106.98 14.33 109.28Q10.64 111.57 4.93 111.57L4.93 111.57Q2.88 111.57 0.51 111.21Q-1.86 110.84-4.59 110.11L-4.59 110.11L-2.20 98.39Q-1.22 98.58-0.37 98.71Q0.49 98.83 1.22 98.83L1.22 98.83Q3.32 98.83 4.66 97.92Q6.01 97.02 6.45 95.75Q6.88 94.48 6.88 88.13L6.88 88.13L6.88 38.67ZM45.21 54.49L45.21 54.49L32.76 52.25Q34.86 44.73 39.99 41.11Q45.12 37.50 55.22 37.50L55.22 37.50Q64.40 37.50 68.90 39.67Q73.39 41.85 75.22 45.19Q77.05 48.54 77.05 57.47L77.05 57.47L76.90 73.49Q76.90 80.32 77.56 83.57Q78.22 86.82 80.03 90.53L80.03 90.53L66.46 90.53Q65.92 89.16 65.14 86.47L65.14 86.47Q64.79 85.25 64.65 84.86L64.65 84.86Q61.13 88.28 57.13 89.99Q53.13 91.70 48.58 91.70L48.58 91.70Q40.58 91.70 35.96 87.35Q31.35 83.01 31.35 76.37L31.35 76.37Q31.35 71.97 33.45 68.53Q35.55 65.09 39.33 63.26Q43.12 61.43 50.24 60.06L50.24 60.06Q59.86 58.25 63.57 56.69L63.57 56.69L63.57 55.32Q63.57 51.37 61.62 49.68Q59.67 48.00 54.25 48.00L54.25 48.00Q50.59 48.00 48.54 49.44Q46.48 50.88 45.21 54.49ZM63.57 68.36L63.57 65.63Q60.94 66.50 55.22 67.72Q49.51 68.95 47.75 70.12L47.75 70.12Q45.07 72.02 45.07 74.95L45.07 74.95Q45.07 77.83 47.22 79.93Q49.37 82.03 52.69 82.03L52.69 82.03Q56.40 82.03 59.77 79.59L59.77 79.59Q62.26 77.73 63.04 75.05L63.04 75.05Q63.57 73.29 63.57 68.36L63.57 68.36ZM103.71 74.51L103.71 90.53L89.99 90.53L89.99 38.67L102.73 38.67L102.73 46.04Q106.01 40.82 108.62 39.16Q111.23 37.50 114.55 37.50L114.55 37.50Q119.24 37.50 123.58 40.09L123.58 40.09L119.34 52.05Q115.87 49.80 112.89 49.80L112.89 49.80Q110.01 49.80 108.01 51.39Q106.01 52.98 104.86 57.13Q103.71 61.28 103.71 74.51L103.71 74.51ZM156.10 90.53L143.75 90.53L122.85 38.67L137.26 38.67L147.02 65.14L149.85 73.97Q150.98 70.61 151.27 69.53L151.27 69.53Q151.95 67.33 152.73 65.14L152.73 65.14L162.60 38.67L176.71 38.67L156.10 90.53ZM198.83 31.64L185.11 31.64L185.11 18.95L198.83 18.95L198.83 31.64ZM198.83 90.53L185.11 90.53L185.11 38.67L198.83 38.67L198.83 90.53ZM208.06 75.73L208.06 75.73L221.83 73.63Q222.71 77.64 225.39 79.71Q228.08 81.79 232.91 81.79L232.91 81.79Q238.23 81.79 240.92 79.83L240.92 79.83Q242.72 78.47 242.72 76.17L242.72 76.17Q242.72 74.61 241.75 73.58L241.75 73.58Q240.72 72.61 237.16 71.78L237.16 71.78Q220.56 68.12 216.11 65.09L216.11 65.09Q209.96 60.89 209.96 53.42L209.96 53.42Q209.96 46.68 215.28 42.09Q220.61 37.50 231.79 37.50L231.79 37.50Q242.43 37.50 247.61 40.97Q252.78 44.43 254.74 51.22L254.74 51.22L241.80 53.61Q240.97 50.59 238.65 48.97Q236.33 47.36 232.03 47.36L232.03 47.36Q226.61 47.36 224.27 48.88L224.27 48.88Q222.71 49.95 222.71 51.66L222.71 51.66Q222.71 53.13 224.07 54.15L224.07 54.15Q225.93 55.52 236.89 58.01Q247.85 60.50 252.20 64.11L252.20 64.11Q256.49 67.77 256.49 74.32L256.49 74.32Q256.49 81.45 250.54 86.57Q244.58 91.70 232.91 91.70L232.91 91.70Q222.31 91.70 216.14 87.40Q209.96 83.11 208.06 75.73ZM293.90 71.44L266.94 71.44L266.94 57.71L293.90 57.71L293.90 71.44ZM295.80 49.46L295.80 38.67L303.42 38.67L303.42 34.77Q303.42 28.22 304.81 25Q306.20 21.78 309.94 19.75Q313.67 17.72 319.38 17.72L319.38 17.72Q325.24 17.72 330.86 19.48L330.86 19.48L329.00 29.05Q325.73 28.27 322.71 28.27L322.71 28.27Q319.73 28.27 318.43 29.66Q317.14 31.05 317.14 35.01L317.14 35.01L317.14 38.67L327.39 38.67L327.39 49.46L317.14 49.46L317.14 90.53L303.42 90.53L303.42 49.46L295.80 49.46ZM348.83 31.64L335.11 31.64L335.11 18.95L348.83 18.95L348.83 31.64ZM348.83 90.53L335.11 90.53L335.11 38.67L348.83 38.67L348.83 90.53ZM410.06 58.30L410.06 90.53L396.34 90.53L396.34 64.06Q396.34 55.66 395.46 53.20Q394.58 50.73 392.60 49.37Q390.63 48.00 387.84 48.00L387.84 48.00Q384.28 48.00 381.45 49.95Q378.61 51.90 377.56 55.13Q376.51 58.35 376.51 67.04L376.51 67.04L376.51 90.53L362.79 90.53L362.79 38.67L375.54 38.67L375.54 46.29Q382.32 37.50 392.63 37.50L392.63 37.50Q397.17 37.50 400.93 39.14Q404.69 40.77 406.62 43.31Q408.54 45.85 409.30 49.07Q410.06 52.29 410.06 58.30L410.06 58.30ZM471.53 18.95L471.53 90.53L458.79 90.53L458.79 82.91Q455.62 87.35 451.29 89.53Q446.97 91.70 442.58 91.70L442.58 91.70Q433.64 91.70 427.27 84.50Q420.90 77.29 420.90 64.40L420.90 64.40Q420.90 51.22 427.10 44.36Q433.30 37.50 442.77 37.50L442.77 37.50Q451.46 37.50 457.81 44.73L457.81 44.73L457.81 18.95L471.53 18.95ZM434.91 63.48L434.91 63.48Q434.91 71.78 437.21 75.49L437.21 75.49Q440.53 80.86 446.48 80.86L446.48 80.86Q451.22 80.86 454.54 76.83Q457.86 72.80 457.86 64.79L457.86 64.79Q457.86 55.86 454.64 51.93Q451.42 48.00 446.39 48.00L446.39 48.00Q441.50 48.00 438.21 51.88Q434.91 55.76 434.91 63.48ZM515.09 74.02L515.09 74.02L528.76 76.32Q526.12 83.84 520.43 87.77Q514.75 91.70 506.20 91.70L506.20 91.70Q492.68 91.70 486.18 82.86L486.18 82.86Q481.05 75.78 481.05 64.99L481.05 64.99Q481.05 52.10 487.79 44.80Q494.53 37.50 504.83 37.50L504.83 37.50Q516.41 37.50 523.10 45.14Q529.79 52.78 529.49 68.55L529.49 68.55L495.12 68.55Q495.26 74.66 498.44 78.05Q501.61 81.45 506.35 81.45L506.35 81.45Q509.57 81.45 511.77 79.69Q513.96 77.93 515.09 74.02ZM495.36 60.16L515.87 60.16Q515.72 54.20 512.79 51.10Q509.86 48.00 505.66 48.00L505.66 48.00Q501.17 48.00 498.24 51.27L498.24 51.27Q495.31 54.54 495.36 60.16L495.36 60.16ZM553.81 74.51L553.81 90.53L540.09 90.53L540.09 38.67L552.83 38.67L552.83 46.04Q556.10 40.82 558.72 39.16Q561.33 37.50 564.65 37.50L564.65 37.50Q569.34 37.50 573.68 40.09L573.68 40.09L569.43 52.05Q565.97 49.80 562.99 49.80L562.99 49.80Q560.11 49.80 558.11 51.39Q556.10 52.98 554.96 57.13Q553.81 61.28 553.81 74.51L553.81 74.51ZM593.31 90.53L579.59 90.53L579.59 76.81L593.31 76.81L593.31 90.53ZM652.59 54.00L652.59 54.00L639.06 56.45Q638.38 52.39 635.96 50.34Q633.54 48.29 629.69 48.29L629.69 48.29Q624.56 48.29 621.51 51.83Q618.46 55.37 618.46 63.67L618.46 63.67Q618.46 72.90 621.56 76.71Q624.66 80.52 629.88 80.52L629.88 80.52Q633.79 80.52 636.28 78.30Q638.77 76.07 639.79 70.65L639.79 70.65L653.27 72.95Q651.17 82.23 645.21 86.96Q639.26 91.70 629.25 91.70L629.25 91.70Q617.87 91.70 611.11 84.52Q604.35 77.34 604.35 64.65L604.35 64.65Q604.35 51.81 611.13 44.65Q617.92 37.50 629.49 37.50L629.49 37.50Q638.96 37.50 644.56 41.58Q650.15 45.65 652.59 54.00ZM659.81 63.87L659.81 63.87Q659.81 57.03 663.18 50.63Q666.55 44.24 672.73 40.87Q678.91 37.50 686.52 37.50L686.52 37.50Q698.29 37.50 705.81 45.14Q713.33 52.78 713.33 64.45L713.33 64.45Q713.33 76.22 705.74 83.96Q698.14 91.70 686.62 91.70L686.62 91.70Q679.49 91.70 673.02 88.48Q666.55 85.25 663.18 79.03Q659.81 72.80 659.81 63.87ZM673.88 64.60L673.88 64.60Q673.88 72.31 677.54 76.42Q681.20 80.52 686.57 80.52L686.57 80.52Q691.94 80.52 695.58 76.42Q699.22 72.31 699.22 64.50L699.22 64.50Q699.22 56.88 695.58 52.78Q691.94 48.68 686.57 48.68L686.57 48.68Q681.20 48.68 677.54 52.78Q673.88 56.88 673.88 64.60ZM723.05 90.53L723.05 38.67L735.69 38.67L735.69 45.75Q742.48 37.50 751.86 37.50L751.86 37.50Q756.84 37.50 760.50 39.55Q764.16 41.60 766.50 45.75L766.50 45.75Q769.92 41.60 773.88 39.55Q777.83 37.50 782.32 37.50L782.32 37.50Q788.04 37.50 791.99 39.82Q795.95 42.14 797.90 46.63L797.90 46.63Q799.32 49.95 799.32 57.37L799.32 57.37L799.32 90.53L785.60 90.53L785.60 60.89Q785.60 53.17 784.18 50.93L784.18 50.93Q782.28 48.00 778.32 48.00L778.32 48.00Q775.44 48.00 772.90 49.76Q770.36 51.51 769.24 54.91Q768.12 58.30 768.12 65.63L768.12 65.63L768.12 90.53L754.39 90.53L754.39 62.11Q754.39 54.54 753.66 52.34Q752.93 50.15 751.39 49.07Q749.85 48.00 747.22 48.00L747.22 48.00Q744.04 48.00 741.50 49.71Q738.96 51.42 737.87 54.64Q736.77 57.86 736.77 65.33L736.77 65.33L736.77 90.53L723.05 90.53Z';
const WM_W = 806;

function hostAllowed(hostname) {
    const h = String(hostname || '').toLowerCase();
    return ALLOWED_HOST_SUFFIX.some(s => h === s || h.endsWith('.' + s));
}

// Tiled diagonal watermark sized to the final image. Uses the pre-vectorised
// wordmark (no fonts needed). Semi-transparent white fill + faint dark stroke
// so it stays legible on light and dark photos.
function watermarkSvg(width, height) {
    const targetW = Math.max(70, Math.round(width / 2.2)); // one wordmark ~half the image wide
    const s = targetW / WM_W;                              // scale of the 806-wide path
    const tileW = Math.round(targetW * 1.35);
    const tileH = Math.round(targetW * 0.95);
    return Buffer.from(
        `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <pattern id="wm" width="${tileW}" height="${tileH}" patternUnits="userSpaceOnUse"
                         patternTransform="rotate(-30)">
                    <g transform="translate(6 ${Math.round(tileH * 0.35)}) scale(${s.toFixed(4)})"
                       fill="rgba(255,255,255,0.34)"
                       stroke="rgba(0,0,0,0.20)" stroke-width="${(0.8 / s).toFixed(2)}">
                        <path d="${WM_PATH}"/>
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
