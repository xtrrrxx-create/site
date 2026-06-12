// Minimal Upstash Redis REST client (no SDK). Works with either the Vercel KV
// integration env names (KV_REST_API_*) or the native Upstash ones
// (UPSTASH_REDIS_REST_*).

function creds() {
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
    return { url, token };
}

export function hasRedis() {
    const { url, token } = creds();
    return !!(url && token);
}

// Run a single Redis command, e.g. redis('SADD', key, member). Returns the
// `result` field from Upstash, or throws on transport/HTTP error.
export async function redis(...command) {
    const { url, token } = creds();
    if (!url || !token) throw new Error('Redis not configured');
    const r = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(command),
    });
    if (!r.ok) {
        const body = await r.text().catch(() => '');
        throw new Error(`Upstash ${r.status} ${body.slice(0, 200)}`);
    }
    const json = await r.json();
    if (json && json.error) throw new Error(`Upstash: ${json.error}`);
    return json ? json.result : null;
}

export function favKey(uid) {
    return `fav:${uid}`;
}
