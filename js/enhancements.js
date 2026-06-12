/* ─── JARVIS FINDER ENHANCEMENTS ─────────────────────────────────────────── */

// ─── 0a. ANTI-POACHING (disable right-click / drag / copy of links & images) ──
(function initCopyProtection() {
    // Block dragging images / links (which would expose the URL).
    document.addEventListener('dragstart', e => {
        const tag = e.target && e.target.tagName;
        if (tag === 'IMG' || tag === 'A') e.preventDefault();
    });
    // Mark every image non-draggable, now and as new ones are rendered.
    function mark(root) {
        if (!root.querySelectorAll) return;
        root.querySelectorAll('img').forEach(i => i.setAttribute('draggable', 'false'));
    }
    function ready() {
        mark(document);
        if (!document.body) return;
        new MutationObserver(recs => {
            for (const r of recs) for (const n of r.addedNodes) {
                if (n.nodeType !== 1) continue;
                if (n.tagName === 'IMG') n.setAttribute('draggable', 'false');
                else mark(n);
            }
        }).observe(document.body, { childList: true, subtree: true });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
    else ready();
})();

// ─── 0. STICKY NAVBAR ──────────────────────────────────────────────────────
// Fade in a blurred background on the top bar once the page is scrolled,
// matching the smooth sticky-header behaviour on picks.ly.
(function initStickyNav() {
    const nav = document.querySelector('.nav-container');
    if (!nav) return;
    // Poll with rAF rather than the scroll event: the page's overflow:clip
    // ancestor suppresses scroll events, so a listener would never fire.
    let lastY = -1;
    (function loop() {
        const y = window.scrollY || document.documentElement.scrollTop || 0;
        if (y !== lastY) { lastY = y; nav.classList.toggle('scrolled', y > 8); }
        requestAnimationFrame(loop);
    })();
})();

// ─── 1. COMMAND PALETTE ────────────────────────────────────────────────────
(function initCommandPalette() {
    const PAGES = [
        { id: 'home',      label: 'Home',      icon: '🏠', desc: 'Main page' },
        { id: 'products',  label: 'Products',  icon: '📦', desc: 'Browse all products' },
        { id: 'tutorials', label: 'Tutorials', icon: '▶', desc: 'How to buy guide' },
        { id: 'qccheck',   label: 'QC Check',  icon: '🔍', desc: 'Quality control checker' },
        { id: 'tools',     label: 'Tools',     icon: '⚙', desc: 'Link converter & tracker' },
    ];

    function open() {
        const overlay = document.getElementById('cmd-palette');
        if (!overlay) return;
        overlay.style.display = 'flex';
        setTimeout(() => overlay.classList.add('cmd-visible'), 10);
        const input = document.getElementById('cmd-input');
        if (input) { input.value = ''; input.focus(); }
        renderCmdResults('');
    }

    function close() {
        const overlay = document.getElementById('cmd-palette');
        if (!overlay) return;
        overlay.classList.remove('cmd-visible');
        setTimeout(() => { overlay.style.display = 'none'; }, 180);
    }

    function renderCmdResults(q) {
        const container = document.getElementById('cmd-results');
        if (!container) return;
        q = q.toLowerCase().trim();

        // Page results
        const pageMatches = PAGES.filter(p =>
            !q || p.label.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q)
        );

        // Product results from cache
        const products = window.allProductsCache || [];
        const prodMatches = q
            ? products.filter(p => p.title && p.title.toLowerCase().includes(q)).slice(0, 5)
            : [];

        let html = '';

        if (pageMatches.length) {
            html += `<div class="cmd-section-label">Pages</div>`;
            html += pageMatches.map(p => `
                <div class="cmd-item" data-type="page" data-id="${p.id}">
                    <span class="cmd-item-icon">${p.icon}</span>
                    <div class="cmd-item-info">
                        <span class="cmd-item-title">${p.label}</span>
                        <span class="cmd-item-desc">${p.desc}</span>
                    </div>
                    <span class="cmd-item-kbd">↵</span>
                </div>
            `).join('');
        }

        if (prodMatches.length) {
            html += `<div class="cmd-section-label">Products</div>`;
            html += prodMatches.map(p => {
                // Sanitize URLs at write-time so a malicious DB row containing
                // javascript:/data:/file: URLs cannot reach window.open later.
                const cleanKako = (typeof safeExternalUrl === 'function' ? safeExternalUrl(p.kakobuy || '') : '#');
                const cleanImg  = (typeof safeExternalUrl === 'function' ? safeExternalUrl(p.img || '')     : '#');
                const safeKako = escapeHtml(cleanKako === '#' ? '' : cleanKako);
                const safeImg  = (cleanImg === '#') ? '' : escapeHtml(cleanImg);
                const safeTitle = escapeHtml((p.title || '').slice(0, 50));
                return `
                <div class="cmd-item" data-type="product" data-kakobuy="${safeKako}">
                    ${safeImg ? `<img class="cmd-item-img" src="${safeImg}" loading="lazy" data-fallback="hide">` : '<span class="cmd-item-icon">📦</span>'}
                    <div class="cmd-item-info">
                        <span class="cmd-item-title">${safeTitle}</span>
                        <span class="cmd-item-desc">${p.price ? (window.formatPrice ? window.formatPrice(p.price) : '$' + p.price) : ''}</span>
                    </div>
                    <span class="cmd-item-kbd">↗</span>
                </div>`;
            }).join('');
        }

        if (!html) {
            // Escape user search input — anything typed into Ctrl+K lands here.
            html = `<div class="cmd-empty">No results for "<strong>${escapeHtml(q)}</strong>"</div>`;
        }

        container.innerHTML = html;

        // Events
        container.querySelectorAll('.cmd-item[data-type="page"]').forEach(el => {
            el.addEventListener('click', () => {
                close();
                if (window.navigateTo) window.navigateTo(el.dataset.id);
            });
        });
        container.querySelectorAll('.cmd-item[data-type="product"]').forEach(el => {
            el.addEventListener('click', () => {
                close();
                // Re-validate at click-time as a second line of defense.
                const raw = el.dataset.kakobuy || '';
                const url = (typeof safeExternalUrl === 'function') ? safeExternalUrl(raw) : raw;
                if (url && url !== '#') window.open(url, '_blank', 'noopener,noreferrer');
            });
        });

        // Keyboard navigation
        const items = container.querySelectorAll('.cmd-item');
        let activeIdx = -1;
        function setActive(idx) {
            items.forEach(i => i.classList.remove('cmd-item-active'));
            if (idx >= 0 && idx < items.length) {
                items[idx].classList.add('cmd-item-active');
                items[idx].scrollIntoView({ block: 'nearest' });
                activeIdx = idx;
            }
        }
        container._setActive = setActive;
        container._items = items;
        container._activeIdx = () => activeIdx;
    }

    document.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            const overlay = document.getElementById('cmd-palette');
            if (overlay && overlay.style.display !== 'none') close();
            else open();
        }
        if (e.key === 'Escape') close();
        if (document.getElementById('cmd-palette')?.style.display !== 'none') {
            const container = document.getElementById('cmd-results');
            if (!container) return;
            const items = container._items;
            if (!items || !items.length) return;
            let idx = container._activeIdx ? container._activeIdx() : -1;
            if (e.key === 'ArrowDown') { e.preventDefault(); idx = Math.min(idx + 1, items.length - 1); container._setActive(idx); }
            if (e.key === 'ArrowUp') { e.preventDefault(); idx = Math.max(idx - 1, 0); container._setActive(idx); }
            if (e.key === 'Enter' && idx >= 0) { e.preventDefault(); items[idx].click(); }
        }
    });

    document.addEventListener('DOMContentLoaded', () => {
        const input = document.getElementById('cmd-input');
        if (input) {
            input.addEventListener('input', () => renderCmdResults(input.value));
        }

        const overlay = document.getElementById('cmd-palette');
        if (overlay) {
            overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
        }

        const btn = document.getElementById('rsb-cmd-btn');
        if (btn) btn.addEventListener('click', open);
    });

    window.openCommandPalette = open;
})();


