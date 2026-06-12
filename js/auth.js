// ─── Discord login (identity) + favourites (localStorage) ──────────────────
//
// Two independent features sharing this file:
//   • Favourites — stored in localStorage, work with or without login. No
//     backend, no cost. Per-device.
//   • Discord login — optional identity, handled server-side by /api/auth/*
//     (session in an HttpOnly cookie). Shows the user's avatar in the navbar.
//
// Exposes window.jfAuth (same surface app.js already uses: isFavorite,
// favorites, toggleFavorite, favoritesLoaded, plus login helpers).

(function () {
    'use strict';

    const FAV_KEY = 'jf_favorites';
    let user = null;               // { uid, username, name, avatar } or null
    const favSet = new Set();      // product_ids (as strings)

    function emit(name) { document.dispatchEvent(new CustomEvent(name)); }
    function escapeAttr(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

    // ── Favourites (localStorage) ──────────────────────────────────────────
    function loadFavorites() {
        favSet.clear();
        try {
            const arr = JSON.parse(localStorage.getItem(FAV_KEY) || '[]');
            if (Array.isArray(arr)) arr.forEach(id => favSet.add(String(id)));
        } catch (e) { /* ignore corrupt value */ }
    }
    function persistFavorites() {
        try { localStorage.setItem(FAV_KEY, JSON.stringify(Array.from(favSet))); } catch (e) { /* quota / private mode */ }
    }
    function toggleFavorite(id) {
        id = String(id);
        if (favSet.has(id)) favSet.delete(id); else favSet.add(id);
        persistFavorites();
        emit('jf-favorites-change');
    }

    // ── Discord login (identity only) ──────────────────────────────────────
    function signIn() { window.location.href = '/api/auth/login'; }
    async function signOut() {
        try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }); } catch (e) { /* ignore */ }
        setUser(null);
    }

    // ── Navbar UI ──────────────────────────────────────────────────────────
    const DISCORD_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M20.317 4.369A19.79 19.79 0 0 0 16.558 3.2a.074.074 0 0 0-.079.037 13.78 13.78 0 0 0-.608 1.25 18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 5.323 4.37a.07.07 0 0 0-.032.027C2.884 7.99 2.226 11.52 2.549 15.01a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.873-1.295 1.226-1.994a.076.076 0 0 0-.041-.105 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .078-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .079.009c.12.099.245.198.372.292a.077.077 0 0 1-.006.127c-.598.35-1.22.645-1.873.891a.076.076 0 0 0-.04.106c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.055c.5-4.06-.838-7.563-2.756-10.614a.061.061 0 0 0-.031-.028ZM9.681 12.851c-1.182 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418Zm7.974 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418Z"/></svg>';
    const HEART_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/></svg>';

    function renderNav() {
        const host = document.getElementById('nav-auth');
        if (!host) return;
        const favCount = favSet.size;
        const favBtn = `<button class="nav-fav-btn" id="nav-fav-btn" type="button" aria-label="My favorites" title="My favorites">${HEART_ICON}${favCount ? `<span class="nav-fav-count">${favCount}</span>` : ''}</button>`;

        let authPart;
        if (!user) {
            authPart = `<button class="nav-login-btn" id="nav-login-btn" type="button">${DISCORD_ICON}<span>Log in</span></button>`;
        } else {
            const av = user.avatar || '';
            const name = user.name || user.username || 'Account';
            authPart = `
                <div class="nav-user-wrap" id="nav-user-wrap">
                    <button class="nav-user-btn" id="nav-user-btn" type="button" aria-haspopup="true" aria-expanded="false" title="${escapeAttr(name)}">
                        ${av ? `<img class="nav-user-av" src="${escapeAttr(av)}" alt="" data-fallback="hide" />`
                             : `<span class="nav-user-av nav-user-av-fallback">${escapeAttr(name.slice(0, 1).toUpperCase())}</span>`}
                    </button>
                    <div class="nav-user-menu" id="nav-user-menu" role="menu" hidden>
                        <div class="nav-user-name">${escapeAttr(name)}</div>
                        <button class="nav-user-item" id="nav-user-logout" role="menuitem" type="button">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                            <span>Log out</span>
                        </button>
                    </div>
                </div>`;
        }
        host.innerHTML = favBtn + authPart;

        host.querySelector('#nav-fav-btn').addEventListener('click', () => { if (window.openFavorites) window.openFavorites(); });

        if (!user) {
            host.querySelector('#nav-login-btn').addEventListener('click', signIn);
            return;
        }
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
        host.querySelector('#nav-user-logout').addEventListener('click', () => { close(); signOut(); });
        const img = host.querySelector('.nav-user-av[data-fallback="hide"]');
        if (img) img.addEventListener('error', () => { img.style.display = 'none'; });
    }

    function setUser(u) {
        user = u || null;
        renderNav();
        emit('jf-auth-change');
    }

    async function init() {
        loadFavorites();

        // Clean ?login=ok|error out of the URL after the OAuth round-trip.
        try {
            const sp = new URLSearchParams(window.location.search);
            if (sp.has('login')) {
                sp.delete('login');
                const qs = sp.toString();
                history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : '') + window.location.hash);
            }
        } catch (e) { /* ignore */ }

        renderNav(); // paint immediately (favourites button + login button)

        // Keep the navbar favourites count in sync with toggles elsewhere.
        document.addEventListener('jf-favorites-change', () => {
            const c = document.querySelector('#nav-fav-btn .nav-fav-count');
            const btn = document.getElementById('nav-fav-btn');
            if (!btn) return;
            if (favSet.size) {
                if (c) c.textContent = String(favSet.size);
                else btn.insertAdjacentHTML('beforeend', `<span class="nav-fav-count">${favSet.size}</span>`);
            } else if (c) { c.remove(); }
        });

        // Resolve the optional Discord session.
        try {
            const r = await fetch('/api/auth/me', { credentials: 'same-origin' });
            const data = r.ok ? await r.json() : { user: null };
            setUser(data.user || null);
        } catch (e) {
            // Login backend unavailable (e.g. local static server) — favourites
            // still work; just leave the login button showing.
        }
    }

    window.jfAuth = {
        isLoggedIn: () => !!user,
        getUser: () => user,
        signIn,
        signOut,
        isFavorite: (id) => favSet.has(String(id)),
        favorites: () => Array.from(favSet),
        favoritesLoaded: () => true,   // localStorage is synchronous
        toggleFavorite,
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
