// Fixed Kakobuy-like conversion rates from CNY base.
// 1 USD ~= 6.31 CNY  =>  1 CNY ~= 0.1585 USD
const FIXED_KAKOBUY_RATES = {
    CNY: 1,
    USD: 1 / 6.31,
    EUR: (1 / 6.31) * 0.92, // USD -> EUR approximation
    RON: (1 / 6.31) * 4.58, // USD -> RON approximation
    PLN: (1 / 6.31) * 3.98  // USD -> PLN approximation
};
let exchangeRates = { ...FIXED_KAKOBUY_RATES };
let currentCurrency = localStorage.getItem('currency') || 'USD';

// Cursor glow tracking
document.addEventListener('mousemove', (e) => {
    const glow = document.getElementById('cursor-glow');
    if (glow && window.innerWidth > 768) {
        glow.style.opacity = '1';
        requestAnimationFrame(() => {
            glow.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`;
        });
    }
});

window.changeCurrencyUI = function (curr) {
    currentCurrency = curr;
    localStorage.setItem('currency', curr);

    const cards = document.querySelectorAll('.cur-card');
    cards.forEach(c => {
        c.classList.toggle('active', c.getAttribute('data-cur') === curr);
    });

    const activeLink = document.querySelector('.nav-links a.active');
    if (activeLink) {
        updateNavbarLanguage();
        activeLink.click();
    }
}

function updateNavbarLanguage() {
    const navLinks = document.querySelectorAll('.nav-links a[data-page]');
    navLinks.forEach(a => {
        const page = a.getAttribute('data-page');
        if (page === 'home') a.innerHTML = t('nav_home');
        if (page === 'products') a.innerHTML = t('nav_products');
        if (page === 'tutorials') a.innerHTML = t('nav_tutorials');
        if (page === 'tools') a.innerHTML = t('nav_tools');
    });
}

function formatPrice(cnyPriceStr) {
    let numeric = parseFloat(String(cnyPriceStr).replace(/[^0-9.]/g, ''));
    if (isNaN(numeric)) numeric = 0;
    const rate = exchangeRates[currentCurrency] || 1;
    const converted = (numeric * rate).toFixed(2);
    switch (currentCurrency) {
        case 'USD': return '$' + converted;
        case 'EUR': return '€' + converted;
        case 'RON': return converted + ' lei';
        case 'PLN': return converted + ' zł';
        case 'CNY': default: return '￥' + converted;
    }
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function safeExternalUrl(rawUrl) {
    const value = String(rawUrl || "").trim();
    if (!value) return "#";
    try {
        const parsed = new URL(value);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "#";
        return parsed.toString();
    } catch {
        return "#";
    }
}

function appendAffcodeIfMissing(rawUrl) {
    const clean = safeExternalUrl(rawUrl);
    if (clean === "#") return "#";
    try {
        const parsed = new URL(clean);
        const host = parsed.hostname.toLowerCase();
        const isKakoLink = host.includes("ikako.vip") || host.includes("kakobuy.com");
        if (isKakoLink && !parsed.searchParams.has("affcode")) {
            parsed.searchParams.set("affcode", "keviinn");
        }
        return parsed.toString();
    } catch {
        return "#";
    }
}

const langMap = {
    loading: { EN: "Loading from database...", PLN: "Ładowanie z bazy...", EUR: "Loading from database...", USD: "Loading from database...", RON: "Se încarcă din baza de date...", CNY: "正在从数据库加载..." },
    paste_link: { EN: "Paste the link to change it to your agent's version.", PLN: "Wklej link, żeby zmienić go na wersję Twojego agenta.", RON: "Lipește linkul pentru a-l schimba în versiunea agentului tău.", CNY: "粘贴链接以将其更改为代理的版本。" },
    tools_subtitle: { EN: "Check the status of your packages", PLN: "Sprawdź status swoich paczek", RON: "Verifică statusul pachetelor tale", CNY: "检查您的包裹状态" },
    tool_eyebrow: { EN: "Tool", PLN: "Narzędzie", RON: "Unealtă", CNY: "工具" },
    link_converter_subtitle: { EN: "Paste the link to change it to your agent's version.", PLN: "Wklej link, żeby zmienić go na wersję Twojego agenta.", RON: "Lipește linkul pentru a-l schimba în versiunea agentului tău.", CNY: "粘贴链接以将其更改为代理的版本。" },
    link_placeholder: { EN: "Paste link from Weidian / Taobao...", PLN: "Wklej link z Weidian / Taobao...", RON: "Lipește link din Weidian / Taobao...", CNY: "粘贴来自微店/淘宝的链接..." },
    tracking_placeholder: { EN: "Enter your tracking number...", PLN: "Wprowadź numer śledzenia...", RON: "Introdu numărul de tracking...", CNY: "输入追踪号码..." },
    page: { EN: "Page", PLN: "Strona", RON: "Pagina", CNY: "页" },
    of: { EN: "of", PLN: "z", RON: "din", CNY: "的" },
    nav_home: { EN: "Home", PLN: "Główna", RON: "Acasă", CNY: "首页" },
    nav_products: { EN: "Products", PLN: "Produkty", RON: "Produse", CNY: "产品" },
    nav_tutorials: { EN: "Tutorials", PLN: "Poradniki", RON: "Tutoriale", CNY: "教程" },
    nav_tools: { EN: "Tools", PLN: "Narzędzia", RON: "Unelte", CNY: "工具" },
    hero_desc: {
        EN: "The best items finder site. Find top tier items<br>and order with confidence.",
        PLN: "Najlepsza wyszukiwarka przedmiotów. Znajdź najlepsze rzeczy<br>i zamawiaj bez obaw.",
        RON: "Cel mai bun site de find-uri. Găsește articole premium<br>și comandă cu încredere.",
        CNY: "最好的商品发现网站。寻找顶级商品<br>并放心订购。"
    },
    btn_explore: { EN: "Explore Products", PLN: "Przeglądaj Produkty", RON: "Explorează Produsele", CNY: "浏览产品" },
    title_products: { EN: "Products", PLN: "Produkty", RON: "Produse", CNY: "产品" },
    desc_products: { EN: "Best items picked for clean browsing", PLN: "Najlepsze przedmioty wybrane do łatwego przeglądania", RON: "Cele mai bune articole alese pentru o navigare curată", CNY: "为干净浏览精选的最佳商品" },
    title_tutorials: { EN: "Tutorials", PLN: "Poradniki", RON: "Tutoriale", CNY: "教程" },
    title_tools: { EN: "Tools", PLN: "Narzędzia", RON: "Unelte", CNY: "工具" },
    btn_buy: { EN: "Buy Now", PLN: "Kup Teraz", RON: "Cumpără", CNY: "立即购买" },
    tut_title: { EN: "How to order with agents", RON: "Cum să comanzi prin agenți", PLN: "Jak zamawiać przez agentów", CNY: "如何通过代理订货" },
    tut_1: {
        EN: "Find an item you like on Taobao, Weidian, or directly from our <strong>Products</strong> page.",
        RON: "Găsește un articol care îți place pe Taobao, Weidian, sau direct de pe pagina noastră de <strong>Produse</strong>.",
        PLN: "Znajdź interesujący Cię przedmiot na Taobao, Weidian lub bezpośrednio na naszej stronie <strong>Produkty</strong>.",
        CNY: "在淘宝，微店或直接在我们的<strong>产品</strong>页面上找到您喜欢的商品。"
    },
    tut_2: {
        EN: 'Copy the item link and paste it into our <strong>Link Converter</strong> on the <a href="#" style="color: var(--text-primary);" data-action="go-tools">Tools</a> page.',
        RON: 'Copiază linkul articolului și lipește-l în <strong>Convertorul de Linkuri</strong> de pe pagina de <a href="#" style="color: var(--text-primary);" data-action="go-tools">Unelte</a>.',
        PLN: 'Skopiuj link do przedmiotu i wklej go do naszego <strong>Konwertera Linków</strong> na stronie <a href="#" style="color: var(--text-primary);" data-action="go-tools">Narzędzia</a>.',
        CNY: '复制商品链接并将其粘贴到我们<a href="#" style="color: var(--text-primary);" data-action="go-tools">工具</a>页面的<strong>链接转换器</strong>中。'
    },
    tut_3: {
        EN: "Select your preferred shopping agent (e.g. PandaBuy, SugarGoo).",
        RON: "Selectează agentul tău preferat (ex. PandaBuy, SugarGoo).",
        PLN: "Wybierz preferowanego agenta zakupowego (np. PandaBuy, SugarGoo).",
        CNY: "选择您首选的购物代理（例如 PandaBuy, SugarGoo）。"
    },
    tut_4: {
        EN: "Click Convert and proceed to the agent's site to place your order with confidence.",
        RON: "Dă click pe Convert și mergi pe site-ul agentului pentru a plasa comanda cu încredere.",
        PLN: "Kliknij Convert i przejdź na stronę agenta, aby bezpiecznie złożyć zamówienie.",
        CNY: "点击转换并前往代理网站放心下单。"
    },
    tut_5: {
        EN: "Track your package using the <strong>Package Tracking</strong> tools on our tools page once shipped.",
        RON: "Urmărește pachetul folosind uneltele de <strong>Urmărire Pachete</strong> din meniul odată ce a fost expediat.",
        PLN: "Śledź swoją paczkę za pomocą narzędzi do <strong>Śledzenia Paczek</strong> po jej wysłaniu.",
        CNY: "发货后，请使用我们页面上的<strong>包裹追踪</strong>工具追踪您的包裹。"
    }
};

function t(key) {
    const lang = currentCurrency;
    return langMap[key]?.[lang] || langMap[key]?.['EN'] || key;
}

window.toggleTheme = function () {
    const isLightMode = document.body.classList.toggle('light-mode');
    localStorage.setItem('theme', isLightMode ? 'light' : 'dark');
    updateThemeIcon(isLightMode);
}

function updateThemeIcon(isLightMode) {
    const iconBtn = document.getElementById('theme-btn');
    if (!iconBtn) return;
    if (isLightMode) {
        iconBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>`;
    } else {
        iconBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>`;
    }
}

// ─── FILTER STATE ──────────────────────────────────────────────────────────
const CATEGORIES = ['All', 'Shoes', 'Slides', 'Shorts', 'Pants', 'T-shirts', 'Long-sleeve', 'Hoodies', 'Jackets', 'Merch', 'Accessories'];
const BATCHES = ['All Tags', 'Best Batch', 'Budget Batch', 'Random Batch'];
const SEARCH_DEBOUNCE_MS = 140;
/** Short text fields (search, tracking #) — avoids UI lag on huge paste. */
const INPUT_MAX_LEN = 35;
/** Link converter field max length (paste / lag guard). */
const LINK_INPUT_MAX_LEN = 100;
const PRODUCTS_RENDER_STEP = 30;
const PRODUCTS_AUTO_REFRESH_MS = 90 * 1000;

// Supabase config
const SUPABASE_URL = 'https://jcfcyqnuhufmtoxlqknt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjZmN5cW51aHVmbXRveGxxa250Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwNjg4NzksImV4cCI6MjA5MTY0NDg3OX0.T40EwnvdZYI4n_Jm2Tnt1lBeGt46AHLWsTy_wP1Z-d0';

async function fetchFromSupabase() {
    const pageSize = 1000;
    let all = [];
    let offset = 0;
    while (true) {
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/products?select=title,price,img,kakobuy,picksly,category,batch&order=id.asc&limit=${pageSize}&offset=${offset}`,
            { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
        );
        if (!res.ok) throw new Error('Supabase fetch failed');
        const page = await res.json();
        all = all.concat(page);
        if (page.length < pageSize) break;
        offset += pageSize;
    }
    return all;
}

let filterState = { search: '', category: 'All', batch: 'All Tags' };
let allProductsCache = [];
let productsRefreshTimer = null;
let searchInputTimer = null;
let visibleProductsLimit = PRODUCTS_RENDER_STEP;
let lastProductsSignature = '';

async function refreshProductsFromServer(silent = false) {
    try {
        const data = await fetchFromSupabase();
        const nextSignature = JSON.stringify(data);
        if (nextSignature === lastProductsSignature) {
            return;
        }
        lastProductsSignature = nextSignature;
        allProductsCache = data;
        renderFilteredProducts();
        const info = document.getElementById('kf-results-info');
        if (info) {
            const filtered = getFiltered();
            info.textContent = `Showing ${filtered.length} of ${data.length} products`;
        }
        if (!silent) {
            console.log('Products refreshed from server.');
        }
    } catch (err) {
        console.warn('Auto-refresh failed:', err);
    }
}

// ─── FILTER UI INJECTION ───────────────────────────────────────────────────
function injectFilterStyles() {
    if (document.getElementById('kf-filter-styles')) return;
    const s = document.createElement('style');
    s.id = 'kf-filter-styles';
    s.textContent = `
        .kf-search-wrap {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            margin-bottom: 1.25rem;
            margin-top: 1.5rem;
        }
        .kf-search-box {
            flex: 1;
            display: flex;
            align-items: center;
            gap: 0.6rem;
            background: var(--nav-bg);
            border: 1px solid var(--border-color);
            border-radius: 14px;
            padding: 0.7rem 1rem;
            transition: border-color 0.2s;
        }
        .kf-search-box:focus-within { border-color: var(--text-primary); }
        .kf-search-box svg { flex-shrink: 0; color: var(--text-secondary); }
        .kf-search-box input {
            flex: 1; background: transparent; border: none; outline: none;
            color: var(--text-primary); font-family: 'Inter', sans-serif; font-size: 0.95rem;
        }
        .kf-search-box input::placeholder { color: var(--text-secondary); opacity: 0.6; }
        .kf-search-clear {
            background: none; border: none; color: var(--text-secondary);
            cursor: pointer; padding: 2px; display: flex; align-items: center;
            border-radius: 50%; transition: color 0.15s;
        }
        .kf-search-clear:hover { color: var(--text-primary); }
        .kf-filter-btn {
            display: flex; align-items: center; gap: 0.4rem;
            background: var(--nav-bg); border: 1px solid var(--border-color);
            border-radius: 14px; padding: 0.7rem 1.1rem;
            color: var(--text-primary); font-family: 'Inter', sans-serif;
            font-size: 0.9rem; font-weight: 600; cursor: pointer;
            white-space: nowrap; transition: border-color 0.2s, background 0.2s;
        }
        .kf-filter-btn:hover, .kf-filter-btn.active {
            border-color: var(--text-primary);
        }
        .kf-refresh-btn {
            display: flex; align-items: center; gap: 0.4rem;
            background: var(--nav-bg); border: 1px solid var(--border-color);
            border-radius: 14px; padding: 0.7rem 1rem;
            color: var(--text-primary); font-family: 'Inter', sans-serif;
            font-size: 0.9rem; font-weight: 600; cursor: pointer;
            white-space: nowrap; transition: border-color 0.2s, background 0.2s;
        }
        .kf-refresh-btn:hover { border-color: var(--text-primary); }
        .kf-filter-badge {
            background: var(--text-primary); color: var(--bg-color);
            border-radius: 99px; font-size: 0.7rem; font-weight: 700;
            padding: 1px 6px; min-width: 16px; text-align: center;
        }
        .kf-cat-row {
            display: flex; flex-wrap: wrap; gap: 0.45rem; margin-bottom: 1.5rem;
        }
        .kf-cat-chip {
            background: var(--nav-bg); border: 1px solid var(--border-color);
            border-radius: 99px; padding: 0.38rem 0.9rem;
            color: var(--text-secondary); font-family: 'Inter', sans-serif;
            font-size: 0.82rem; font-weight: 600; cursor: pointer;
            transition: all 0.15s; white-space: nowrap;
        }
        .kf-cat-chip:hover { border-color: var(--text-primary); color: var(--text-primary); }
        .kf-cat-chip.active {
            background: var(--text-primary); border-color: var(--text-primary);
            color: var(--bg-color);
        }
        .kf-results-info {
            font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 0.5rem;
        }
        .kf-modal-overlay {
            position: fixed; inset: 0; background: rgba(0,0,0,0.65);
            z-index: 500; display: flex; align-items: flex-end;
            justify-content: center; padding: 1.5rem;
            opacity: 0; pointer-events: none; transition: opacity 0.25s;
        }
        .kf-modal-overlay.open { opacity: 1; pointer-events: all; }
        .kf-modal {
            background: var(--nav-bg); border: 1px solid var(--border-color);
            border-radius: 24px; padding: 1.75rem; width: 100%; max-width: 440px;
            transform: translateY(30px);
            transition: transform 0.3s cubic-bezier(0.16,1,0.3,1);
        }
        .kf-modal-overlay.open .kf-modal { transform: translateY(0); }
        .kf-modal-header {
            display: flex; align-items: center; justify-content: space-between;
            margin-bottom: 1.5rem;
        }
        .kf-modal-header h3 {
            font-size: 1.3rem; font-weight: 900;
            color: var(--text-primary); margin: 0;
        }
        .kf-modal-close {
            background: var(--border-color); border: none;
            color: var(--text-secondary); border-radius: 99px;
            width: 32px; height: 32px; display: flex;
            align-items: center; justify-content: center;
            cursor: pointer; transition: background 0.15s, color 0.15s;
        }
        .kf-modal-close:hover { background: var(--text-primary); color: var(--bg-color); }
        .kf-section-label {
            font-size: 0.72rem; font-weight: 700; letter-spacing: 0.06em;
            text-transform: uppercase; color: var(--text-secondary); margin-bottom: 0.75rem;
        }
        .kf-modal-cats {
            display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 1.5rem;
        }
        .kf-modal-cat-btn {
            background: var(--border-color); border: 1px solid transparent;
            border-radius: 12px; padding: 0.7rem 1rem;
            color: var(--text-secondary); font-family: 'Inter', sans-serif;
            font-size: 0.9rem; font-weight: 600; text-align: left; cursor: pointer;
            transition: all 0.15s;
        }
        .kf-modal-cat-btn:hover { color: var(--text-primary); }
        .kf-modal-cat-btn.active {
            border-color: var(--text-primary);
            background: transparent; color: var(--text-primary);
        }
        .kf-batch-grid {
            display: grid; grid-template-columns: 1fr 1fr;
            gap: 0.5rem; margin-bottom: 1.75rem;
        }
        .kf-batch-btn {
            background: var(--border-color); border: 1px solid transparent;
            border-radius: 12px; padding: 0.65rem 0.75rem;
            color: var(--text-secondary); font-family: 'Inter', sans-serif;
            font-size: 0.85rem; font-weight: 600; text-align: center;
            cursor: pointer; transition: all 0.15s;
        }
        .kf-batch-btn:hover { color: var(--text-primary); }
        .kf-batch-btn.active {
            border-color: var(--text-primary);
            background: transparent; color: var(--text-primary);
        }
        .kf-modal-actions { display: flex; gap: 0.65rem; }
        .kf-btn-clear {
            flex: 1; background: var(--border-color);
            border: 1px solid var(--border-color); border-radius: 99px;
            padding: 0.75rem; color: var(--text-secondary);
            font-family: 'Inter', sans-serif; font-size: 0.9rem; font-weight: 700;
            cursor: pointer; transition: all 0.15s;
        }
        .kf-btn-clear:hover { color: var(--text-primary); border-color: var(--text-primary); }
        .kf-btn-show {
            flex: 2; background: var(--text-primary);
            border: none; border-radius: 99px; padding: 0.75rem;
            color: var(--bg-color); font-family: 'Inter', sans-serif;
            font-size: 0.9rem; font-weight: 700; cursor: pointer;
            transition: opacity 0.15s, transform 0.1s;
        }
        .kf-btn-show:hover { opacity: 0.85; }
        .kf-btn-show:active { transform: scale(0.97); }
        .kf-no-results {
            grid-column: 1 / -1; text-align: center;
            padding: 4rem 2rem; color: var(--text-secondary);
        }
        .kf-no-results svg { margin-bottom: 1rem; opacity: 0.3; }
        .kf-no-results p { font-size: 0.95rem; }
    `;
    document.head.appendChild(s);
}

function buildFilterUI() {
    injectFilterStyles();
    const active = (filterState.category !== 'All' ? 1 : 0) + (filterState.batch !== 'All Tags' ? 1 : 0);
    return `
        <div class="kf-search-wrap">
            <div class="kf-search-box">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input type="text" id="kf-search-input" placeholder="Search products..." value="" maxlength="${INPUT_MAX_LEN}" autocomplete="off" spellcheck="false"/>
                <button class="kf-search-clear" id="kf-search-clear" style="display:none">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
            <button class="kf-filter-btn ${active > 0 ? 'active' : ''}" id="kf-open-filters">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="4" y1="6" x2="20" y2="6"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="10" y1="18" x2="14" y2="18"/>
                </svg>
                Filters
                ${active > 0 ? `<span class="kf-filter-badge">${active}</span>` : ''}
            </button>
            <button class="kf-refresh-btn" id="kf-refresh-products" title="Refresh products now">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 12a9 9 0 1 1-2.64-6.36"/><polyline points="21 3 21 9 15 9"/>
                </svg>
                Refresh
            </button>
        </div>

        <div class="kf-cat-row">
            ${CATEGORIES.map(cat => `
                <button class="kf-cat-chip ${filterState.category === cat ? 'active' : ''}" data-cat="${cat}">${cat}</button>
            `).join('')}
        </div>

        <div class="kf-results-info" id="kf-results-info"></div>

        <div class="kf-modal-overlay" id="kf-modal-overlay">
            <div class="kf-modal">
                <div class="kf-modal-header">
                    <h3>Filters</h3>
                    <button class="kf-modal-close" id="kf-modal-close">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
                <div class="kf-section-label">Categories</div>
                <div class="kf-modal-cats">
                    ${CATEGORIES.map(cat => `
                        <button class="kf-modal-cat-btn ${filterState.category === cat ? 'active' : ''}" data-modal-cat="${cat}">${cat}</button>
                    `).join('')}
                </div>
                <div class="kf-section-label">Tags &amp; Quality</div>
                <div class="kf-batch-grid">
                    ${BATCHES.map(b => `
                        <button class="kf-batch-btn ${filterState.batch === b ? 'active' : ''}" data-batch="${b}">${b}</button>
                    `).join('')}
                </div>
                <div class="kf-modal-actions">
                    <button class="kf-btn-clear" id="kf-clear-all">Clear all</button>
                    <button class="kf-btn-show" id="kf-show-results">Show results</button>
                </div>
            </div>
        </div>
    `;
}

function bindFilterEvents() {
    const input = document.getElementById('kf-search-input');
    const clearBtn = document.getElementById('kf-search-clear');

    if (!input) return;

    input.addEventListener('input', () => {
        let next = input.value;
        if (next.length > INPUT_MAX_LEN) {
            next = next.slice(0, INPUT_MAX_LEN);
            input.value = next;
        }
        clearBtn.style.display = next ? 'flex' : 'none';
        clearTimeout(searchInputTimer);
        searchInputTimer = setTimeout(() => {
            filterState.search = next;
            resetVisibleProductsLimit();
            renderFilteredProducts();
        }, SEARCH_DEBOUNCE_MS);
    });
    clearBtn.addEventListener('click', () => {
        filterState.search = '';
        input.value = '';
        clearBtn.style.display = 'none';
        resetVisibleProductsLimit();
        renderFilteredProducts();
    });

    document.querySelectorAll('.kf-cat-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            filterState.category = btn.dataset.cat;
            document.querySelectorAll('.kf-cat-chip').forEach(b => b.classList.toggle('active', b.dataset.cat === filterState.category));
            document.querySelectorAll('.kf-modal-cat-btn').forEach(b => b.classList.toggle('active', b.dataset.modalCat === filterState.category));
            updateFilterBadge();
            resetVisibleProductsLimit();
            renderFilteredProducts();
        });
    });

    const openModal = () => document.getElementById('kf-modal-overlay').classList.add('open');
    const closeModal = () => document.getElementById('kf-modal-overlay').classList.remove('open');

    document.getElementById('kf-open-filters').addEventListener('click', openModal);
    document.getElementById('kf-refresh-products').addEventListener('click', async () => {
        await refreshProductsFromServer(false);
    });
    document.getElementById('kf-modal-close').addEventListener('click', closeModal);
    document.getElementById('kf-modal-overlay').addEventListener('click', e => {
        if (e.target === document.getElementById('kf-modal-overlay')) closeModal();
    });

    document.querySelectorAll('.kf-modal-cat-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            filterState.category = btn.dataset.modalCat;
            document.querySelectorAll('.kf-modal-cat-btn').forEach(b => b.classList.toggle('active', b.dataset.modalCat === filterState.category));
            document.querySelectorAll('.kf-cat-chip').forEach(b => b.classList.toggle('active', b.dataset.cat === filterState.category));
            updateFilterBadge();
            resetVisibleProductsLimit();
            renderFilteredProducts();
        });
    });

    document.querySelectorAll('.kf-batch-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            filterState.batch = btn.dataset.batch;
            document.querySelectorAll('.kf-batch-btn').forEach(b => b.classList.toggle('active', b.dataset.batch === filterState.batch));
            updateFilterBadge();
            resetVisibleProductsLimit();
            renderFilteredProducts();
        });
    });

    document.getElementById('kf-clear-all').addEventListener('click', () => {
        filterState.category = 'All';
        filterState.batch = 'All Tags';
        document.querySelectorAll('.kf-modal-cat-btn').forEach(b => b.classList.toggle('active', b.dataset.modalCat === 'All'));
        document.querySelectorAll('.kf-batch-btn').forEach(b => b.classList.toggle('active', b.dataset.batch === 'All Tags'));
        document.querySelectorAll('.kf-cat-chip').forEach(b => b.classList.toggle('active', b.dataset.cat === 'All'));
        updateFilterBadge();
    });

    document.getElementById('kf-show-results').addEventListener('click', () => {
        updateFilterBadge();
        resetVisibleProductsLimit();
        renderFilteredProducts();
        closeModal();
    });
}

