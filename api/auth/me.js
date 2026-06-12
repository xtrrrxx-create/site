// Return the current logged-in Discord user (from the session cookie), or null.

import { getSession } from '../../lib/session.js';

export default function handler(req, res) {
    const s = getSession(req);
    res.setHeader('Cache-Control', 'no-store');
    if (!s) return res.json({ user: null });
    return res.json({ user: { uid: s.uid, username: s.username, name: s.name, avatar: s.avatar } });
}
