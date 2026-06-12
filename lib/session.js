// Tiny dependency-free session helpers for the Discord-login serverless
// functions. Sessions are stateless HS256 JWTs signed with SESSION_SECRET and
// stored in an HttpOnly cookie — no database, no external auth vendor.

import crypto from 'crypto';

const SESSION_COOKIE = 'jf_session';
const STATE_COOKIE = 'jf_oauth_state';
const SESSION_TTL = 60 * 60 * 24 * 30; // 30 days

function b64url(input) {
    return Buffer.from(input).toString('base64url');
}

export function signJWT(payload, secret, ttlSeconds = SESSION_TTL) {
    const body = { ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + ttlSeconds };
    const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const data = `${head}.${b64url(JSON.stringify(body))}`;
    const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
    return `${data}.${sig}`;
}

export function verifyJWT(token, secret) {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) return null;
    const data = `${parts[0]}.${parts[1]}`;
    const expected = crypto.createHmac('sha256', secret).update(data).digest('base64url');
    const a = Buffer.from(parts[2]);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    let payload;
    try { payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString()); } catch { return null; }
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null;
    return payload;
}

export function parseCookies(req) {
    const out = {};
    const raw = req.headers.cookie;
    if (!raw) return out;
    for (const part of raw.split(';')) {
        const i = part.indexOf('=');
        if (i < 0) continue;
        out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    }
    return out;
}

function cookie(name, value, maxAge) {
    const attrs = [
        `${name}=${value}`,
        'Path=/',
        'HttpOnly',
        'Secure',
        'SameSite=Lax',
        `Max-Age=${maxAge}`,
    ];
    return attrs.join('; ');
}

export function setSessionCookie(res, token) {
    appendCookie(res, cookie(SESSION_COOKIE, token, SESSION_TTL));
}
export function clearSessionCookie(res) {
    appendCookie(res, cookie(SESSION_COOKIE, '', 0));
}
export function setStateCookie(res, state) {
    appendCookie(res, cookie(STATE_COOKIE, state, 600)); // 10 min
}
export function clearStateCookie(res) {
    appendCookie(res, cookie(STATE_COOKIE, '', 0));
}

function appendCookie(res, str) {
    const prev = res.getHeader('Set-Cookie');
    if (!prev) res.setHeader('Set-Cookie', str);
    else res.setHeader('Set-Cookie', Array.isArray(prev) ? [...prev, str] : [prev, str]);
}

// Read + verify the current session from the request. Returns the user payload
// ({ uid, username, name, avatar }) or null.
export function getSession(req) {
    const secret = process.env.SESSION_SECRET;
    if (!secret) return null;
    const token = parseCookies(req)[SESSION_COOKIE];
    if (!token) return null;
    return verifyJWT(token, secret);
}

export const COOKIES = { SESSION_COOKIE, STATE_COOKIE };