function updateFilterBadge() {
    const active = (filterState.category !== 'All' ? 1 : 0) + (filterState.batch !== 'All Tags' ? 1 : 0);
    const btn = document.getElementById('kf-open-filters');
    if (!btn) return;
    btn.classList.toggle('active', active > 0);
    const existing = btn.querySelector('.kf-filter-badge');
    if (existing) existing.remove();
    if (active > 0) {
        const badge = document.createElement('span');
        badge.className = 'kf-filter-badge';
        badge.textContent = active;
        btn.appendChild(badge);
    }
}

function getFiltered() {
    return allProductsCache.filter(p => {
        const s = filterState.search.toLowerCase().slice(0, INPUT_MAX_LEN);
        const matchSearch = !s || p.title.toLowerCase().includes(s);
        const matchCategory = filterState.category === 'All' ||
            (p.category || '').toLowerCase() === filterState.category.toLowerCase();
        const matchBatch = filterState.batch === 'All Tags' ||
            (p.batch || '').toLowerCase() === filterState.batch.toLowerCase();
        return matchSearch && matchCategory && matchBatch;
    });
}

function resetVisibleProductsLimit() {
    visibleProductsLimit = PRODUCTS_RENDER_STEP;
}

function renderFilteredProducts() {
    const container = document.getElementById('products-container');
    const info = document.getElementById('kf-results-info');
    if (!container) return;

    const filtered = getFiltered();
    const visible = filtered.slice(0, visibleProductsLimit);
    if (info) {
        info.textContent = `Showing ${visible.length} of ${filtered.length} products`;
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="kf-no-results">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <p>No products found. Try different filters.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = visible.map(p => {
        const safeTitle = escapeHtml(p.title || "Untitled");
        const batchRaw = (p.batch || '').trim();
        const batch = batchRaw.toLowerCase();
        const rawImg = (p.img || '').trim();
        const isHttp = rawImg.startsWith('http');
        const isKnownPlaceholder =
            /nstatic\.kakobuy\.com\/banner\//i.test(rawImg) ||
            /s\.yupoo\.com\/website\/.*\/logo_/i.test(rawImg) ||
            /picks\.ly\/marketplace-logos\//i.test(rawImg) ||
            /picks\.ly\/agent-logos\//i.test(rawImg) ||
            /picks\.ly\/twitter-image/i.test(rawImg);
        const safeImg = (isHttp && !isKnownPlaceholder) ? rawImg : '';
        const renderImg = safeImg
            ? `<img src="${safeExternalUrl(safeImg)}" alt="${safeTitle}" style="width:100%;height:100%;object-fit:cover;" loading="lazy" decoding="async" fetchpriority="low" onerror="this.onerror=null;this.style.display='none';this.parentElement.insertAdjacentHTML('beforeend','<div style=&quot;width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--text-secondary);font-size:0.8rem;opacity:.7;&quot;>No image</div>');" />`
            : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--text-secondary);font-size:0.8rem;opacity:.7;">No image</div>`;

        const kakobuy = appendAffcodeIfMissing(p.kakobuy || '#');
        const picksly = safeExternalUrl(p.picksly || '#');
        let batchFlair = '';
        if (batch === 'best batch') {
            batchFlair = '<span style="display:inline-flex;align-items:center;padding:0.22rem 0.5rem;border-radius:999px;font-size:0.68rem;font-weight:800;letter-spacing:.02em;background:#1f5130;color:#b8f7cc;border:1px solid #2a7a47;">BEST BATCH</span>';
        } else if (batch === 'budget batch') {
            batchFlair = '<span style="display:inline-flex;align-items:center;padding:0.22rem 0.5rem;border-radius:999px;font-size:0.68rem;font-weight:800;letter-spacing:.02em;background:#51411f;color:#ffe3ab;border:1px solid #8a6b2a;">BUDGET</span>';
        } else if (batch === 'random batch') {
            batchFlair = '<span style="display:inline-flex;align-items:center;padding:0.22rem 0.5rem;border-radius:999px;font-size:0.68rem;font-weight:800;letter-spacing:.02em;background:#2a2f42;color:#c7d2ff;border:1px solid #4d5a96;">RANDOM</span>';
        } else if (batchRaw) {
            batchFlair = `<span style="display:inline-flex;align-items:center;padding:0.22rem 0.5rem;border-radius:999px;font-size:0.68rem;font-weight:800;letter-spacing:.02em;background:#2c2d34;color:#d9d9df;border:1px solid #4b4d59;">${escapeHtml(batchRaw.toUpperCase())}</span>`;
        }

        return `
            <div class="product-card">
                <div class="product-image" style="overflow:hidden;">${renderImg}</div>
                <div class="product-info">
                    <div style="margin-bottom:0.4rem;min-height:18px;">${batchFlair}</div>
                    <h3 class="product-title">${safeTitle}</h3>
                    <div class="product-price">${formatPrice(p.price)}</div>
                    <div class="product-actions">
                        <a href="${kakobuy}" target="_blank" class="btn-primary" style="flex:2;text-align:center;text-decoration:none;border-radius:8px;padding:0.75rem;">${t('btn_buy')}</a>
                        <a href="${picksly}" target="_blank" class="btn-secondary" style="flex:1;text-align:center;text-decoration:none;border-radius:8px;padding:0.75rem;display:flex;align-items:center;justify-content:center;background:var(--border-color);border:none;font-weight:600;">QC</a>
                    </div>
                </div>
            </div>
        `;
    }).join('') + (
        filtered.length > visible.length
            ? `
            <div style="grid-column:1/-1;display:flex;justify-content:center;padding-top:8px;">
                <button id="kf-load-more" class="btn-secondary" style="padding:0.8rem 1.1rem;border-radius:10px;border:none;cursor:pointer;">
                    Load more (${filtered.length - visible.length} left)
                </button>
            </div>
            `
            : ''
    );

    const loadMoreBtn = document.getElementById('kf-load-more');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
            visibleProductsLimit += PRODUCTS_RENDER_STEP;
            renderFilteredProducts();
        });
    }
}

