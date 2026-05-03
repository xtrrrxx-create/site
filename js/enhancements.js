/* ─── JARVIS FINDER ENHANCEMENTS ─────────────────────────────────────────── */

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
                const safeKako = escapeHtml(p.kakobuy || '');
                const safeImg  = escapeHtml(p.img || '');
                const safeTitle = escapeHtml((p.title || '').slice(0, 50));
                return `
                <div class="cmd-item" data-type="product" data-kakobuy="${safeKako}">
                    ${safeImg ? `<img class="cmd-item-img" src="${safeImg}" loading="lazy" onerror="this.style.display='none'">` : '<span class="cmd-item-icon">📦</span>'}
                    <div class="cmd-item-info">
                        <span class="cmd-item-title">${safeTitle}</span>
                        <span class="cmd-item-desc">${p.price ? (window.formatPrice ? window.formatPrice(p.price) : '$' + p.price) : ''}</span>
                    </div>
                    <span class="cmd-item-kbd">↗</span>
                </div>`;
            }).join('');
        }

        if (!html) {
            html = `<div class="cmd-empty">No results for "<strong>${q}</strong>"</div>`;
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
                if (el.dataset.kakobuy) window.open(el.dataset.kakobuy, '_blank');
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
    cards.forEach(card => {
        if (card._tiltBound) return;
        card._tiltBound = true;
        card.style.transformStyle = 'preserve-3d';
        card.style.willChange = 'transform';

        card.addEventListener('mousemove', e => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const cx = rect.width / 2;
            const cy = rect.height / 2;
            const rotateX = ((y - cy) / cy) * -8;
            const rotateY = ((x - cx) / cx) * 8;
            card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02,1.02,1.02)`;
            card.style.boxShadow = `${-rotateY * 1.5}px ${rotateX * 1.5}px 30px rgba(0,0,0,0.4)`;
        });
        card.addEventListener('mouseleave', () => {
            card.style.transform = '';
            card.style.boxShadow = '';
            card.style.transition = 'transform 0.4s ease, box-shadow 0.4s ease, border-color 0.3s ease';
            setTimeout(() => { card.style.transition = ''; }, 400);
        });
        card.addEventListener('mouseenter', () => {
            card.style.transition = 'none';
        });
    });
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
                if (item.dataset.kakobuy && item.dataset.kakobuy !== '#') window.open(item.dataset.kakobuy, '_blank');
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
