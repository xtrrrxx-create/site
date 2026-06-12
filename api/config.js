// Public runtime config for the client (Supabase URL + anon key).
//
// The anon key is PUBLIC by design — Supabase security relies on Row Level
// Security, not on hiding this key. It is safe to expose here ONLY because the
// `products` table has its table-level SELECT grant revoked from the `anon` and
// `authenticated` roles (see db/favorites.sql), so this key cannot be used to
// scrape the catalogue. The catalogue is served exclusively through
// /api/products, which uses the service-role key server-side.
//
// This key powers client-side Supabase Auth (Discord login) and per-user
// favourites, both of which are RLS-scoped to auth.uid().

export default function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
        console.error('[api/config] missing supabase env');
        return res.status(500).json({ error: 'Server misconfigured' });
    }

    // Cacheable at the edge — these values change ~never.
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=86400');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.json({ url, anonKey });
}