// ─── HOME PAGE STYLES ──────────────────────────────────────────────────────
function injectHomeStyles() {
    if (document.getElementById('jf-home-styles')) return;
    const s = document.createElement('style');
    s.id = 'jf-home-styles';
    s.textContent = `
        @font-face {
            font-family: 'Goodly';
            src: url('fonts/Goodly-Regular.woff') format('woff'),
                 url('fonts/Goodly-Regular.otf') format('opentype');
            font-weight: normal;
            font-style: normal;
            font-display: swap;
        }

        .jf-hero {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: calc(100vh - 5rem);
            text-align: center;
            padding: 2rem 1.5rem 5rem;
            position: relative;
            overflow: hidden;
        }

        /* Subtle radial glow behind the text */
        .jf-hero::before {
            content: '';
            position: absolute;
            top: 30%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 700px;
            height: 400px;
            background: radial-gradient(ellipse, rgba(255,255,255,0.04) 0%, transparent 70%);
            pointer-events: none;
            border-radius: 50%;
        }

        /* Eyebrow pill */
        .jf-eyebrow {
            display: inline-flex;
            align-items: center;
            gap: 7px;
            border: 1px solid var(--border-color);
            border-radius: 9999px;
            padding: 0.35rem 0.9rem;
            font-size: 0.72rem;
            font-weight: 600;
            letter-spacing: 0.07em;
            text-transform: uppercase;
            color: var(--text-secondary);
            margin-bottom: 1.75rem;
            animation: jfFadeUp 0.6s cubic-bezier(0.16,1,0.3,1) both 0.05s;
        }
        .jf-eyebrow-dot {
            width: 5px; height: 5px;
            background: var(--text-secondary);
            border-radius: 50%;
            opacity: 0.7;
        }

        /* Giant Goodly heading */
        .jf-title {
            font-family: 'Goodly', 'Georgia', serif;
            font-weight: normal;
            font-size: clamp(5.5rem, 15vw, 11.5rem);
            line-height: 0.9;
            letter-spacing: -0.02em;
            color: var(--text-primary);
            margin-bottom: 1.6rem;
        }
        .jf-title-line {
            display: block;
            animation: jfRevealWord 0.85s cubic-bezier(0.16,1,0.3,1) both;
        }
        .jf-title-line:nth-child(1) { animation-delay: 0.1s; }
        .jf-title-line:nth-child(2) {
            animation-delay: 0.22s;
            /* Outline style on second word for editorial contrast */
            color: transparent;
            -webkit-text-stroke: 1.5px var(--text-primary);
        }

        /* Subtext */
        .jf-sub {
            color: var(--text-secondary);
            font-size: 1rem;
            font-weight: 400;
            line-height: 1.7;
            margin-bottom: 2.25rem;
            max-width: 380px;
            animation: jfFadeUp 0.7s cubic-bezier(0.16,1,0.3,1) both 0.4s;
        }

        /* CTA button */
        .jf-btn {
            display: inline-flex;
            align-items: center;
            gap: 9px;
            background: var(--text-primary);
            color: var(--bg-color);
            font-family: 'Inter', sans-serif;
            font-weight: 700;
            font-size: 0.9rem;
            padding: 0.9rem 2rem;
            border-radius: 9999px;
            border: none;
            cursor: pointer;
            transition: transform 0.2s ease, box-shadow 0.2s ease, gap 0.2s ease;
            box-shadow: 0 4px 24px rgba(0,0,0,0.35);
            animation: jfFadeUp 0.7s cubic-bezier(0.16,1,0.3,1) both 0.52s;
            text-decoration: none;
        }
        .jf-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 40px rgba(0,0,0,0.55);
            gap: 14px;
        }
        .jf-btn svg { flex-shrink: 0; transition: transform 0.2s; }
        .jf-btn:hover svg { transform: translateX(2px); }

        @keyframes jfRevealWord {
            from { opacity: 0; transform: translateY(28px); filter: blur(6px); }
            to   { opacity: 1; transform: translateY(0);    filter: blur(0); }
        }
        @keyframes jfFadeUp {
            from { opacity: 0; transform: translateY(16px); }
            to   { opacity: 1; transform: translateY(0); }
        }

        /* Light mode: remove outline on second word, just slightly dimmed */
        body.light-mode .jf-title-line:nth-child(2) {
            color: transparent;
            -webkit-text-stroke: 1.5px var(--text-primary);
            opacity: 0.55;
        }
    `;
    document.head.appendChild(s);
}

