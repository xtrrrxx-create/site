// ─── Discord login + per-user favourites (Supabase Auth) ───────────────────
//
// Loads after /js/vendor/supabase.js (which exposes window.supabase) and after
// app.js. Exposes window.jfAuth and renders the navbar auth control (#nav-auth).
//
// Favourites are stored in the `favorites` table (RLS-scoped to auth.uid()).
// Product *details* for the favourites view come from app.js's in-memory
// allProductsCache, so the client never queries the locked-down products table.

(function () {
    'use strict';

    let sb = null;                 // Supabase client (after init)
    let user = null;               // current auth user, or null
    const favSet = new Set();      // product_ids (as strings) the user favourited
    let favLoaded = false;

    // Resolve when the client is initialised (config fetched + client created).
    let _resolveReady;
    const ready = new Promise(r => { _resolveReady = r; });

    function emit(name) { document.dispatchEvent(new CustomEvent(name)); }

    // ── Favourites ─────────────────────────────────────────────────────────
    async function loadFavorites() {
        favSet.clear();
        favLoaded = false;
        if (!sb || !user) { emit('jf-favorites-change'); return; }
        try {
            const { data, error } = await sb
                .from('favorites')
                .select('product_id')
                .eq('user_id', user.id);
            if (error) throw error;
            (data || []).forEach(r => favSet.add(String(r.product_id)));
            favLoaded = true;
        } catch (e) {
            console.warn('[auth] loadFavorites failed', e && e.message);
        }
        emit('jf-favorites-change');
    }

    async function toggleFavorite(id) {
        id = String(id);
        if (!user) { signIn(); return; }          // not logged in → prompt login
        const wasFav = favSet.has(id);
        // Optimistic: flip locally + repaint, then persist.
        if (wasFav) favSet.delete(id); else favSet.add(id);
        emit('jf-favorites-change');
        try {
            if (wasFav) {
                const { error } = await sb.from('favorites')
                    .delete().eq('user_id', user.id).eq('product_id', id);
                if (error) throw error;
            } else {
                const { error } = await sb.from('favorites')
                    .insert({ user_id: user.id, product_id: id });
                if (error) throw error;
            }
        } catch (e) {
            // Revert on failure.
            if (wasFav) favSet.add(id); else favSet.delete(id);
            emit('jf-favorites-change');
            console.warn('[auth] toggleFavorite failed', e && e.message);
        }
    }

    // ── Auth actions ───────────────────────────────────────────────────────
    function signIn() {
        if (!sb) return;
        sb.auth.signInWithOAuth({
            provider: 'discord',
            options: { redirectTo: window.location.origin + window.location.pathname },
        });
    }
    async function signOut() {
        if (!sb) return;
        await sb.auth.signOut();
        // onAuthStateChange handles the rest.
    }

    // ── Navbar UI ──────────────────────────────────────────────────────────
    const DISCORD_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M20.317 4.369A19.79 19.79 0 0 0 16.558 3.2a.074.074 0 0 0-.079.037 13.78 13.78 0 0 0-.608 1.25 18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 5.323 4.37a.07.07 0 0 0-.032.027C2.884 7.99 2.226 11.52 2.549 15.01a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.873-1.295 1.226-1.994a.076.076 0 0 0-.041-.105 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .078-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .079.009c.12.099.245.198.372.292a.077.077 0 0 1-.006.127c-.598.35-1.22.645-1.873.891a.076.076 0 0 0-.04.106c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.055c.5-4.06-.838-7.563-2.756-10.614a.061.061 0 0 0-.031-.028ZM9.681 12.851c-1.182 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418Zm7.974 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418Z"/></svg>';

    function avatarUrl(u) {
        const m = (u && u.user_metadata) || {};
        return m.avatar_url || m.picture || '';
    }
    function displayName(u) {
        const m = (u && u.user_metadata) || {};
        return m.custom_claims?.global_name || m.full_name || m.name
            || m.user_name || (u && u.email) || 'Account';
    }
    function escapeAttr(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

    function renderNav() {
        const host = document.getElementById('nav-auth');
        if (!host) return;
        if (!user) {
            host.innerHTML = `<button class="nav-login-btn" id="nav-login-btn" type="button">${DISCORD_ICON}<span>Log in</span></button>`;
            host.querySelector('#nav-login-btn').addEventListener('click', signIn);
            return;
        }
        const av = avatarUrl(user);
        const name = displayName(user);
        host.innerHTML = `
            <div class="nav-user-wrap" id="nav-user-wrap">
                <button class="nav-user-btn" id="nav-user-btn" type="button" aria-haspopup="true" aria-expanded="false" title="${escapeAttr(name)}">
                    ${av ? `<img class="nav-user-av" src="${escapeAttr(av)}" alt="" data-fallback="hide" />`
                         : `<span class="nav-user-av nav-user-av-fallback">${escapeAttr(name.slice(0, 1).toUpperCase())}</span>`}
                </button>
                <div class="nav-user-menu" id="nav-user-menu" role="menu" hidden>
                    <div class="nav-user-name">${escapeAttr(name)}</div>
                    <button class="nav-user-item" id="nav-user-favs" role="menuitem" type="button">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/></svg>
                        <span>My Favorites</span>
                    </button>
                    <button class="nav-user-item" id="nav-user-logout" role="menuitem" type="button">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                        <span>Log out</span>
                    </button>
                </div>
            </div>`;
        const btn = host.querySelector('#nav-user-btn');
        const menu = host.querySelector('#nav-user-menu');
        const close = () => { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); document.removeEventListener('click', onDoc, true); };
        const onDoc = (e) => { if (!host.contains(e.target)) close(); };
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const open = menu.hidden;
            menu.hidden = !open;
            btn.setAttribute('aria-expanded', String(open));
            if (open) document.addEventListener('click', onDoc, true);
        });
        host.querySelector('#nav-user-favs').addEventListener('click', () => { close(); if (window.openFavorites) window.openFavorites(); });
        host.querySelector('#nav-user-logout').addEventListener('click', () => { close(); signOut(); });
        // Hide a broken Discord avatar gracefully.
        const img = host.querySelector('.nav-user-av[data-fallback="hide"]');
        if (img) img.addEventListener('error', () => { img.style.display = 'none'; });
    }

    // ── Session wiring ─────────────────────────────────────────────────────
    async function setUser(u) {
        const changed = (u && u.id) !== (user && user.id);
        user = u || null;
        renderNav();
        if (changed) { await loadFavorites(); }
        emit('jf-auth-change');
    }

    async function init() {
        let cfg;
        try {
            const r = await fetch('/api/config', { credentials: 'omit' });
            if (!r.ok) throw new Error('config ' + r.status);
            cfg = await r.json();
        } catch (e) {
            console.warn('[auth] config fetch failed — login disabled', e && e.message);
            return;
        }
        if (!window.supabase || !window.supabase.createClient) {
            console.warn('[auth] supabase-js not loaded — login disabled');
            return;
        }
        sb = window.supabase.createClient(cfg.url, cfg.anonKey, {
            auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
        });
        _resolveReady(true);

        const { data } = await sb.auth.getSession();
        await setUser(data && data.session ? data.session.user : null);

        sb.auth.onAuthStateChange((_event, session) => {
            setUser(session ? session.user : null);
        });

        // Clean OAuth tokens out of the URL hash after sign-in.
        if (/access_token|error=/.test(window.location.hash)) {
            history.replaceState(null, '', window.location.pathname + window.location.search);
        }
    }

    // Public API.
    window.jfAuth = {
        ready,
        isLoggedIn: () => !!user,
        getUser: () => user,
        signIn,
        signOut,
        isFavorite: (id) => favSet.has(String(id)),
        favorites: () => Array.from(favSet),
        favoritesLoaded: () => favLoaded,
        toggleFavorite,
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
