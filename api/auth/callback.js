// Discord OAuth callback: validate state, exchange the code for a token, fetch
// the Discord profile, mint a session cookie, and redirect home.

import {
    parseCookies, signJWT, setSessionCookie, clearStateCookie, COOKIES,
} from '../../lib/session.js';

function originOf(req) {
    const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
    const host = (req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
    return `${proto}://${host}`;
}

function fail(res, origin) {
    res.writeHead(302, { Location: `${origin}/?login=error` });
    res.end();
}

export default async function handler(req, res) {
    const origin = originOf(req);
    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;
    const secret = process.env.SESSION_SECRET;
    if (!clientId || !clientSecret || !secret) return fail(res, origin);

    const { code, state } = req.query;
    const cookieState = parseCookies(req)[COOKIES.STATE_COOKIE];
    clearStateCookie(res);
    if (!code || !state || !cookieState || state !== cookieState) return fail(res, origin);

    const redirectUri = `${origin}/api/auth/callback`;
    try {
        // 1) Exchange the authorization code for an access token.
        const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                grant_type: 'authorization_code',
                code: String(code),
                redirect_uri: redirectUri,
            }),
        });
        if (!tokenRes.ok) return fail(res, origin);
        const token = await tokenRes.json();

        // 2) Fetch the Discord user with the access token.
        const userRes = await fetch('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${token.access_token}` },
        });
        if (!userRes.ok) return fail(res, origin);
        const u = await userRes.json();

        const avatar = u.avatar
            ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=64`
            : '';
        const session = signJWT({
            uid: u.id,
            username: u.username,
            name: u.global_name || u.username,
            avatar,
        }, secret);
        setSessionCookie(res, session);

        res.writeHead(302, { Location: `${origin}/?login=ok` });
        res.end();
    } catch (e) {
        console.error('[auth/callback]', e && e.message);
        fail(res, origin);
    }
}