// ─── PAGES ─────────────────────────────────────────────────────────────────
function getPages() {
    return {
        home: `
        <div class="jf-hero">
            <div class="jf-eyebrow">
                <span class="jf-eyebrow-dot"></span>
                Smart product discovery
            </div>
            <h1 class="jf-title">
                <span class="jf-title-line">jarvis</span>
                <span class="jf-title-line">finder</span>
            </h1>
            <p class="jf-sub">${t('hero_desc')}</p>
            <button class="jf-btn" data-action="go-products">
                ${t('btn_explore')}
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"/>
                    <polyline points="12 5 19 12 12 19"/>
                </svg>
            </button>
        </div>
    `,
        products: `
        <div class="section-container" style="animation: fadeIn 0.4s ease-out;">
            <h2 style="font-size:2.5rem;margin-bottom:0.25rem;font-weight:800;letter-spacing:-1px;">${t('title_products')}</h2>
            <p style="color:var(--text-secondary);font-size:1.1rem;">${t('desc_products')}</p>

            <div id="kf-filter-root">${buildFilterUI()}</div>

            <div class="products-grid" id="products-container" style="margin-top:0.5rem;">
                <p style="color:var(--text-primary);font-weight:600;" id="loading-text">${t('loading')}</p>
            </div>
        </div>
    `,
        tutorials: `
        <style>
            .htb-wrap {
                max-width: 980px;
                margin: 0 auto;
                padding: 3.2rem 1.4rem 2.6rem;
                animation: fadeIn 0.35s ease-out;
            }
            .htb-head {
                text-align: center;
                margin-bottom: 2rem;
            }
            .htb-title {
                font-size: clamp(2rem, 4.3vw, 3rem);
                line-height: 1;
                font-weight: 900;
                letter-spacing: -1.4px;
                margin-bottom: 0.7rem;
                color: var(--text-primary);
            }
            .htb-sub {
                color: var(--text-secondary);
                max-width: 720px;
                margin: 0 auto;
                font-size: 0.98rem;
            }
            .htb-steps {
                display: grid;
                gap: 0.85rem;
            }
            .htb-step {
                background: var(--nav-bg);
                border: 1px solid var(--border-color);
                border-radius: 16px;
                padding: 1.05rem 1.15rem;
                display: grid;
                gap: 0.5rem;
            }
            .htb-step-top {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 0.8rem;
            }
            .htb-num {
                font-size: 0.72rem;
                font-weight: 800;
                letter-spacing: 0.09em;
                text-transform: uppercase;
                color: var(--text-secondary);
            }
            .htb-step h3 {
                font-size: 1.03rem;
                margin: 0;
                color: var(--text-primary);
                font-weight: 800;
                letter-spacing: -0.2px;
            }
            .htb-step p {
                margin: 0;
                color: var(--text-secondary);
                font-size: 0.9rem;
                line-height: 1.55;
            }
            .htb-list {
                margin: 0.2rem 0 0;
                padding-left: 1.05rem;
                color: var(--text-secondary);
                display: grid;
                gap: 0.3rem;
                font-size: 0.88rem;
            }
            .htb-link {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 0.45rem;
                margin-top: 0.45rem;
                width: fit-content;
                text-decoration: none;
                border-radius: 999px;
                padding: 0.52rem 0.9rem;
                font-size: 0.82rem;
                font-weight: 800;
                border: 1px solid var(--border-color);
                color: var(--text-primary);
                background: transparent;
            }
            .htb-link:hover {
                border-color: var(--text-primary);
            }
            .htb-img {
                margin-top: 0.35rem;
                border-radius: 14px;
                overflow: hidden;
                border: 1px solid var(--border-color);
                background: #0f0f12;
            }
            .htb-img img {
                display: block;
                width: 100%;
                height: auto;
                vertical-align: middle;
            }
            .htb-coupon {
                margin-top: 0.35rem;
                display: inline-flex;
                align-items: center;
                border-radius: 12px;
                border: 1px dashed #4f5d87;
                color: #dbe3ff;
                padding: 0.4rem 0.65rem;
                font-size: 0.84rem;
                font-weight: 900;
                letter-spacing: 0.06em;
            }
            .htb-cta {
                margin-top: 1.05rem;
                background: var(--nav-bg);
                border: 1px solid var(--border-color);
                border-radius: 18px;
                padding: 1.2rem;
                text-align: center;
            }
            .htb-cta h3 {
                margin: 0 0 0.45rem;
                color: var(--text-primary);
                font-size: 1.18rem;
                font-weight: 900;
                letter-spacing: -0.4px;
            }
            .htb-cta p {
                margin: 0 0 0.85rem;
                color: var(--text-secondary);
                font-size: 0.9rem;
            }
            .htb-cta .htb-link {
                margin: 0 auto;
                background: var(--text-primary);
                color: var(--bg-color);
                border-color: var(--text-primary);
            }
        </style>
        <div class="htb-wrap">
            <div class="htb-head">
                <h2 class="htb-title">HOW TO BUY</h2>
                <p class="htb-sub">Follow this 5-step guide to buy products using Kakobuy and ship them internationally.</p>
            </div>

            <div class="htb-steps">
                <section class="htb-step">
                    <div class="htb-step-top">
                        <span class="htb-num">01</span>
                        <h3>Create your Kakobuy account</h3>
                    </div>
                    <p>Start by creating an account so you can place orders, store warehouse items, and manage shipping.</p>
                    <div class="htb-img"><img src="images/how-to-buy/step-1.jpg?v=2" alt="Step 1 — create Kakobuy account" loading="lazy" decoding="async" /></div>
                    <a class="htb-link" href="https://ikako.vip/r/keviinn" target="_blank" rel="noopener">Sign up now</a>
                </section>

                <section class="htb-step">
                    <div class="htb-step-top">
                        <span class="htb-num">02</span>
                        <h3>Browse products on Jarvis Finder</h3>
                    </div>
                    <p>Use categories and search to find items quickly, then click Buy Now to open the item in Kakobuy.</p>
                    <div class="htb-img"><img src="images/how-to-buy/step-2.jpg?v=2" alt="Step 2 — browse products" loading="lazy" decoding="async" /></div>
                </section>

                <section class="htb-step">
                    <div class="htb-step-top">
                        <span class="htb-num">03</span>
                        <h3>Purchase your items</h3>
                    </div>
                    <ul class="htb-list">
                        <li>Check title, batch and price.</li>
                        <li>Open product page via Buy Now.</li>
                        <li>Complete checkout in Kakobuy.</li>
                    </ul>
                    <div class="htb-img"><img src="images/how-to-buy/step-3.jpg?v=2" alt="Step 3 — cart and submit" loading="lazy" decoding="async" /></div>
                </section>

                <section class="htb-step">
                    <div class="htb-step-top">
                        <span class="htb-num">04</span>
                        <h3>International shipping</h3>
                    </div>
                    <ul class="htb-list">
                        <li>Wait for warehouse arrival and QC photos.</li>
                        <li>Select shipping line and parcel options.</li>
                        <li>Pay shipping fee and track package.</li>
                    </ul>
                    <div class="htb-img"><img src="images/how-to-buy/step-4.jpg?v=2" alt="Step 4 — choose shipping line" loading="lazy" decoding="async" /></div>
                </section>

                <section class="htb-step">
                    <div class="htb-step-top">
                        <span class="htb-num">05</span>
                        <h3>Apply coupon before payment</h3>
                    </div>
                    <p>Use this coupon in Kakobuy checkout for extra discounts:</p>
                    <div class="htb-coupon">keviinn</div>
                    <div class="htb-img"><img src="images/how-to-buy/step-5.jpg?v=2" alt="Step 5 — apply coupon and submit" loading="lazy" decoding="async" /></div>
                </section>
            </div>

            <div class="htb-cta">
                <h3>READY TO START YOUR HAUL?</h3>
                <p>Create your Kakobuy account and start building your order.</p>
                <a class="htb-link" href="https://ikako.vip/r/keviinn" target="_blank" rel="noopener">Create Kakobuy account</a>
            </div>
        </div>
    `,
        tools: `
        <style>
            .tools-wrap {
                max-width: 1100px;
                margin: 0 auto;
                padding: 5rem 1.5rem 3rem;
                display: flex;
                flex-direction: column;
                gap: 1.5rem;
                animation: fadeIn 0.4s ease-out;
            }
            .tool-card {
                background: var(--nav-bg);
                border: 1px solid var(--border-color);
                border-radius: 24px;
                padding: 2.5rem 2.5rem 2rem;
            }
            .tool-eyebrow {
                font-size: 0.72rem;
                font-weight: 700;
                letter-spacing: 0.12em;
                text-transform: uppercase;
                color: var(--text-secondary);
                margin-bottom: 0.5rem;
            }
            .tool-title {
                font-size: 2.6rem;
                font-weight: 900;
                letter-spacing: -1.5px;
                color: var(--text-primary);
                margin-bottom: 0.4rem;
                line-height: 1;
            }
            .tool-subtitle {
                color: var(--text-secondary);
                font-size: 0.92rem;
                margin-bottom: 1.75rem;
            }
            .converter-row {
                display: flex;
                align-items: stretch;
                gap: 0.75rem;
            }
            .converter-input {
                flex: 1;
                background: var(--bg-color);
                border: 1px solid var(--border-color);
                border-radius: 14px;
                padding: 0 1.1rem;
                height: 52px;
                color: var(--text-primary);
                font-family: 'Inter', sans-serif;
                font-size: 0.92rem;
                outline: none;
                transition: border-color 0.2s;
                box-sizing: border-box;
            }
            .converter-input:focus { border-color: var(--text-primary); }
            .converter-input::placeholder { color: var(--text-secondary); opacity: 0.6; }
            .agent-dropdown-wrap {
                position: relative;
                display: flex;
            }
            .agent-dropdown-btn {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                background: var(--bg-color);
                border: 1px solid var(--border-color);
                border-radius: 14px;
                padding: 0 1rem;
                height: 52px;
                color: var(--text-primary);
                font-family: 'Inter', sans-serif;
                font-size: 0.9rem;
                font-weight: 700;
                cursor: pointer;
                white-space: nowrap;
                transition: border-color 0.2s;
                min-width: 155px;
                justify-content: space-between;
                box-sizing: border-box;
            }
            .agent-dropdown-btn:hover { border-color: var(--text-primary); }
            .agent-logo-kakobuy {
                background: #e8192c;
                display: inline-flex; align-items: center; justify-content: center;
                color: white; font-size: 0.6rem; font-weight: 900;
                width: 22px; height: 22px; border-radius: 6px; flex-shrink: 0;
            }
            .agent-dropdown-menu {
                position: absolute;
                top: calc(100% + 6px);
                left: 0;
                background: var(--nav-bg);
                border: 1px solid var(--border-color);
                border-radius: 14px;
                padding: 0.4rem;
                z-index: 200;
                min-width: 170px;
                display: none;
                box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            }
            .agent-dropdown-menu.open { display: block; }
            .agent-option {
                display: flex; align-items: center; gap: 0.6rem;
                padding: 0.6rem 0.8rem; border-radius: 10px;
                cursor: pointer; font-size: 0.88rem; font-weight: 600;
                color: var(--text-primary); transition: background 0.15s;
            }
            .agent-option:hover { background: var(--border-color); }
            .agent-option.selected { background: var(--border-color); }
            .convert-btn {
                background: var(--text-primary);
                color: var(--bg-color);
                border: none;
                border-radius: 14px;
                padding: 0 1.5rem;
                height: 52px;
                font-family: 'Inter', sans-serif;
                font-size: 0.92rem;
                font-weight: 700;
                cursor: pointer;
                white-space: nowrap;
                transition: opacity 0.15s, transform 0.1s;
                box-sizing: border-box;
            }
            .convert-btn:hover { opacity: 0.85; }
            .convert-btn:active { transform: scale(0.97); }
            .converter-result-new {
                margin-top: 1.25rem;
                padding: 0.9rem 1.1rem;
                border-radius: 12px;
                background: rgba(128,128,128,0.08);
                border: 1px solid var(--border-color);
                color: var(--text-primary);
                font-size: 0.9rem;
                display: none;
            }
            .tracking-card {
                background: var(--nav-bg);
                border: 1px solid var(--border-color);
                border-radius: 24px;
                padding: 2.5rem 2.5rem 2rem;
            }
            .tracking-input {
                width: 100%;
                background: var(--bg-color);
                border: 1px solid var(--border-color);
                border-radius: 14px;
                padding: 0.9rem 1.2rem;
                color: var(--text-primary);
                font-family: 'Inter', sans-serif;
                font-size: 0.95rem;
                outline: none;
                margin-bottom: 1.5rem;
                transition: border-color 0.2s;
                box-sizing: border-box;
            }
            .tracking-input:focus { border-color: var(--text-primary); }
            .tracking-input::placeholder { color: var(--text-secondary); opacity: 0.6; }
            .tracker-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 1rem;
            }
            .tracker-card {
                background: var(--bg-color);
                border: 1px solid var(--border-color);
                border-radius: 18px;
                padding: 1.5rem 1rem 1rem;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 0.75rem;
                text-decoration: none;
                transition: border-color 0.2s, transform 0.2s;
            }
            .tracker-card:hover {
                border-color: var(--text-primary);
                transform: translateY(-2px);
            }
            .tracker-icon {
                width: 56px; height: 56px; border-radius: 14px;
                display: flex; align-items: center; justify-content: center;
                font-size: 1.4rem; font-weight: 900;
            }
            .tracker-name {
                font-weight: 700; font-size: 0.95rem;
                color: var(--text-primary); text-align: center;
            }
            .tracker-open-btn {
                width: 100%;
                background: var(--nav-bg);
                border: 1px solid var(--border-color);
                border-radius: 10px;
                padding: 0.55rem;
                color: var(--text-primary);
                font-family: 'Inter', sans-serif;
                font-size: 0.85rem;
                font-weight: 600;
                text-align: center;
                cursor: pointer;
                transition: background 0.15s;
            }
            .tracker-card:hover .tracker-open-btn {
                background: var(--border-color);
            }
        </style>

        <div class="tools-wrap">
            <div class="tool-card">
                <div class="tool-eyebrow">${t('tool_eyebrow')}</div>
                <h2 class="tool-title">Link Converter</h2>
                <p class="tool-subtitle">${t('link_converter_subtitle')}</p>
                <div class="converter-row">
                    <input class="converter-input" id="link-input" type="text" placeholder="${t('link_placeholder')}" maxlength="${LINK_INPUT_MAX_LEN}" autocomplete="off" />
                    <div class="agent-dropdown-wrap">
                        <button class="agent-dropdown-btn" id="agent-dropdown-btn" onclick="toggleAgentDropdown()">
                            <span style="display:flex;align-items:center;gap:0.45rem;" id="agent-selected-label">
                                <img src="https://www.google.com/s2/favicons?domain=kakobuy.com&sz=64" style="width:20px;height:20px;border-radius:4px;object-fit:contain;" /> KakoBuy
                            </span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
                        </button>
                        <div class="agent-dropdown-menu" id="agent-dropdown-menu">
                            <div class="agent-option selected" data-value="kakobuy" onclick="selectAgent('kakobuy','KakoBuy','https://www.google.com/s2/favicons?domain=kakobuy.com&sz=64')">
                                <img src="https://www.google.com/s2/favicons?domain=kakobuy.com&sz=64" style="width:20px;height:20px;border-radius:4px;object-fit:contain;" /> KakoBuy
                            </div>
                            <div class="agent-option" data-value="acbuy" onclick="selectAgent('acbuy','ACBuy','https://www.google.com/s2/favicons?domain=acbuy.com&sz=64')">
                                <img src="https://www.google.com/s2/favicons?domain=acbuy.com&sz=64" style="width:20px;height:20px;border-radius:4px;object-fit:contain;" /> ACBuy
                            </div>
                            <div class="agent-option" data-value="mulebuy" onclick="selectAgent('mulebuy','Mulebuy','https://www.google.com/s2/favicons?domain=mulebuy.com&sz=64')">
                                <img src="https://www.google.com/s2/favicons?domain=mulebuy.com&sz=64" style="width:20px;height:20px;border-radius:4px;object-fit:contain;" /> Mulebuy
                            </div>
                        </div>
                    </div>
                    <button class="convert-btn" onclick="convertLink()">Convert Link</button>
                </div>
                <div class="converter-result-new" id="converter-result"></div>
            </div>

            <div class="tracking-card">
                <h2 class="tool-title">Package Tracking</h2>
                <p class="tool-subtitle" style="margin-bottom:1.25rem;">${t('tools_subtitle')}</p>
                <input class="tracking-input" type="text" placeholder="${t('tracking_placeholder')}" id="tracking-input" maxlength="${INPUT_MAX_LEN}" oninput="updateTrackerLinks(this.value.trim())" />
                <div class="tracker-grid">
                    <a class="tracker-card" href="https://t.17track.net/en" target="_blank" rel="noopener" id="track-17">
                        <div class="tracker-icon" style="background:#fff;display:flex;align-items:center;justify-content:center;"><img src="https://www.google.com/s2/favicons?domain=17track.net&sz=64" style="width:28px;height:28px;object-fit:contain;" /></div>
                        <span class="tracker-name">17TRACK</span>
                        <span class="tracker-open-btn">Open</span>
                    </a>
                    <a class="tracker-card" href="https://www.dhl.de/en/privatkunden/pakete-empfangen/verfolgen.html" target="_blank" rel="noopener" id="track-dhl">
                        <div class="tracker-icon" style="background:#FFCC00;display:flex;align-items:center;justify-content:center;padding:4px;"><img src="https://www.google.com/s2/favicons?domain=dhl.com&sz=64" style="width:28px;height:28px;object-fit:contain;" /></div>
                        <span class="tracker-name">DHL Express</span>
                        <span class="tracker-open-btn">Open</span>
                    </a>
                </div>
            </div>
        </div>
    `
    };
}

