// Start the Discord OAuth flow: set a CSRF state cookie and redirect the
// browser to Discord's authorize page.

import crypto from 'crypto';
import { setStateCookie } from '../_session.js';

function originOf(req) {
    const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
    const host = (req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
    return `${proto}://${host}`;
}

export default function handler(req, res) {
    const clientId = process.env.DISCORD_CLIENT_ID;
    if (!clientId || !process.env.SESSION_SECRET) {
        return res.status(500).send('Login not configured');
    }
    const state = crypto.randomBytes(16).toString('hex');
    setStateCookie(res, state);

    const redirectUri = `${originOf(req)}/api/auth/callback`;
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'identify',
        state,
        prompt: 'none',
    });
    res.writeHead(302, { Location: `https://discord.com/api/oauth2/authorize?${params}` });
    res.end();
}
