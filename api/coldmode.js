// Vercel Serverless Function — Coldmode admin backend.
// The Coldmode admin runs from file:// (Origin: null) and can't call picks.ly /
// Google Translate directly (CORS), so we proxy server-to-server here.
//
//   ?action=lookup&link=<raw marketplace / agent / doppel / picks.ly link>
//        → { marketplace, id, price, seller (EN), sales, weight,
//            buy_link (raw marketplace), qc_link (doppel.fit) }
//   ?action=translate&q=<text>            → { text }  (zh → en)
//
// CORS is open ('*') — these are non-sensitive read-only lookups.

const BLOCKED_UA = /(curl|wget|python-requests|libwww-perl|httpclient|scrapy|httrack|nikto|sqlmap|masscan|nmap|zgrab|semrush|ahrefs|mj12bot|dotbot|petalbot|bytespider)/i;

const PICKSLY_MK = { WD: 'weidian', TB: 'taobao', AL: '1688' };
// doppel.fit item path marketplace names.
const DOPPEL_MP  = { WD: 'WEIDIAN', TB: 'TAOBAO', AL: '1688' };

// Raw marketplace URL from a prefix + id.
function marketplaceUrl(pfx, id) {
    if (pfx === 'WD') return `https://weidian.com/item.html?itemID=${id}`;
    if (pfx === 'TB') return `https://item.taobao.com/item.htm?id=${id}`;
    if (pfx === 'AL') return `https://detail.1688.com/offer/${id}.html`;
    return '';
}
const doppelUrl = (pfx, id) => `https://doppel.fit/item/${DOPPEL_MP[pfx]}/${id}`;

// Derive { pfx: WD|TB|AL, id } from a marketplace / agent / doppel / picks.ly link.
function deriveItem(link) {
    link = String(link || '');
    let m = link.match(/(?:picks\.ly|doppel\.fit)\/item\/(WD|TB|AL|1688|WEIDIAN|TAOBAO)(?:\/|)(\d+)/i);
    if (m) {
        let p = m[1].toUpperCase();
        if (p === '1688') p = 'AL';
        if (p === 'WEIDIAN') p = 'WD';
        if (p === 'TAOBAO') p = 'TB';
        return { pfx: p, id: m[2] };
    }
    // doppel.fit/item/WEIDIAN/123 style (slash-separated marketplace)
    m = link.match(/doppel\.fit\/item\/(WEIDIAN|TAOBAO|1688)\/(\d+)/i);
    if (m) {
        const map = { WEIDIAN: 'WD', TAOBAO: 'TB', '1688': 'AL' };
        return { pfx: map[m[1].toUpperCase()], id: m[2] };
    }
    try {
        const u = new URL(link);
        const q = u.searchParams;
        const nested = q.get('url') || q.get('link') || q.get('u') || q.get('target');
        const src = nested ? decodeURIComponent(nested) : link;
        let mm = src.match(/itemI[dD]=(\d+)/);                    if (mm) return { pfx: 'WD', id: mm[1] };
        mm = src.match(/(?:taobao|tmall)\.com[^]*?[?&]id=(\d+)/i); if (mm) return { pfx: 'TB', id: mm[1] };
        mm = src.match(/(?:1688\.com\/offer\/|\/offer\/)(\d+)/i);  if (mm) return { pfx: 'AL', id: mm[1] };
        const shop = (q.get('source') || q.get('platform') || q.get('shop_type') || q.get('shopType') || '').toUpperCase();
        const id = q.get('id') || q.get('itemID') || q.get('itemId') || q.get('goodsId');
        if (shop && id) {
            if (/WD|WEIDIAN/.test(shop)) return { pfx: 'WD', id };
            if (/TB|TAO|TMALL/.test(shop)) return { pfx: 'TB', id };
            if (/AL|1688|ALI/.test(shop)) return { pfx: 'AL', id };
        }
    } catch (_) {}
    return null;
}

// Resolve any link (incl. short links) to an item descriptor.
async function resolveItem(link) {
    let d = deriveItem(link);
    if (d) return d;
    // Follow redirects (e.g. ikako.vip/xxx short links), then re-derive.
    try {
        const r = await fetch(link, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html' }, redirect: 'follow' });
        if (r.url) d = deriveItem(r.url);
        if (d) return d;
        const html = await r.text();
        const m = html.match(/https?:\/\/[^"'\\\s)]*?(?:weidian\.com[^"'\\\s)]*|(?:item|detail)\.?taobao\.com[^"'\\\s)]*|tmall\.com[^"'\\\s)]*|1688\.com[^"'\\\s)]*|item\/details\?url=[^"'\\\s)]*)/i);
        if (m) { try { d = deriveItem(decodeURIComponent(m[0])); } catch (_) { d = deriveItem(m[0]); } }
    } catch (_) {}
    return d;
}

// picks.ly public proxy → { seller (raw), price, sales, weight }.
async function lookupItem(pfx, id) {
    const mk = PICKSLY_MK[pfx];
    const empty = { seller: '', price: '', sales: '', weight: '' };
    if (!mk || !id) return empty;
    try {
        const r = await fetch(`https://picks.ly/api/p/items/lookup?marketplace=${mk}&product_id=${id}`,
            { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const it = ((await r.json()) || {}).item;
        if (!it) return empty;
        let seller = String(it.shop_name || '').trim();
        if (/^-?\d+$/.test(seller)) seller = '';
        const num = v => (v === null || v === undefined || v === '') ? '' : String(v);
        return {
            seller,
            price:  num(it.price ?? it.original_price),
            sales:  num(it.total_sold),
            weight: num(it.item_weight),
        };
    } catch (_) { return empty; }
}

// Translate text (auto → EN) via Google's free endpoint. Returns input on ASCII / failure.
async function translateToEn(text) {
    const s = String(text || '');
    if (!s || /^[\x00-\x7F]*$/.test(s)) return s;
    try {
        const r = await fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=' + encodeURIComponent(s),
            { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const data = await r.json();
        const out = (data[0] || []).map(seg => seg[0]).join('').trim();
        return out || s;
    } catch (_) { return s; }
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }); }

    const ua = String(req.headers['user-agent'] || '');
    if (!ua || BLOCKED_UA.test(ua)) return res.status(403).json({ error: 'Forbidden' });

    const action = String(req.query.action || 'lookup');

    try {
        if (action === 'translate') {
            const q = String(req.query.q || '');
            if (!q.trim()) return res.status(400).json({ error: 'Missing q' });
            if (q.length > 4000) return res.status(413).json({ error: 'Too large' });
            const text = await translateToEn(q);
            res.setHeader('Cache-Control', 's-maxage=2592000, stale-while-revalidate=31536000');
            return res.json({ text });
        }

        // action = lookup
        const link = String(req.query.link || '').trim();
        if (!link) return res.status(400).json({ error: 'Missing link' });
        const d = await resolveItem(link);
        if (!d) return res.status(404).json({ error: 'Could not derive item from link' });

        const { seller, price, sales, weight } = await lookupItem(d.pfx, d.id);
        const sellerEn = await translateToEn(seller);

        res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
        return res.json({
            marketplace: DOPPEL_MP[d.pfx],
            id: d.id,
            price, sales, weight,
            seller: sellerEn,
            buy_link: marketplaceUrl(d.pfx, d.id),
            qc_link: doppelUrl(d.pfx, d.id),
        });
    } catch (err) {
        return res.status(502).json({ error: 'Upstream error' });
    }
}