// ─── APP INIT ──────────────────────────────────────────────────────────────
function initApp() {
    const mainContent = document.getElementById('app-content');
    const navLinks = document.querySelectorAll('.nav-links a');

    function renderPage(pageId) {
        if (productsRefreshTimer) {
            clearInterval(productsRefreshTimer);
            productsRefreshTimer = null;
        }
        // Inject home styles before rendering home page
        if (pageId === 'home') injectHomeStyles();

        mainContent.innerHTML = getPages()[pageId] || getPages().home;

        // CSP-safe: handle data-action buttons instead of inline onclick
        mainContent.querySelectorAll('[data-action="go-products"]').forEach(el => {
            el.addEventListener('click', e => { e.preventDefault(); renderPage('products'); });
        });
        mainContent.querySelectorAll('[data-action="go-tools"]').forEach(el => {
            el.addEventListener('click', e => { e.preventDefault(); renderPage('tools'); });
        });

        navLinks.forEach(link => {
            link.classList.toggle('active', link.getAttribute('data-page') === pageId);
        });

        document.querySelectorAll('.bottom-nav-item').forEach(item => {
            item.classList.toggle('active', item.getAttribute('data-page') === pageId);
        });

        if (pageId === 'products') {
            filterState = { search: '', category: 'All', batch: 'All Tags' };

            fetchFromSupabase()
                .then(data => {
                    lastProductsSignature = JSON.stringify(data);
                    allProductsCache = data;

                    const loader = document.getElementById('loading-text');
                    if (loader) loader.remove();

                    bindFilterEvents();
                    renderFilteredProducts();

                    const info = document.getElementById('kf-results-info');
                    if (info) info.textContent = `Showing ${data.length} of ${data.length} products`;

                    // Lightweight periodic sync.
                    productsRefreshTimer = setInterval(() => {
                        refreshProductsFromServer(true);
                    }, PRODUCTS_AUTO_REFRESH_MS);
                })
                .catch(err => {
                    const container = document.getElementById('products-container');
                    if (container) container.innerHTML = `<p style="grid-column:1/-1;color:#ff6b6b;text-align:center;">Error loading products: ${err.message}. Use a local server (e.g. python -m http.server) to fetch JSON correctly.</p>`;
                });
        }
    }

    navLinks.forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            renderPage(link.getAttribute('data-page'));
        });
    });

    document.querySelectorAll('.bottom-nav-item').forEach(item => {
        item.addEventListener('click', e => {
            e.preventDefault();
            renderPage(item.getAttribute('data-page'));
        });
    });

    renderPage('home');
}

