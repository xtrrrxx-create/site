// Clear the session cookie.

import { clearSessionCookie } from '../../lib/session.js';

export default function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }
    clearSessionCookie(res);
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ ok: true });
}
