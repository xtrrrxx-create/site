// Per-user favourites, stored in Upstash Redis as a set keyed by Discord uid.
//   GET    /api/favorites        → { ids: ["123", ...] }
//   POST   /api/favorites {id}   → add
//   DELETE /api/favorites {id}   → remove
// All require a valid session cookie.

import { getSession } from '../lib/session.js';
import { redis, hasRedis, favKey } from '../lib/upstash.js';

// Product ids are bigints — accept only digit strings, capped in length.
function cleanId(v) {
    const s = String(v == null ? '' : v).trim();
    return /^\d{1,20}$/.test(s) ? s : null;
}

async function readBody(req) {
    if (req.body && typeof req.body === 'object') return req.body;
    if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
    return await new Promise((resolve) => {
        let data = '';
        req.on('data', (c) => { data += c; if (data.length > 1e4) req.destroy(); });
        req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); } });
        req.on('error', () => resolve({}));
    });
}

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');

    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'Not logged in' });
    if (!hasRedis()) return res.status(500).json({ error: 'Storage not configured' });

    const key = favKey(session.uid);

    try {
        if (req.method === 'GET') {
            const ids = await redis('SMEMBERS', key);
            return res.json({ ids: Array.isArray(ids) ? ids : [] });
        }

        if (req.method === 'POST' || req.method === 'DELETE') {
            const body = await readBody(req);
            const id = cleanId(body.id);
            if (!id) return res.status(400).json({ error: 'Invalid id' });
            if (req.method === 'POST') await redis('SADD', key, id);
            else await redis('SREM', key, id);
            return res.json({ ok: true });
        }

        res.setHeader('Allow', 'GET, POST, DELETE');
        return res.status(405).json({ error: 'Method not allowed' });
    } catch (e) {
        console.error('[api/favorites]', e && e.message);
        return res.status(502).json({ error: 'Storage error' });
    }
}