document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('theme') === 'light') {
        document.body.classList.add('light-mode');
        updateThemeIcon(true);
    }
    updateNavbarLanguage();
    initApp();
    document.querySelectorAll('.cur-card').forEach(c => {
        c.classList.toggle('active', c.getAttribute('data-cur') === currentCurrency);
    });
});

// ─── AGENT DROPDOWN ────────────────────────────────────────────────────────
let selectedAgent = 'kakobuy';

window.toggleAgentDropdown = function () {
    const menu = document.getElementById('agent-dropdown-menu');
    if (menu) menu.classList.toggle('open');
};

document.addEventListener('click', (e) => {
    const wrap = document.querySelector('.agent-dropdown-wrap');
    if (wrap && !wrap.contains(e.target)) {
        const menu = document.getElementById('agent-dropdown-menu');
        if (menu) menu.classList.remove('open');
    }
});

window.selectAgent = function (value, label, imgSrc) {
    selectedAgent = value;
    const btn = document.getElementById('agent-selected-label');
    if (btn) btn.innerHTML = `<img src="${imgSrc}" style="width:20px;height:20px;border-radius:4px;object-fit:contain;" /> ${label}`;
    document.querySelectorAll('.agent-option').forEach(o => {
        o.classList.toggle('selected', o.dataset.value === value);
    });
    const menu = document.getElementById('agent-dropdown-menu');
    if (menu) menu.classList.remove('open');
};