// ─── 2. 3D CARD TILT ───────────────────────────────────────────────────────
function applyTilt(cards) {
    // Tilt effect disabled
}

window.applyTilt = applyTilt;


// ─── 3. SCROLL REVEAL ──────────────────────────────────────────────────────
(function initScrollReveal() {
    const io = new IntersectionObserver((entries) => {
        const visible = entries.filter(e => e.isIntersecting);
        visible.forEach((e, i) => {
            e.target.style.transitionDelay = `${i * 40}ms`;
            e.target.classList.add('sr-visible');
            setTimeout(() => { e.target.style.transitionDelay = ''; }, 380 + i * 40);
            io.unobserve(e.target);
        });
    }, { threshold: 0.08 });

    function observeCards() {
        document.querySelectorAll('.product-card:not(.sr-observed)').forEach(c => {
            c.classList.add('sr-observed');
            io.observe(c);
        });
    }

    window.observeScrollReveal = observeCards;

    // Re-check on DOM changes (for dynamic renders)
    const mo = new MutationObserver(() => {
        observeCards();
        applyTilt(document.querySelectorAll('.product-card:not([data-tilt])'));
        document.querySelectorAll('.product-card:not([data-tilt])').forEach(c => c.setAttribute('data-tilt', '1'));
    });
    mo.observe(document.body, { childList: true, subtree: true });
})();


// ─── 4. LIVE SEARCH DROPDOWN ───────────────────────────────────────────────
(function initLiveSearch() {
    let dropdownEl = null;
    let debounceTimer = null;

    function createDropdown() {
        const el = document.createElement('div');
        el.id = 'search-dropdown';
        el.className = 'search-dropdown';
        el.style.display = 'none';
        document.body.appendChild(el);
        document.addEventListener('click', e => {
            if (!el.contains(e.target) && e.target.id !== 'kf-search-input') hideDropdown();
        });
        return el;
    }

    function showDropdown(results, inputEl) {
        if (!dropdownEl) dropdownEl = createDropdown();
        if (!results.length) { hideDropdown(); return; }

        const rect = inputEl.getBoundingClientRect();
        dropdownEl.style.top = (rect.bottom + window.scrollY + 6) + 'px';
        dropdownEl.style.left = rect.left + 'px';
        dropdownEl.style.width = rect.width + 'px';
        dropdownEl.style.display = 'block';

        while (dropdownEl.firstChild) dropdownEl.removeChild(dropdownEl.firstChild);

        results.forEach(p => {
            const item = document.createElement('div');
            item.className = 'sd-item';
            item.dataset.kakobuy = safeExternalUrl(p.kakobuy || '');

            if (p.img) {
                const img = document.createElement('img');
                img.className = 'sd-img';
                img.src = safeExternalUrl(p.img || '');
                img.loading = 'lazy';
                img.onerror = function() { this.style.display = 'none'; };
                item.appendChild(img);
            }

            const info = document.createElement('div');
            info.className = 'sd-info';

            const title = document.createElement('div');
            title.className = 'sd-title';
            title.textContent = (p.title || '').slice(0, 45);

            const price = document.createElement('div');
            price.className = 'sd-price';
            price.textContent = p.price ? (window.formatPrice ? window.formatPrice(p.price) : '$' + p.price) : '';

            info.appendChild(title);
            info.appendChild(price);
            item.appendChild(info);

            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('class', 'sd-arrow');
            svg.setAttribute('width', '14'); svg.setAttribute('height', '14');
            svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none');
            svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '2.5');
            svg.innerHTML = '<line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>';
            item.appendChild(svg);

            item.addEventListener('click', () => {
                // Re-validate at click-time and add noopener — same defense-
                // in-depth pattern as the command palette.
                const raw = item.dataset.kakobuy || '';
                const url = (typeof safeExternalUrl === 'function') ? safeExternalUrl(raw) : raw;
                if (url && url !== '#') window.open(url, '_blank', 'noopener,noreferrer');
                hideDropdown();
            });

            dropdownEl.appendChild(item);
        });
    }

    function hideDropdown() {
        if (dropdownEl) dropdownEl.style.display = 'none';
    }

    // Hook into search input (dynamically rendered)
    document.addEventListener('input', e => {
        if (e.target.id !== 'kf-search-input') return;
        const q = e.target.value.toLowerCase().trim();
        clearTimeout(debounceTimer);
        if (!q) { hideDropdown(); return; }
        debounceTimer = setTimeout(() => {
            const products = window.allProductsCache || [];
            const matches = products.filter(p => p.title && p.title.toLowerCase().includes(q)).slice(0, 5);
            showDropdown(matches, e.target);
        }, 120);
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') hideDropdown();
        if (e.key === 'Enter' && e.target.id === 'kf-search-input') hideDropdown();
    });
})();