// ─── LINK CONVERTER ────────────────────────────────────────────────────────
window.convertLink = function () {
    const input = document.getElementById('link-input').value.trim().slice(0, LINK_INPUT_MAX_LEN);
    const agentValue = selectedAgent;
    const agentNames = { kakobuy: 'KakoBuy', acbuy: 'ACBuy', mulebuy: 'Mulebuy' };
    const agentText = agentNames[agentValue] || agentValue;
    const resultDiv = document.getElementById('converter-result');

    if (!input) {
        resultDiv.style.border = '1px solid rgba(239,68,68,0.3)';
        resultDiv.style.background = 'rgba(239,68,68,0.1)';
        resultDiv.style.color = '#ef4444';
        resultDiv.innerHTML = `<strong>Error:</strong> Please enter a valid item link first!`;
        resultDiv.style.display = 'block';
        return;
    }

    let parsedInput;
    try {
        parsedInput = new URL(input);
        if (!['http:', 'https:'].includes(parsedInput.protocol)) throw new Error('bad protocol');
    } catch {
        resultDiv.style.border = '1px solid rgba(239,68,68,0.3)';
        resultDiv.style.background = 'rgba(239,68,68,0.1)';
        resultDiv.style.color = '#ef4444';
        resultDiv.innerHTML = `<strong>Error:</strong> Invalid URL. Use a full http/https product link.`;
        resultDiv.style.display = 'block';
        return;
    }

    const validHosts = ['weidian.com', 'taobao.com', 'tmall.com', '1688.com'];
    const host = parsedInput.hostname.toLowerCase();
    const hostAllowed = validHosts.some(h => host.includes(h));
    if (!hostAllowed) {
        resultDiv.style.border = '1px solid rgba(239,68,68,0.3)';
        resultDiv.style.background = 'rgba(239,68,68,0.1)';
        resultDiv.style.color = '#ef4444';
        resultDiv.innerHTML = `<strong>Error:</strong> Unsupported domain. Use Weidian, Taobao, Tmall, or 1688 links.`;
        resultDiv.style.display = 'block';
        return;
    }

    const encoded = encodeURIComponent(input);
    let finalUrl = '';

    if (agentValue === 'kakobuy') {
        finalUrl = `https://www.kakobuy.com/item/details?url=${encoded}&affcode=keviinn`;
    } else if (agentValue === 'acbuy') {
        finalUrl = `https://www.acbuy.com/en/page/buy/?url=${encoded}`;
    } else if (agentValue === 'mulebuy') {
        let shopType = '', itemId = '';
        if (input.includes('weidian.com')) {
            shopType = 'weidian';
            const m = input.match(/itemID=(\d+)/i);
            if (m) itemId = m[1];
        } else if (input.includes('taobao.com') || input.includes('tmall.com')) {
            shopType = 'taobao';
            const m = input.match(/[?&]id=(\d+)/i);
            if (m) itemId = m[1];
        } else if (input.includes('1688.com')) {
            shopType = '1688';
            const m = input.match(/\/(\d+)\.html/i);
            if (m) itemId = m[1];
        }
        finalUrl = (shopType && itemId)
            ? `https://mulebuy.com/product/?shop_type=${shopType}&id=${itemId}`
            : `https://mulebuy.com/product/?url=${encoded}`;
    }

    resultDiv.style.border = '1px solid var(--border-color)';
    resultDiv.style.background = 'rgba(128,128,128,0.08)';
    resultDiv.style.color = 'var(--text-primary)';
    resultDiv.innerHTML = `Link converted for <strong>${agentText}</strong>. <a href="${finalUrl}" target="_blank" style="color:var(--text-primary);font-weight:600;text-decoration:underline;">Click here to open →</a>`;
    resultDiv.style.display = 'block';
    setTimeout(() => window.open(finalUrl, '_blank'), 800);
};

// ─── PACKAGE TRACKING ──────────────────────────────────────────────────────
window.updateTrackerLinks = function (code) {
    const track17 = document.getElementById('track-17');
    const trackDhl = document.getElementById('track-dhl');

    if (!track17 || !trackDhl) return;

    code = (code || '').slice(0, INPUT_MAX_LEN);

    if (code) {
        track17.href = `https://t.17track.net/en#nums=${encodeURIComponent(code)}`;
        trackDhl.href = `https://www.dhl.de/en/privatkunden/pakete-empfangen/verfolgen.html?piececode=${encodeURIComponent(code)}&cid=c_dhl_2502061_2353`;
    } else {
        track17.href = 'https://t.17track.net/en';
        trackDhl.href = 'https://www.dhl.de/en/privatkunden/pakete-empfangen/verfolgen.html';
    }
};