// ─── 4b. SEARCH FOCUS PANEL (Recent / Trending / Recently viewed) ──────────
(function initSearchPanel() {
    const RECENT_KEY = 'jf_recent_searches';
    let panel = null;
    let activeInput = null;

    function getRecent() { try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch (e) { return []; } }
    function addRecent(term) {
        term = (term || '').trim();
        if (!term) return;
        let r = getRecent().filter(t => t.toLowerCase() !== term.toLowerCase());
        r.unshift(term);
        localStorage.setItem(RECENT_KEY, JSON.stringify(r.slice(0, 8)));
    }
    function clearRecent() { localStorage.removeItem(RECENT_KEY); }

    function ensurePanel() {
        if (panel) return panel;
        panel = document.createElement('div');
        panel.className = 'search-panel';
        panel.style.display = 'none';
        document.body.appendChild(panel);
        // Keep panel open while interacting with it.
        panel.addEventListener('mousedown', e => e.preventDefault());
        document.addEventListener('click', e => {
            if (panel.contains(e.target)) return;
            if (e.target.classList && e.target.classList.contains('pl-search-input')) return;
            hide();
        });
        window.addEventListener('resize', () => { if (activeInput) position(activeInput); });
        return panel;
    }

    function position(input) {
        const r = input.getBoundingClientRect();
        panel.style.top = (r.bottom + window.scrollY + 8) + 'px';
        panel.style.left = (r.left + window.scrollX) + 'px';
        panel.style.width = r.width + 'px';
    }

    function runSearch(input, term) {
        addRecent(term);
        input.value = term;
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        hide();
    }

    function chip(label, iconSvg, onClick) {
        const b = document.createElement('button');
        b.className = 'sp-chip';
        b.innerHTML = iconSvg + '<span>' + label.replace(/[<>&]/g, '') + '</span>';
        b.addEventListener('click', onClick);
        return b;
    }

    const CLOCK = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
    const BOLT = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>';

    function renderSections(input) {
        ensurePanel();
        panel.innerHTML = '';

        // Recent
        const recent = getRecent();
        if (recent.length) {
            const sec = document.createElement('div'); sec.className = 'sp-section';
            const head = document.createElement('div'); head.className = 'sp-head';
            head.innerHTML = '<span>Recent</span>';
            const clr = document.createElement('button'); clr.className = 'sp-clear'; clr.textContent = 'Clear';
            clr.addEventListener('click', () => { clearRecent(); renderSections(input); });
            head.appendChild(clr); sec.appendChild(head);
            const chips = document.createElement('div'); chips.className = 'sp-chips';
            recent.forEach(t => chips.appendChild(chip(t, CLOCK, () => runSearch(input, t))));
            sec.appendChild(chips); panel.appendChild(sec);
        }

        // Trending
        const trending = (window.jfTrendingTerms ? window.jfTrendingTerms(10) : []);
        if (trending.length) {
            const sec = document.createElement('div'); sec.className = 'sp-section';
            const head = document.createElement('div'); head.className = 'sp-head';
            head.innerHTML = '<span>Trending</span>'; sec.appendChild(head);
            const chips = document.createElement('div'); chips.className = 'sp-chips';
            trending.forEach(t => {
                const label = t.charAt(0).toUpperCase() + t.slice(1);
                chips.appendChild(chip(label, BOLT, () => runSearch(input, t)));
            });
            sec.appendChild(chips); panel.appendChild(sec);
        }

        // Recently viewed (thumbnails)
        const rv = (window.jfRecentlyViewedRaw ? window.jfRecentlyViewedRaw() : []).filter(p => p && p.img).slice(0, 10);
        if (rv.length) {
            const sec = document.createElement('div'); sec.className = 'sp-section';
            const head = document.createElement('div'); head.className = 'sp-head';
            head.innerHTML = '<span>Recently viewed</span>';
            const va = document.createElement('a'); va.className = 'sp-viewall'; va.textContent = 'View all';
            va.addEventListener('click', () => { hide(); (window.navigateTo || function(){})('products'); });
            head.appendChild(va); sec.appendChild(head);
            const row = document.createElement('div'); row.className = 'sp-thumbs';
            rv.forEach(p => {
                const a = document.createElement('div'); a.className = 'sp-thumb';
                const img = document.createElement('img');
                img.src = (window.thumb ? window.thumb(p.img, 120) : p.img);
                img.loading = 'lazy'; img.alt = '';
                img.onerror = function () { a.style.display = 'none'; };
                a.appendChild(img);
                a.addEventListener('click', () => {
                    const url = (typeof safeExternalUrl === 'function') ? safeExternalUrl(p.kakobuy || '') : (p.kakobuy || '');
                    if (url && url !== '#') window.open(url, '_blank', 'noopener,noreferrer');
                    hide();
                });
                row.appendChild(a);
            });
            sec.appendChild(row); panel.appendChild(sec);
        }

        if (!panel.children.length) { hide(); return; }
        position(input);
        panel.style.display = 'block';
    }

    function renderResults(input, q) {
        ensurePanel();
        const products = window.allProductsCache || [];
        const matches = products.filter(p => p.title && p.title.toLowerCase().includes(q)).slice(0, 6);
        if (!matches.length) { renderSections(input); return; }
        panel.innerHTML = '';
        const sec = document.createElement('div'); sec.className = 'sp-section';
        matches.forEach(p => {
            const item = document.createElement('div'); item.className = 'sp-result';
            const img = document.createElement('img'); img.className = 'sp-result-img';
            img.src = (window.thumb ? window.thumb(p.img, 80) : p.img); img.loading = 'lazy';
            img.onerror = function () { this.style.visibility = 'hidden'; };
            const info = document.createElement('div'); info.className = 'sp-result-info';
            const t = document.createElement('div'); t.className = 'sp-result-title'; t.textContent = (p.title || '').slice(0, 50);
            const pr = document.createElement('div'); pr.className = 'sp-result-price';
            pr.textContent = p.price ? (window.formatPrice ? window.formatPrice(p.price) : '$' + p.price) : '';
            info.appendChild(t); info.appendChild(pr);
            item.appendChild(img); item.appendChild(info);
            item.addEventListener('click', () => {
                const url = (typeof safeExternalUrl === 'function') ? safeExternalUrl(p.kakobuy || '') : (p.kakobuy || '');
                if (url && url !== '#') window.open(url, '_blank', 'noopener,noreferrer');
                hide();
            });
            sec.appendChild(item);
        });
        panel.appendChild(sec);
        position(input);
        panel.style.display = 'block';
    }

    function hide() { if (panel) panel.style.display = 'none'; }

    document.addEventListener('focusin', e => {
        if (!e.target.classList || !e.target.classList.contains('pl-search-input')) return;
        activeInput = e.target;
        const q = e.target.value.trim().toLowerCase();
        if (q) renderResults(e.target, q); else renderSections(e.target);
    });
    document.addEventListener('input', e => {
        if (!e.target.classList || !e.target.classList.contains('pl-search-input')) return;
        activeInput = e.target;
        const q = e.target.value.trim().toLowerCase();
        if (q) renderResults(e.target, q); else renderSections(e.target);
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') hide();
        if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('pl-search-input')) {
            addRecent(e.target.value);
            hide();
        }
    });
})();


// ─── 4c. ANIMATED SEARCH PLACEHOLDER ────────────────────────────────────────
// Replaced by the picks.ly-style blur placeholder in app.js (initBlurPlaceholders).


// ─── 5. SKELETON LOADING ───────────────────────────────────────────────────
function showSkeletonCards(count) {
    const container = document.getElementById('products-container');
    if (!container) return;
    container.innerHTML = Array.from({ length: count }, () => `
        <div class="skeleton-card">
            <div class="skeleton-img skel-anim"></div>
            <div class="skeleton-body">
                <div class="skel-badge skel-anim"></div>
                <div class="skel-title skel-anim"></div>
                <div class="skel-title-short skel-anim"></div>
                <div class="skel-price skel-anim"></div>
                <div class="skel-btns">
                    <div class="skel-btn-main skel-anim"></div>
                    <div class="skel-btn-qc skel-anim"></div>
                </div>
            </div>
        </div>
    `).join('');
}

window.showSkeletonCards = showSkeletonCards;


// ─── 6. RIGHT SIDEBAR ACTIVE STATE SYNC ───────────────────────────────────
(function initSidebarSync() {
    const orig = window.navigateTo;
    function patchNavigate() {
        if (!window.navigateTo || window.navigateTo._patched) return;
        const fn = window.navigateTo;
        window.navigateTo = function(pageId, replace) {
            fn(pageId, replace);
            document.querySelectorAll('.rsb-link').forEach(a => {
                a.classList.toggle('active', a.getAttribute('data-page') === pageId);
            });
        };
        window.navigateTo._patched = true;
    }
    // Try immediately and after DOMContentLoaded
    patchNavigate();
    document.addEventListener('DOMContentLoaded', patchNavigate);
    setTimeout(patchNavigate, 300);
})();
