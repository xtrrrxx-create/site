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

    updateNavbarLanguage();
    // Re-render current page so translated strings apply immediately.
    const activeLink = document.querySelector('.nav-link.active');
    const pageId = activeLink ? activeLink.getAttribute('data-page') : 'home';
    if (window.navigateTo) window.navigateTo(pageId, true);
    else if (activeLink) activeLink.click();
}

function updateNavbarLanguage() {
    const navLinks = document.querySelectorAll('.nav-link[data-page]');
    navLinks.forEach(a => {
        const page = a.getAttribute('data-page');
        if (page === 'home') a.innerHTML = t('nav_home');
        if (page === 'products') a.innerHTML = t('nav_products');
        if (page === 'tutorials') a.innerHTML = t('nav_tutorials');
        if (page === 'qccheck') a.innerHTML = t('nav_qc');
        if (page === 'tools') a.innerHTML = t('nav_tools');
    });
    // Bottom nav
    document.querySelectorAll('.bottom-nav-item[data-page]').forEach(item => {
        const span = item.querySelector('span');
        if (!span) return;
        const page = item.getAttribute('data-page');
        if (page === 'home') span.textContent = t('nav_home');
        if (page === 'products') span.textContent = t('nav_products');
        if (page === 'tutorials') span.textContent = t('nav_tutorials');
        if (page === 'qccheck') span.textContent = t('nav_qc');
        if (page === 'tools') span.textContent = t('nav_tools');
    });
    // Settings modal
    const settingsH = document.querySelector('#settings-modal h2');
    if (settingsH) settingsH.textContent = t('settings');
    const settingsLbl = document.querySelector('#settings-modal .modal-body > label');
    if (settingsLbl) settingsLbl.textContent = t('lang_currency');
    // Online pill
    const onlineLbl = document.getElementById('online-label');
    if (onlineLbl) onlineLbl.textContent = t('online_label');
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

function stripEmojis(str) {
    return String(str ?? "")
        .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
        .replace(/[\u{2600}-\u{27BF}]/gu, '')
        .replace(/[\u{FE00}-\u{FEFF}]/gu, '')
        .replace(/️/g, '')
        .trim();
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

// Route product images through wsrv.nl: an edge-cached image proxy that
// resizes and re-encodes to webp. Thumbnails are a fraction of the original
// size so the grid paints almost instantly and repeat visits hit the cache.
function thumb(rawUrl, w) {
    const clean = safeExternalUrl(rawUrl);
    if (clean === "#") return "#";
    const width = w || 460;
    return `https://wsrv.nl/?url=${encodeURIComponent(clean)}&w=${width}&output=webp&q=85&we&maxage=30d`;
}

// Derive the source marketplace from a picks.ly link and render its logo as
// the store badge. Item ids are prefixed: WD=Weidian, TB=Taobao, AL=1688.
// Falls back to the generic 店 glyph when the platform can't be determined.
function platformBadge(pickslyRaw) {
    const m = String(pickslyRaw || "").match(/\/item\/([A-Za-z]{2})/);
    const map = {
        WD: { src: "/images/weidian.png", alt: "Weidian" },
        TB: { src: "/images/taobao.png",  alt: "Taobao" },
        AL: { src: "/images/1688.png",    alt: "1688" },
    };
    const hit = m && map[m[1].toUpperCase()];
    if (hit) {
        return `<span class="product-store-badge"><img src="${hit.src}" alt="${hit.alt}" loading="lazy" decoding="async" /></span>`;
    }
    return '<span class="product-store-badge">店</span>';
}

// Variant for URLs we are about to persist or render in localStorage. Returns
// "" for invalid/javascript: URLs so we can drop the field instead of writing
// the literal string "#" into stored data.
function sanitizeStoredUrl(rawUrl) {
    const cleaned = safeExternalUrl(rawUrl);
    return cleaned === "#" ? "" : cleaned;
}

function extractWeidianItemId(kakobuyUrl) {
    try {
        const parsed = new URL(kakobuyUrl);
        const nested = parsed.searchParams.get('url') || parsed.searchParams.get('link');
        if (!nested) return null;
        const sourceUrl = new URL(decodeURIComponent(nested));
        return sourceUrl.searchParams.get('itemID') || sourceUrl.searchParams.get('itemId') || null;
    } catch { return null; }
}

// ── Agent definitions (popup + link converter) ──
const AGENTS = [
    { id: 'kakobuy',  name: 'Kakobuy',  icon: 'https://kakobuy.com/favicon.ico',  domain: 'kakobuy.com' },
    { id: 'oopbuy',   name: 'Oopbuy',   icon: 'https://oopbuy.com/favicon.ico',   domain: 'oopbuy.com' },
    { id: 'acbuy',    name: 'ACBuy',     icon: 'https://www.acbuy.com/favicon.ico', domain: 'acbuy.com' },
    { id: 'mulebuy',  name: 'Mulebuy',   icon: 'https://www.mulebuy.com/favicon.ico', domain: 'mulebuy.com' },
    { id: 'superbuy', name: 'Superbuy',  icon: 'https://www.superbuy.com/favicon.ico', domain: 'superbuy.com' },
    { id: 'joyagoo',  name: 'Joyagoo',   icon: 'https://joyagoo.com/favicon.ico',  domain: 'joyagoo.com' },
    { id: 'usfans',   name: 'USFans',    icon: 'https://usfans.com/favicon.ico',   domain: 'usfans.com' },
];

function buildAgentUrl(agentId, kakobuyRaw) {
    const clean = safeExternalUrl(kakobuyRaw || '#');
    if (clean === '#') return '#';
    if (agentId === 'kakobuy') return appendAffcodeIfMissing(clean);
    const itemId = extractWeidianItemId(clean);
    if (!itemId) return appendAffcodeIfMissing(clean);
    const weidianUrl = `https://weidian.com/item.html?itemID=${itemId}`;
    const enc = encodeURIComponent(weidianUrl);
    switch (agentId) {
        case 'oopbuy':   return `https://oopbuy.com/product/2/${itemId}`;
        case 'acbuy':    return `https://www.acbuy.com/en/page/buy/?url=${enc}`;
        case 'mulebuy':  return `https://www.mulebuy.com/product/?url=${enc}`;
        case 'superbuy': return `https://www.superbuy.com/en/page/buy/?url=${enc}`;
        case 'joyagoo':  return `https://joyagoo.com/product?id=${itemId}&platform=WEIDIAN`;
        case 'usfans':   return `https://usfans.com/product?url=${enc}`;
        default:         return appendAffcodeIfMissing(clean);
    }
}

// Legacy wrapper — still used in product card href for middle-click
function buildAgentLink(kakobuyRaw) {
    const agent = (localStorage.getItem('jf_agent') || 'kakobuy').toLowerCase();
    return buildAgentUrl(agent, kakobuyRaw);
}

// ── Agent selection popup ──
function showAgentPopup(kakobuyRaw) {
    // Remove existing popup
    const old = document.getElementById('agent-popup-overlay');
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.id = 'agent-popup-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);animation:apFadeIn .2s ease;';
    overlay.innerHTML = `
        <style>
            @keyframes apFadeIn { from { opacity:0; } to { opacity:1; } }
            @keyframes apSlideUp { from { transform:translateY(20px);opacity:0; } to { transform:translateY(0);opacity:1; } }
            .ap-modal { background:#2a2a2a;border:1px solid #363636;border-radius:16px;padding:1.5rem;width:380px;max-width:92vw;animation:apSlideUp .25s ease; }
            .ap-title { font-family:'Inter Tight',system-ui,sans-serif;font-size:18px;font-weight:600;color:#f0f0f0;margin-bottom:0.25rem; }
            .ap-sub { font-size:13px;color:#a0a0a0;margin-bottom:1.25rem; }
            .ap-grid { display:grid;grid-template-columns:1fr 1fr;gap:0.5rem; }
            .ap-btn { display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:12px;border:1px solid #363636;background:#1e1e1e;color:#f0f0f0;font-family:'Inter Tight',system-ui,sans-serif;font-size:13px;font-weight:500;cursor:pointer;transition:border-color .15s,background .15s;text-decoration:none; }
            .ap-btn:hover { border-color:#ff9f0a;background:#2a2a2a; }
            .ap-btn img { width:20px;height:20px;border-radius:4px;background:#333;object-fit:contain; }
            .ap-close { position:absolute;top:12px;right:14px;background:none;border:none;color:#a0a0a0;font-size:20px;cursor:pointer;line-height:1; }
            .ap-close:hover { color:#f0f0f0; }
        </style>
        <div class="ap-modal" style="position:relative;">
            <button class="ap-close" id="ap-close">&times;</button>
            <div class="ap-title">Select your agent</div>
            <div class="ap-sub">Choose where to buy this item</div>
            <div class="ap-grid">
                ${AGENTS.map(a => `<a class="ap-btn" data-agent="${a.id}" href="#"><img src="${escapeHtml(a.icon)}" alt="" onerror="this.style.display='none'">${escapeHtml(a.name)}</a>`).join('')}
            </div>
        </div>`;

    document.body.appendChild(overlay);

    // Close on overlay click
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector('#ap-close').addEventListener('click', () => overlay.remove());

    // Agent click
    overlay.querySelectorAll('.ap-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            e.preventDefault();
            const agentId = btn.getAttribute('data-agent');
            const url = buildAgentUrl(agentId, kakobuyRaw);
            if (url && url !== '#') {
                // Validate against whitelist
                try {
                    const parsed = new URL(url);
                    const host = parsed.hostname.toLowerCase();
                    const isAllowed = AGENTS.some(a => host === a.domain || host.endsWith('.' + a.domain)) ||
                                      host === 'ikako.vip' || host.endsWith('.ikako.vip') ||
                                      host === 'kakobuy.com' || host.endsWith('.kakobuy.com');
                    if (isAllowed) {
                        localStorage.setItem('jf_agent', agentId);
                        window.open(url, '_blank', 'noopener,noreferrer');
                    }
                } catch {}
            }
            overlay.remove();
        });
    });
}

function appendAffcodeIfMissing(rawUrl) {
    const clean = safeExternalUrl(rawUrl);
    if (clean === "#") return "#";
    try {
        const parsed = new URL(clean);
        const host = parsed.hostname.toLowerCase();
        // Suffix match — `kakobuy.com.evil.tld` must NOT receive our affcode.
        const matches = (h) => host === h || host.endsWith('.' + h);
        const isKakoLink = matches("ikako.vip") || matches("kakobuy.com");
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
    nav_qc: { EN: "QC Check", PLN: "QC Check", RON: "Verificare QC", CNY: "QC 检查" },
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
    },

    // ── HOME ──
    hero_eyebrow: { EN: "Smart product discovery", RON: "Descoperă produse inteligent", PLN: "Inteligentne odkrywanie produktów", CNY: "智能产品发现" },

    // ── FILTERS ──
    search_placeholder: { EN: "Search products...", RON: "Caută produse...", PLN: "Szukaj produktów...", CNY: "搜索产品..." },
    filters: { EN: "Filters", RON: "Filtre", PLN: "Filtry", CNY: "筛选" },
    refresh: { EN: "Refresh", RON: "Reîmprospătează", PLN: "Odśwież", CNY: "刷新" },
    categories: { EN: "Categories", RON: "Categorii", PLN: "Kategorie", CNY: "类别" },
    tags_quality: { EN: "Tags & Quality", RON: "Etichete și Calitate", PLN: "Tagi i Jakość", CNY: "标签和质量" },
    clear_all: { EN: "Clear all", RON: "Șterge tot", PLN: "Wyczyść", CNY: "全部清除" },
    show_results: { EN: "Show results", RON: "Arată rezultate", PLN: "Pokaż wyniki", CNY: "显示结果" },
    showing_of: { EN: "Showing {a} of {b} products", RON: "Se afișează {a} din {b} produse", PLN: "Pokazano {a} z {b} produktów", CNY: "显示 {a} / {b} 个产品" },
    no_results: { EN: "No products found. Try different filters.", RON: "Niciun produs găsit. Încearcă alte filtre.", PLN: "Brak produktów. Spróbuj innych filtrów.", CNY: "未找到产品。请尝试其他筛选条件。" },
    load_more: { EN: "Load more ({n} left)", RON: "Mai mult ({n} rămase)", PLN: "Załaduj więcej ({n} pozostało)", CNY: "加载更多（剩余 {n}）" },
    no_image: { EN: "No image", RON: "Fără imagine", PLN: "Brak obrazu", CNY: "无图片" },
    products_error: { EN: "Error loading products: {e}.", RON: "Eroare la încărcarea produselor: {e}.", PLN: "Błąd ładowania produktów: {e}.", CNY: "加载产品出错：{e}。" },

    // ── TUTORIALS ──
    htb_title: { EN: "HOW TO BUY", RON: "CUM SĂ CUMPERI", PLN: "JAK KUPIĆ", CNY: "如何购买" },
    htb_sub: { EN: "Follow this 5-step guide to buy products using Kakobuy and ship them internationally.", RON: "Urmează ghidul în 5 pași pentru a cumpăra produse prin Kakobuy și a le expedia internațional.", PLN: "Postępuj zgodnie z 5-etapowym przewodnikiem, aby kupować przez Kakobuy i wysyłać międzynarodowo.", CNY: "遵循这 5 步指南，使用 Kakobuy 购买商品并国际发货。" },
    htb_1_h: { EN: "Create your Kakobuy account", RON: "Creează-ți contul Kakobuy", PLN: "Załóż konto Kakobuy", CNY: "创建您的 Kakobuy 账户" },
    htb_1_p: { EN: "Start by creating an account so you can place orders, store warehouse items, and manage shipping.", RON: "Începe prin a crea un cont ca să poți plasa comenzi, să depozitezi articole și să gestionezi livrarea.", PLN: "Załóż konto, aby składać zamówienia, przechowywać rzeczy w magazynie i zarządzać wysyłką.", CNY: "首先创建一个账户，以便下订单、存放仓库物品并管理运输。" },
    htb_signup: { EN: "Sign up now", RON: "Înregistrează-te acum", PLN: "Zarejestruj się", CNY: "立即注册" },
    htb_2_h: { EN: "Browse products on Jarvis Finder", RON: "Navighează produsele pe Jarvis Finder", PLN: "Przeglądaj produkty w Jarvis Finder", CNY: "在 Jarvis Finder 上浏览产品" },
    htb_2_p: { EN: "Use categories and search to find items quickly, then click Buy Now to open the item in Kakobuy.", RON: "Folosește categoriile și căutarea pentru a găsi repede articole, apoi apasă Cumpără pentru a-l deschide în Kakobuy.", PLN: "Użyj kategorii i wyszukiwarki, aby szybko znaleźć przedmioty, a następnie kliknij Kup Teraz.", CNY: "使用类别和搜索快速找到商品，然后点击立即购买在 Kakobuy 中打开。" },
    htb_3_h: { EN: "Purchase your items", RON: "Cumpără articolele", PLN: "Kup przedmioty", CNY: "购买您的商品" },
    htb_3_l1: { EN: "Check title, batch and price.", RON: "Verifică titlul, batch-ul și prețul.", PLN: "Sprawdź tytuł, batch i cenę.", CNY: "检查标题、批次和价格。" },
    htb_3_l2: { EN: "Open product page via Buy Now.", RON: "Deschide pagina produsului prin Cumpără.", PLN: "Otwórz stronę produktu poprzez Kup Teraz.", CNY: "通过立即购买打开产品页面。" },
    htb_3_l3: { EN: "Complete checkout in Kakobuy.", RON: "Finalizează comanda pe Kakobuy.", PLN: "Dokończ zamówienie w Kakobuy.", CNY: "在 Kakobuy 完成结账。" },
    htb_4_h: { EN: "International shipping", RON: "Expediere internațională", PLN: "Wysyłka międzynarodowa", CNY: "国际运输" },
    htb_4_l1: { EN: "Wait for warehouse arrival and QC photos.", RON: "Așteaptă sosirea la depozit și pozele QC.", PLN: "Czekaj na dostarczenie do magazynu i zdjęcia QC.", CNY: "等待仓库到货和 QC 照片。" },
    htb_4_l2: { EN: "Select shipping line and parcel options.", RON: "Alege linia de expediere și opțiunile coletului.", PLN: "Wybierz linię wysyłki i opcje paczki.", CNY: "选择运输线路和包裹选项。" },
    htb_4_l3: { EN: "Pay shipping fee and track package.", RON: "Plătește taxa de expediere și urmărește coletul.", PLN: "Zapłać za wysyłkę i śledź paczkę.", CNY: "支付运费并追踪包裹。" },
    htb_5_h: { EN: "Apply coupon before payment", RON: "Aplică cuponul înainte de plată", PLN: "Użyj kuponu przed płatnością", CNY: "付款前使用优惠券" },
    htb_5_p: { EN: "Use this coupon in Kakobuy checkout for extra discounts:", RON: "Folosește acest cupon la plata Kakobuy pentru discount suplimentar:", PLN: "Użyj tego kuponu przy płatności Kakobuy, aby uzyskać dodatkowe zniżki:", CNY: "在 Kakobuy 结账时使用此优惠券获得额外折扣：" },
    htb_cta_h: { EN: "READY TO START YOUR HAUL?", RON: "GATA SĂ ÎNCEPI?", PLN: "GOTOWY ZACZĄĆ?", CNY: "准备好开始了吗？" },
    htb_cta_p: { EN: "Create your Kakobuy account and start building your order.", RON: "Creează-ți contul Kakobuy și începe să construiești comanda.", PLN: "Załóż konto Kakobuy i zacznij budować zamówienie.", CNY: "创建您的 Kakobuy 账户并开始构建订单。" },
    htb_cta_btn: { EN: "Create Kakobuy account", RON: "Creează cont Kakobuy", PLN: "Załóż konto Kakobuy", CNY: "创建 Kakobuy 账户" },

    // ── QC CHECKER ──
    qc_title: { EN: "QC Checker", RON: "Verificare QC", PLN: "Sprawdzarka QC", CNY: "QC 检查器" },
    qc_subtitle: { EN: "Paste any Weidian / Taobao / 1688 / picks.ly or agent link (Kakobuy, ACBuy, Mulebuy, Superbuy, etc).", RON: "Lipește orice link Weidian / Taobao / 1688 / picks.ly sau agent (Kakobuy, ACBuy, Mulebuy, Superbuy, etc).", PLN: "Wklej link Weidian / Taobao / 1688 / picks.ly lub agenta (Kakobuy, ACBuy, Mulebuy, Superbuy itd.).", CNY: "粘贴任何 Weidian / Taobao / 1688 / picks.ly 或代理链接（Kakobuy、ACBuy、Mulebuy、Superbuy 等）。" },
    qc_placeholder: { EN: "https://weidian.com/... or https://picks.ly/item/...", RON: "https://weidian.com/... sau https://picks.ly/item/...", PLN: "https://weidian.com/... lub https://picks.ly/item/...", CNY: "https://weidian.com/... 或 https://picks.ly/item/..." },
    qc_btn: { EN: "Check QC", RON: "Verifică QC", PLN: "Sprawdź QC", CNY: "检查 QC" },
    qc_invalid_picksly: { EN: "Invalid picks.ly link.", RON: "Link picks.ly invalid.", PLN: "Nieprawidłowy link picks.ly.", CNY: "无效的 picks.ly 链接。" },
    qc_paste_full: { EN: "Paste a full URL (marketplace or agent).", RON: "Lipește un URL complet (marketplace sau agent).", PLN: "Wklej pełny URL (marketplace lub agent).", CNY: "粘贴完整的 URL（市场或代理）。" },
    qc_none: { EN: "No QC photos available for this item yet.", RON: "Nu sunt încă poze QC pentru acest articol.", PLN: "Brak zdjęć QC dla tego przedmiotu.", CNY: "此商品暂无 QC 照片。" },
    qc_found: { EN: "Found {n} QC batch(es).", RON: "S-au găsit {n} batch-uri QC.", PLN: "Znaleziono {n} partii QC.", CNY: "找到 {n} 个 QC 批次。" },
    qc_failed: { EN: "Failed to load QC: {e}", RON: "Încărcare QC eșuată: {e}", PLN: "Błąd ładowania QC: {e}", CNY: "加载 QC 失败：{e}" },
    qc_batch: { EN: "Batch", RON: "Batch", PLN: "Partia", CNY: "批次" },
    qc_photos: { EN: "photos", RON: "poze", PLN: "zdjęć", CNY: "张照片" },
    qc_back: { EN: "Back", RON: "Înapoi", PLN: "Wróć", CNY: "返回" },
    qc_view_picksly: { EN: "View on picks.ly", RON: "Vezi pe picks.ly", PLN: "Zobacz na picks.ly", CNY: "在 picks.ly 查看" },
    online_label: { EN: "online", RON: "online", PLN: "online", CNY: "在线" },

    // ── TOOLS ──
    link_converter: { EN: "Link Converter", RON: "Convertor Linkuri", PLN: "Konwerter Linków", CNY: "链接转换器" },
    convert_link: { EN: "Convert Link", RON: "Convertește Linkul", PLN: "Konwertuj Link", CNY: "转换链接" },
    package_tracking: { EN: "Package Tracking", RON: "Urmărire Pachete", PLN: "Śledzenie Paczek", CNY: "包裹追踪" },
    open_btn: { EN: "Open", RON: "Deschide", PLN: "Otwórz", CNY: "打开" },
    conv_invalid: { EN: "<strong>Error:</strong> Invalid URL. Use a full http/https product link.", RON: "<strong>Eroare:</strong> URL invalid. Folosește un link complet http/https.", PLN: "<strong>Błąd:</strong> Nieprawidłowy URL. Użyj pełnego linku http/https.", CNY: "<strong>错误：</strong>无效的 URL。请使用完整的 http/https 链接。" },

    // ── SETTINGS ──
    settings: { EN: "Settings", RON: "Setări", PLN: "Ustawienia", CNY: "设置" },
    lang_currency: { EN: "Language / Currency", RON: "Limbă / Monedă", PLN: "Język / Waluta", CNY: "语言 / 货币" }
};

function t(key, vars) {
    const lang = currentCurrency;
    let str = langMap[key]?.[lang] || langMap[key]?.['EN'] || key;
    if (vars) {
        for (const k in vars) str = str.split('{' + k + '}').join(vars[k]);
    }
    return str;
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
const CATEGORIES = ['All', 'Shoes', 'Slides', 'Shorts', 'Pants', 'T-shirts', 'Long-sleeve', 'Hoodies', 'Jackets', 'Accessories'];

// Marketplace name from a picks.ly item link prefix (WD/TB/AL).
function platformName(pickslyRaw) {
    const m = String(pickslyRaw || '').match(/\/item\/([A-Za-z]{2})/);
    const map = { WD: 'weidian', TB: 'taobao', AL: '1688' };
    return (m && map[m[1].toUpperCase()]) || '';
}

// Reject junk seller values picks.ly sometimes returns (e.g. "-1", pure
// numbers) so they never show on cards or in the Stores section.
function validSeller(s) {
    s = String(s || '').trim();
    return (s && !/^-?\d+$/.test(s)) ? s : '';
}

// "Category | Seller" label for product cards. Falls back gracefully.
function catSellerLabel(p) {
    const cat = String((p && p.category) || '').trim();
    const seller = validSeller(p && p.seller);
    if (cat && seller) return cat + ' | ' + seller;
    return seller || cat || '';
}

// Small line icon per category, shown on the .pl-cat tabs (picks.ly style).
function catIcon(cat) {
    const s = '<svg class="pl-cat-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';
    const grid = '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 12h18M12 3v18"/>';
    // short-sleeve tee
    const shirt = '<path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/>';
    const footprints = '<path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z"/><path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z"/><path d="M16 17h4M4 13h4"/>';
    // long trousers
    const pants = '<path d="M5 3h14l-1.5 18h-4.5L12 9l-1 12H6.5L5 3Z"/>';
    // short pants
    const shorts = '<path d="M5 4h14l-1 11h-4.5L12 8l-1.5 7H6L5 4Z"/>';
    // long-sleeve top (no hood)
    const longSleeve = '<path d="M9 3 4 6l1 7 2.5-1V21h9V12l2.5 1 1-7-5-3-3 2-3-2Z"/>';
    // hooded long-sleeve (hoodie)
    const hoodie = '<path d="M9 4 4 7l1 7 2.5-1V21h9V13l2.5 1 1-7-5-3"/><path d="M9 4a3 3 0 0 1 6 0"/><path d="M12 7v3"/>';
    // puffer jacket with quilting + zip
    const jacket = '<path d="M7 4 4 6l1 7 2-1v9h10v-9l2 1 1-7-3-2-5 1.5L7 4Z"/><path d="M12 5.5V21"/><path d="M8.5 10h2M13.5 10h2M8.5 14h2M13.5 14h2M8.5 18h2M13.5 18h2"/>';
    const watch = '<circle cx="12" cy="12" r="6"/><polyline points="12 10 12 12 13 13"/><path d="m16.13 7.66-.81-4.05a2 2 0 0 0-2-1.61h-2.68a2 2 0 0 0-2 1.61l-.78 4.05"/><path d="m7.88 16.36.8 4a2 2 0 0 0 2 1.61h2.72a2 2 0 0 0 2-1.61l.81-4.05"/>';
    const map = {
        'all': grid, 'shoes': footprints, 'slides': footprints,
        'shorts': shorts, 'pants': pants,
        't-shirts': shirt, 'long-sleeve': longSleeve, 'hoodies': hoodie, 'jackets': jacket,
        'accessories': watch,
    };
    return s + (map[String(cat).toLowerCase()] || shirt) + '</svg>';
}
const BATCHES = ['All Tags', 'Best Batch', 'Budget Batch', 'Random Batch'];
const SEARCH_DEBOUNCE_MS = 140;
/** Short text fields (search, tracking #) — avoids UI lag on huge paste. */
const INPUT_MAX_LEN = 35;
/** Link converter field max length (paste / lag guard). */
const LINK_INPUT_MAX_LEN = 100;
const PRODUCTS_RENDER_STEP = 30;
const PRODUCTS_AUTO_REFRESH_MS = 90 * 1000;

async function fetchFromSupabase() {
    const res = await fetch('/api/products');
    if (!res.ok) throw new Error('Failed to load products');
    return res.json();
}

let filterState = { search: '', category: 'All', batch: 'All Tags', seller: '' };
let storesFilter = { platform: 'all', query: '' };
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
            info.textContent = t('showing_of', { a: filtered.length, b: data.length });
        }
        // Silent in production — no data echoed to console.
    } catch (_err) {
        // Swallow: auto-refresh is best-effort, do not leak error details to client console.
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
            background: #2a2a2a;
            border: 1px solid #3a3a3a;
            border-radius: 9999px;
            padding: 0.75rem 1.25rem;
            transition: border-color 0.2s;
        }
        .kf-search-box:focus-within { border-color: #555; }
        .kf-search-box svg { flex-shrink: 0; color: var(--text-secondary); }
        .kf-search-box input {
            flex: 1; background: transparent; border: none; outline: none;
            color: var(--text-primary); font-family: 'Inter', sans-serif; font-size: 0.95rem;
        }
        .kf-search-box input::placeholder { color: var(--text-secondary); opacity: 0.7; }
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
                <input type="text" id="kf-search-input" placeholder="${t('search_placeholder')}" value="" maxlength="${INPUT_MAX_LEN}" autocomplete="off" spellcheck="false"/>
                <button class="kf-search-clear" id="kf-search-clear" style="display:none">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-secondary);flex-shrink:0;">
                    <rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
                </svg>
            </div>
            <button class="kf-filter-btn ${active > 0 ? 'active' : ''}" id="kf-open-filters">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="4" y1="6" x2="20" y2="6"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="10" y1="18" x2="14" y2="18"/>
                </svg>
                ${t('filters')}
                ${active > 0 ? `<span class="kf-filter-badge">${active}</span>` : ''}
            </button>
            <button class="kf-refresh-btn" id="kf-refresh-products" title="${t('refresh')}">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 12a9 9 0 1 1-2.64-6.36"/><polyline points="21 3 21 9 15 9"/>
                </svg>
                ${t('refresh')}
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
                    <h3>${t('filters')}</h3>
                    <button class="kf-modal-close" id="kf-modal-close">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
                <div class="kf-section-label">${t('categories')}</div>
                <div class="kf-modal-cats">
                    ${CATEGORIES.map(cat => `
                        <button class="kf-modal-cat-btn ${filterState.category === cat ? 'active' : ''}" data-modal-cat="${cat}">${cat}</button>
                    `).join('')}
                </div>
                <div class="kf-section-label">${t('tags_quality')}</div>
                <div class="kf-batch-grid">
                    ${BATCHES.map(b => `
                        <button class="kf-batch-btn ${filterState.batch === b ? 'active' : ''}" data-batch="${b}">${b}</button>
                    `).join('')}
                </div>
                <div class="kf-modal-actions">
                    <button class="kf-btn-clear" id="kf-clear-all">${t('clear_all')}</button>
                    <button class="kf-btn-show" id="kf-show-results">${t('show_results')}</button>
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
    if (!allProductsCache || !allProductsCache.length) return [];
    return allProductsCache.filter(p => {
        const s = filterState.search.toLowerCase().slice(0, INPUT_MAX_LEN);
        const matchSearch = !s || p.title.toLowerCase().includes(s);
        const matchCategory = filterState.category === 'All' ||
            (p.category || '').toLowerCase() === filterState.category.toLowerCase();
        const matchBatch = filterState.batch === 'All Tags' ||
            (p.batch || '').toLowerCase() === filterState.batch.toLowerCase();
        const matchSeller = !filterState.seller ||
            (p.seller || '').toLowerCase() === filterState.seller.toLowerCase();
        return matchSearch && matchCategory && matchBatch && matchSeller;
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
        info.textContent = t('showing_of', { a: visible.length, b: filtered.length });
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="kf-no-results">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <p>${t('no_results')}</p>
            </div>
        `;
        return;
    }

    container.innerHTML = visible.map(p => {
        const safeTitle = escapeHtml(stripEmojis(p.title || "Untitled"));
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
            ? `<img src="${escapeHtml(thumb(safeImg, 600))}" alt="${safeTitle}" style="width:100%;height:100%;object-fit:cover;" loading="lazy" decoding="async" fetchpriority="low" data-fallback="no-image-text" data-orig="${escapeHtml(safeExternalUrl(safeImg))}" />`
            : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--text-secondary);font-size:0.8rem;opacity:.7;">${escapeHtml(t('no_image'))}</div>`;

        const kakobuy = buildAgentLink(p.kakobuy || '#');
        const picksly = safeExternalUrl(p.picksly || '#');
        const sellerName = catSellerLabel(p);

        // Recently-viewed payload travels via a data attribute (HTML-escaped),
        // not via inline onclick. Avoids breaking out of attribute quoting if
        // a product field contains "/'/<. Decoded by the delegated listener.
        const rvItem = escapeHtml(JSON.stringify({
            title: stripEmojis(p.title || ''),
            price: p.price,
            img: safeImg,
            category: p.category || '',
            seller: p.seller || '',
            // Sanitize URLs at write time so they cannot smuggle javascript: etc.
            kakobuy: safeExternalUrl(p.kakobuy || ''),
            picksly: safeExternalUrl(p.picksly || '')
        }));
        return `
            <div class="product-card" data-rv="${rvItem}">
                <div class="product-image" style="overflow:hidden;">${renderImg}</div>
                <div class="product-info">
                    <div class="product-batch-row">
                        ${platformBadge(p.picksly)}
                        <span class="product-store-name">${escapeHtml(sellerName)}</span>
                    </div>
                    <h3 class="product-title">${safeTitle}</h3>
                    <div class="product-price">${formatPrice(p.price)}</div>
                    <div class="product-actions">
                        <button class="card-btn-buy" data-kakobuy="${escapeHtml(safeExternalUrl(p.kakobuy || ''))}">${t('btn_buy')}</button>
                        <a href="${escapeHtml(picksly)}" target="_blank" rel="noopener noreferrer" class="card-btn-qc">View QC</a>
                    </div>
                </div>
            </div>
        `;
    }).join('') + (
        filtered.length > visible.length
            ? `
            <div style="grid-column:1/-1;display:flex;justify-content:center;padding-top:8px;">
                <button id="kf-load-more" class="btn-secondary" style="padding:0.8rem 1.1rem;border-radius:10px;border:none;cursor:pointer;">
                    ${t('load_more', { n: filtered.length - visible.length })}
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
    const existing = document.getElementById('jf-home-styles');
    if (existing) existing.remove();
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
            justify-content: flex-start;
            min-height: calc(100vh - 5rem);
            text-align: center;
            padding-top: 5vh;
            padding-left: 1.5rem;
            padding-right: 1.5rem;
            padding-bottom: 2rem;
            position: relative;
        }

        /* Hero glow removed */

        /* Eyebrow pill */
        .jf-eyebrow {
            display: inline-flex;
            align-items: center;
            gap: 7px;
            border: 1px solid rgba(255,159,10,0.3);
            border-radius: 9999px;
            padding: 0.35rem 0.9rem;
            font-family: 'Inter Tight', system-ui, sans-serif;
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
            background: #ff9f0a;
            border-radius: 50%;
        }

        /* Floating explore button top-right */
        .jf-btn-float {
            position: absolute;
            top: 18vh;
            right: 8%;
            display: inline-flex;
            align-items: center;
            gap: 9px;
            background: #ff9f0a;
            color: #fff;
            font-family: 'Inter', sans-serif;
            font-weight: 700;
            font-size: 0.9rem;
            padding: 0.9rem 2rem;
            border-radius: 9999px;
            border: none;
            cursor: pointer;
            transition: transform 0.2s ease, box-shadow 0.2s ease, gap 0.2s ease;
            box-shadow: 0 4px 24px rgba(255,140,0,0.3);
            animation: jfFadeUp 0.7s cubic-bezier(0.16,1,0.3,1) both 0.52s;
            text-decoration: none;
            z-index: 2;
        }
        .jf-btn-float:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 40px rgba(255,140,0,0.5);
            gap: 14px;
        }
        .jf-btn-float svg { flex-shrink: 0; transition: transform 0.2s; }
        .jf-btn-float:hover svg { transform: translateX(2px); }

        /* Giant Goodly heading */
        .jf-title {
            font-family: 'Goodly', 'Georgia', serif;
            font-weight: normal;
            font-size: clamp(3rem, 8.5vw, 9rem);
            line-height: 1;
            letter-spacing: -0.02em;
            white-space: nowrap;
            color: var(--text-primary);
            margin-bottom: 0.4rem;
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
            font-family: 'Inter Tight', system-ui, sans-serif;
            font-size: 16px;
            font-weight: 400;
            line-height: 24px;
            margin-bottom: 0.5rem;
            max-width: 420px;
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
        <style>
            .rv-section {
                width: 100%;
                padding: 2rem 0 0.5rem;
                overflow: hidden;
            }
            /* ── Category carousel sections (picks.ly clone) ── */
            .hc-section {
                max-width: 1280px;
                margin: 0 auto 2.5rem;
                padding: 0;
            }
            .hc-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 16px;
            }
            .hc-title {
                font-family: 'Inter Tight', system-ui, sans-serif;
                font-size: 32px;
                font-weight: 400;
                line-height: 48px;
                color: var(--text-primary);
                display: inline-flex;
                align-items: center;
                gap: 6px;
                cursor: pointer;
                text-decoration: none;
            }
            .hc-title:hover { color: #ff9f0a; }
            .hc-title svg { transition: transform 0.15s; }
            .hc-title:hover svg { transform: translateX(3px); }
            .hc-viewmore {
                font-family: 'Inter Tight', system-ui, sans-serif;
                font-size: 14px;
                color: var(--text-secondary);
                text-decoration: none;
                cursor: pointer;
            }
            .hc-viewmore:hover { color: var(--text-primary); }
            .hc-carousel-wrap {
                position: relative;
            }
            .hc-carousel {
                display: flex;
                gap: 16px;
                padding: 24px 0;
                margin: -24px 0;
                overflow-x: auto;
                overflow-y: hidden;
                scroll-behavior: smooth;
                scrollbar-width: none;
                -ms-overflow-style: none;
                cursor: grab;
            }
            .hc-carousel:active { cursor: grabbing; }
            .hc-carousel::-webkit-scrollbar { display: none; }
            .hc-card {
                flex-shrink: 0;
                width: 243.2px;
                display: flex;
                flex-direction: column;
            }
            .hc-card .product-image { height: auto; aspect-ratio: 1; }
            .hc-arrow {
                position: absolute;
                top: 45%;
                transform: translateY(-50%);
                width: 40px;
                height: 40px;
                border-radius: 50%;
                background: rgba(20,20,20,0.9);
                border: 1px solid #363636;
                color: #f0f0f0;
                display: none;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                z-index: 5;
                transition: background 0.15s;
                backdrop-filter: blur(4px);
            }
            .hc-carousel-wrap:hover .hc-arrow { display: flex; }
            .hc-arrow:hover { background: rgba(50,50,50,0.95); }
            .hc-arrow-left { left: 8px; }
            .hc-arrow-right { right: 8px; }
        </style>
        <div style="position:relative;">
            <!-- Hero section (picks.ly style) -->
            <div class="pl-hero">
                <h1 class="pl-hero-title">Your Go-to <span class="pl-accent">Spreadsheet</span></h1>
                <p class="pl-hero-sub">${t('hero_desc')}</p>
                <!-- Search bar -->
                <div class="pl-search-wrap">
                    <svg class="pl-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input type="text" class="pl-search-input" id="home-search" placeholder="Search products..." autocomplete="off" spellcheck="false">
                    <button class="pl-search-paste" id="home-paste-btn" aria-label="Paste">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    </button>
                </div>
                <!-- Category tabs -->
                <div class="pl-cats">
                    ${CATEGORIES.map(cat => `<button class="pl-cat ${cat === 'All' ? 'active' : ''}" data-home-cat="${cat}">${catIcon(cat)}<span>${cat}</span></button>`).join('')}
                </div>
            </div>
            <div id="home-sections">${buildHomeSections()}</div>
            <div style="padding-bottom:3rem;"></div>
        </div>
    `,
        stores: `
        <style>
            .hc-section { max-width: 1280px; margin: 0 auto 2.5rem; padding: 0; }
            .hc-carousel-wrap { position: relative; }
            .hc-carousel { display: flex; gap: 16px; padding: 24px 0; margin: -24px 0; overflow-x: auto; overflow-y: hidden; scroll-behavior: smooth; scrollbar-width: none; -ms-overflow-style: none; cursor: grab; }
            .hc-carousel:active { cursor: grabbing; }
            .hc-carousel::-webkit-scrollbar { display: none; }
            .hc-card { flex-shrink: 0; width: 243.2px; display: flex; flex-direction: column; }
            .hc-card .product-image { height: auto; aspect-ratio: 1; }
            .hc-arrow { position: absolute; top: 45%; transform: translateY(-50%); width: 40px; height: 40px; border-radius: 50%; background: rgba(20,20,20,0.9); border: 1px solid #363636; color: #f0f0f0; display: none; align-items: center; justify-content: center; cursor: pointer; z-index: 5; transition: background 0.15s; backdrop-filter: blur(4px); }
            .hc-carousel-wrap:hover .hc-arrow { display: flex; }
            .hc-arrow:hover { background: rgba(50,50,50,0.95); }
            .hc-arrow-left { left: 8px; } .hc-arrow-right { right: 8px; }
            .stores-page-head { max-width: 1280px; margin: 2.5rem auto 1.2rem; padding: 0; }
            .stores-page-head h1 { font-family: 'Inter Tight', system-ui, sans-serif; font-size: 32px; font-weight: 700; color: var(--text-primary); margin-bottom: 1rem; }
            .stores-filter-row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
            .stores-pills { display: flex; gap: 8px; }
            .stores-pill { padding: 7px 16px; background: #2a2a2a; border: 1px solid #333; border-radius: 9999px; color: var(--text-secondary); font-family: 'Inter Tight', system-ui, sans-serif; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.15s ease; }
            .stores-pill:hover { color: var(--text-primary); }
            .stores-pill.active { background: #fff; color: #111; border-color: #fff; }
            .stores-search { display: flex; align-items: center; gap: 8px; background: #2a2a2a; border: 1px solid #333; border-radius: 9999px; padding: 0 1rem; height: 42px; width: 340px; max-width: 100%; }
            .stores-search input { flex: 1; min-width: 0; background: transparent; border: none; outline: none; color: var(--text-primary); font-family: 'Inter Tight', system-ui, sans-serif; font-size: 0.95rem; }
            .stores-search input::placeholder { color: var(--text-secondary); }
            .stores-search svg { color: var(--text-secondary); flex-shrink: 0; }
            .store-section-card { max-width: 1280px; margin: 0 auto 1.5rem; background: #2a2a2a; border: none; border-radius: 16px; padding: 0; overflow: hidden; box-shadow: rgba(0,0,0,0.35) 0 2px 4px 0, rgba(0,0,0,0.5) 0 8px 20px 0; }
            .store-page-header { display: flex; align-items: center; justify-content: space-between; padding: 20px 20px 0; }
            .store-section-card .store-icon { width: 48px; height: 48px; font-size: 1.2rem; border: 3px solid var(--bg-color); }
            .store-section-divider { height: 1px; background: #333; margin: 16px 20px 0; }
            .store-section-card .hc-carousel { padding: 16px 20px 14px; margin: 0; }
            .store-section-card .hc-arrow-left { left: 8px; }
            .store-section-card .hc-arrow-right { right: 8px; }
            .store-view-btn-sm { width: auto; margin-top: 0; padding: 0 1.4rem; height: 36px; }
        </style>
        <div style="padding: 0 4% 3rem;">
            <div class="stores-page-head">
                <h1>Stores</h1>
                <div class="stores-filter-row">
                    <div class="stores-pills">
                        <button class="stores-pill active" data-plat="all">All</button>
                        <button class="stores-pill" data-plat="weidian">Weidian</button>
                        <button class="stores-pill" data-plat="1688">1688</button>
                        <button class="stores-pill" data-plat="taobao">Taobao</button>
                    </div>
                    <div class="stores-search">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input type="text" id="stores-search-input" placeholder="Search sellers & products..." autocomplete="off" spellcheck="false" />
                    </div>
                </div>
            </div>
            <div id="stores-page">${buildStoresPage()}</div>
        </div>
    `,
        products: `
        <div style="max-width:1400px;margin:0 auto;padding:0 4% 3rem;">
            <!-- Hero search (same as home) -->
            <div class="pl-hero" style="padding-top:2.5rem;padding-bottom:1rem;">
                <h1 class="pl-hero-title">Your Go-to <span class="pl-accent">Spreadsheet</span></h1>
                <p class="pl-hero-sub">${t('hero_desc')}</p>
                <div class="pl-search-wrap">
                    <svg class="pl-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input type="text" class="pl-search-input" id="kf-search" placeholder="Search products..." autocomplete="off" spellcheck="false">
                    <button class="pl-search-paste" id="products-paste-btn" aria-label="Paste">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    </button>
                </div>
                <div class="pl-cats" id="pl-product-cats">
                    ${CATEGORIES.map(cat => `<button class="pl-cat ${filterState.category === cat ? 'active' : ''}" data-pl-cat="${cat}">${catIcon(cat)}<span>${cat}</span></button>`).join('')}
                </div>
            </div>

            <div class="products-grid" id="products-container" style="margin-top:0.75rem;">
                <p style="color:var(--text-primary);font-weight:600;" id="loading-text">${t('loading')}</p>
            </div>
        </div>
    `,
        tutorials: `
        <style>
            .htb-wrap {
                max-width: 1400px;
                margin: 0 auto;
                padding: 1.5rem 4% 2.6rem;
            }
            .htb-head {
                text-align: left;
                margin-bottom: 1.5rem;
            }
            .htb-title {
                font-family: 'Inter Tight', system-ui, sans-serif;
                font-size: 26px;
                line-height: 31px;
                font-weight: 600;
                letter-spacing: -0.025em;
                margin-bottom: 0.4rem;
                color: var(--text-primary);
            }
            .htb-sub {
                color: var(--text-secondary);
                max-width: 720px;
                font-size: 14px;
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
                <h2 class="htb-title">${t('htb_title')}</h2>
                <p class="htb-sub">${t('htb_sub')}</p>
            </div>

            <div class="htb-steps">
                <section class="htb-step">
                    <div class="htb-step-top">
                        <span class="htb-num">01</span>
                        <h3>${t('htb_1_h')}</h3>
                    </div>
                    <p>${t('htb_1_p')}</p>
                    <div class="htb-img"><img src="/images/how-to-buy/step-1.jpg?v=2" alt="Step 1" loading="eager" fetchpriority="high" decoding="async" /></div>
                    <a class="htb-link" href="https://ikako.vip/r/keviinn" target="_blank" rel="noopener">${t('htb_signup')}</a>
                </section>

                <section class="htb-step">
                    <div class="htb-step-top">
                        <span class="htb-num">02</span>
                        <h3>${t('htb_2_h')}</h3>
                    </div>
                    <p>${t('htb_2_p')}</p>
                    <div class="htb-img"><img src="/images/how-to-buy/step-2.jpg?v=2" alt="Step 2" loading="eager" fetchpriority="high" decoding="async" /></div>
                </section>

                <section class="htb-step">
                    <div class="htb-step-top">
                        <span class="htb-num">03</span>
                        <h3>${t('htb_3_h')}</h3>
                    </div>
                    <ul class="htb-list">
                        <li>${t('htb_3_l1')}</li>
                        <li>${t('htb_3_l2')}</li>
                        <li>${t('htb_3_l3')}</li>
                    </ul>
                    <div class="htb-img"><img src="/images/how-to-buy/step-3.jpg?v=2" alt="Step 3" loading="eager" fetchpriority="high" decoding="async" /></div>
                </section>

                <section class="htb-step">
                    <div class="htb-step-top">
                        <span class="htb-num">04</span>
                        <h3>${t('htb_4_h')}</h3>
                    </div>
                    <ul class="htb-list">
                        <li>${t('htb_4_l1')}</li>
                        <li>${t('htb_4_l2')}</li>
                        <li>${t('htb_4_l3')}</li>
                    </ul>
                    <div class="htb-img"><img src="/images/how-to-buy/step-4.jpg?v=2" alt="Step 4" loading="eager" fetchpriority="high" decoding="async" /></div>
                </section>

                <section class="htb-step">
                    <div class="htb-step-top">
                        <span class="htb-num">05</span>
                        <h3>${t('htb_5_h')}</h3>
                    </div>
                    <p>${t('htb_5_p')}</p>
                    <div class="htb-coupon">keviinn</div>
                    <div class="htb-img"><img src="/images/how-to-buy/step-5.jpg?v=2" alt="Step 5" loading="eager" fetchpriority="high" decoding="async" /></div>
                </section>
            </div>

            <div class="htb-cta">
                <h3>${t('htb_cta_h')}</h3>
                <p>${t('htb_cta_p')}</p>
                <a class="htb-link" href="https://ikako.vip/r/keviinn" target="_blank" rel="noopener">${t('htb_cta_btn')}</a>
            </div>
        </div>
    `,
        qccheck: `
        <style>
            .qc-wrap { max-width: 1400px; margin: 0 auto; padding: 1.5rem 4% 3rem;
                display: flex; flex-direction: column; gap: 1.5rem;
                width: 100%; box-sizing: border-box; }
            .qc-card { background: var(--nav-bg); border: 1px solid var(--border-color);
                border-radius: 16px; padding: 2rem; width: 100%; box-sizing: border-box; }
            .qc-title { font-family:'Inter Tight',system-ui,sans-serif; font-size: 26px; font-weight: 600; letter-spacing: -0.025em;
                color: var(--text-primary); margin-bottom: 0.4rem; line-height: 31px; text-align: left; }
            .qc-subtitle { color: var(--text-secondary); font-size: 14px; margin-bottom: 1.5rem; text-align: left; }
            .qc-row { display: flex; gap: 0.75rem; align-items: stretch; }
            .qc-input { flex: 1; background: var(--bg-color); border: 1px solid var(--border-color);
                border-radius: 14px; padding: 0 1.1rem; height: 52px; color: var(--text-primary);
                font-family: 'Inter', sans-serif; font-size: 0.92rem; outline: none;
                transition: border-color 0.2s; box-sizing: border-box; }
            .qc-input:focus { border-color: var(--text-primary); }
            .qc-input::placeholder { color: var(--text-secondary); opacity: 0.6; }
            .qc-btn { background: var(--text-primary); color: var(--bg-color); border: none;
                border-radius: 14px; padding: 0 1.5rem; height: 52px; font-family: 'Inter', sans-serif;
                font-size: 0.92rem; font-weight: 700; cursor: pointer; white-space: nowrap;
                transition: opacity 0.15s, transform 0.1s; box-sizing: border-box; }
            .qc-btn:hover { opacity: 0.85; } .qc-btn:active { transform: scale(0.97); }
            .qc-btn:disabled { opacity: 0.5; cursor: not-allowed; }
            .qc-status { margin-top: 1rem; padding: 0.9rem 1.1rem; border-radius: 12px;
                background: rgba(128,128,128,0.08); border: 1px solid var(--border-color);
                color: var(--text-primary); font-size: 0.9rem; display: none; }
            .qc-status.err { border-color: #c04040; color: #ff8a8a; }
            .qc-actions { display: flex; gap: 0.5rem; margin-top: 0.75rem; flex-wrap: wrap; }
            .qc-picksly-btn { display: inline-flex; align-items: center; gap: 0.45rem;
                background: var(--bg-color); color: var(--text-primary);
                border: 1px solid var(--border-color); border-radius: 999px;
                padding: 0.55rem 1rem; font-weight: 700; font-size: 0.85rem;
                text-decoration: none; cursor: pointer;
                transition: border-color 0.15s, background 0.15s; }
            .qc-picksly-btn:hover { border-color: var(--text-primary); background: var(--nav-bg); }
            .qc-groups { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
                gap: 1rem; margin-top: 2rem; }
            .qc-batch-card { background: var(--bg-color); border: 1px solid var(--border-color);
                border-radius: 16px; overflow: hidden; cursor: pointer;
                transition: transform 0.15s, border-color 0.2s, box-shadow 0.2s;
                display: flex; flex-direction: column; }
            .qc-batch-card:hover { transform: translateY(-3px); border-color: var(--text-primary);
                box-shadow: 0 8px 24px rgba(0,0,0,0.25); }
            .qc-batch-cover { position: relative; aspect-ratio: 1/1; overflow: hidden;
                background: var(--nav-bg); }
            .qc-batch-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
            .qc-batch-count { position: absolute; bottom: 0.6rem; right: 0.6rem;
                background: rgba(0,0,0,0.75); color: #fff; font-size: 0.75rem; font-weight: 700;
                padding: 0.3rem 0.6rem; border-radius: 999px; backdrop-filter: blur(4px); }
            .qc-batch-info { padding: 0.85rem 1rem; display: flex; flex-direction: column; gap: 0.2rem; }
            .qc-batch-info .qc-group-title { font-size: 0.95rem; font-weight: 700; color: var(--text-primary); }
            .qc-batch-info .qc-group-meta { font-size: 0.78rem; color: var(--text-secondary); }
            .qc-images { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
                gap: 0.75rem; }
            .qc-img-wrap { position: relative; aspect-ratio: 1/1; border-radius: 14px;
                overflow: hidden; cursor: pointer; background: var(--bg-color);
                border: 1px solid var(--border-color); transition: transform 0.15s, border-color 0.2s; }
            .qc-img-wrap:hover { transform: translateY(-2px); border-color: var(--text-primary); }
            .qc-img-wrap img { width: 100%; height: 100%; object-fit: cover; display: block; }
            .qc-batch-modal { position: fixed; inset: 0; background: rgba(0,0,0,0.92);
                z-index: 9998; display: none; overflow-y: auto; padding: 5rem 5% 3rem; }
            .qc-batch-modal.open { display: block; animation: fadeIn 0.25s ease-out; }
            .qc-batch-modal-inner { max-width: 1600px; margin: 0 auto; }
            .qc-batch-modal-head { display: flex; align-items: center; justify-content: space-between;
                margin-bottom: 1.5rem; gap: 1rem; flex-wrap: wrap; }
            .qc-batch-modal-title { color: #fff; font-size: 1.4rem; font-weight: 800; }
            .qc-batch-modal-meta { color: rgba(255,255,255,0.65); font-size: 0.88rem; }
            .qc-batch-back { background: rgba(255,255,255,0.1); color: #fff;
                border: 1px solid rgba(255,255,255,0.2); border-radius: 999px;
                padding: 0.55rem 1.1rem; font-weight: 700; cursor: pointer;
                display: inline-flex; align-items: center; gap: 0.4rem;
                font-family: 'Inter', sans-serif; font-size: 0.88rem;
                transition: background 0.15s; }
            .qc-batch-back:hover { background: rgba(255,255,255,0.18); }
            .qc-lightbox { position: fixed; inset: 0; background: rgba(0,0,0,0.92);
                z-index: 9999; display: none; align-items: center; justify-content: center; padding: 2rem; }
            .qc-lightbox.open { display: flex; }
            .qc-lightbox img { max-width: 95%; max-height: 95vh; border-radius: 12px; }
            .qc-lightbox-close { position: fixed; top: 1.25rem; right: 1.5rem; color: #fff;
                width: 44px; height: 44px; font-size: 1.8rem; font-weight: 400; line-height: 1;
                background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.2);
                border-radius: 999px; cursor: pointer; z-index: 10000;
                display: flex; align-items: center; justify-content: center;
                transition: background 0.15s, transform 0.15s; }
            .qc-lightbox-close:hover { background: rgba(255,255,255,0.15); transform: scale(1.08); }
            .qc-spinner { width: 36px; height: 36px; border: 3px solid var(--border-color);
                border-top-color: var(--text-primary); border-radius: 50%;
                animation: qcspin 0.8s linear infinite; margin: 2rem auto; display: none; }
            .qc-spinner.on { display: block; }
            @keyframes qcspin { to { transform: rotate(360deg); } }
        </style>

        <div class="qc-wrap">
            <div class="qc-card">
                <h2 class="qc-title">${t('qc_title')}</h2>
                <p class="qc-subtitle">${t('qc_subtitle')}</p>
                <div class="qc-row">
                    <input class="qc-input" id="qc-input" type="text" placeholder="${t('qc_placeholder')}" maxlength="200" autocomplete="off" data-action-key="runQcCheck" />
                    <button class="qc-btn" id="qc-submit" data-action="runQcCheck">${t('qc_btn')}</button>
                </div>
                <div class="qc-status" id="qc-status"></div>
                <div class="qc-actions" id="qc-actions" style="display:none;"></div>
                <div class="qc-spinner" id="qc-spinner"></div>
                <div class="qc-groups" id="qc-groups"></div>
            </div>
        </div>
        <div class="qc-batch-modal" id="qc-batch-modal">
            <div class="qc-batch-modal-inner">
                <div class="qc-batch-modal-head">
                    <button class="qc-batch-back" data-action="closeQcBatch">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                        ${t('qc_back')}
                    </button>
                    <div>
                        <div class="qc-batch-modal-title" id="qc-batch-modal-title"></div>
                        <div class="qc-batch-modal-meta" id="qc-batch-modal-meta"></div>
                    </div>
                    <div style="width:90px;"></div>
                </div>
                <div class="qc-images" id="qc-batch-modal-images"></div>
            </div>
        </div>
        <div class="qc-lightbox" id="qc-lightbox" data-action="closeQcLightbox">
            <button class="qc-lightbox-close" data-action="closeQcLightbox" data-stop="click" aria-label="Close">×</button>
            <img id="qc-lightbox-img" alt="" data-stop="click" />
        </div>
    `,
        tools: `
        <style>
            .tools-wrap {
                max-width: 1400px;
                margin: 0 auto;
                padding: 1.5rem 4% 3rem;
                display: flex;
                flex-direction: column;
                gap: 1.5rem;
                width: 100%;
                box-sizing: border-box;
            }
            .tool-card {
                background: var(--nav-bg);
                border: 1px solid var(--border-color);
                border-radius: 16px;
                padding: 2rem;
                width: 100%;
                box-sizing: border-box;
            }
            .tracking-card {
                width: 100%;
                box-sizing: border-box;
            }
            .tool-eyebrow {
                font-family: 'Inter Tight', system-ui, sans-serif;
                font-size: 0.72rem;
                font-weight: 600;
                letter-spacing: 0.1em;
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
            .weight-categories {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
                gap: 0.6rem;
                margin-bottom: 1.5rem;
            }
            .weight-cat-btn {
                background: var(--bg-color);
                border: 1px solid var(--border-color);
                border-radius: 12px;
                padding: 0.75rem 0.5rem;
                color: var(--text-primary);
                font-family: 'Inter', sans-serif;
                font-size: 0.85rem;
                font-weight: 600;
                cursor: pointer;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 0.4rem;
                transition: border-color 0.15s, background 0.15s;
                user-select: none;
            }
            .weight-cat-btn:hover { border-color: var(--text-secondary); }
            .weight-cat-btn.selected {
                border-color: var(--text-primary);
                background: rgba(255,255,255,0.06);
            }
            .weight-cat-count {
                font-size: 0.72rem;
                color: var(--text-secondary);
                font-weight: 500;
            }
            .weight-cat-qty {
                display: flex;
                align-items: center;
                gap: 0.4rem;
                margin-top: 0.3rem;
            }
            .weight-qty-btn {
                width: 24px; height: 24px;
                background: var(--border-color);
                border: none;
                border-radius: 6px;
                color: var(--text-primary);
                font-size: 1rem;
                font-weight: 700;
                cursor: pointer;
                display: flex; align-items: center; justify-content: center;
                transition: background 0.1s;
                flex-shrink: 0;
            }
            .weight-qty-btn:hover { background: var(--text-secondary); }
            .weight-qty-val {
                font-size: 0.85rem;
                font-weight: 700;
                min-width: 18px;
                text-align: center;
            }
            .weight-result-box {
                background: var(--bg-color);
                border: 1px solid var(--border-color);
                border-radius: 16px;
                padding: 1.25rem 1.5rem;
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 1rem;
            }
            .weight-result-total {
                font-size: 2rem;
                font-weight: 900;
                letter-spacing: -1px;
                color: var(--text-primary);
            }
            .weight-result-units {
                display: flex;
                gap: 1.5rem;
            }
            .weight-unit-block {
                text-align: center;
            }
            .weight-unit-val {
                font-size: 1.1rem;
                font-weight: 800;
                color: var(--text-primary);
            }
            .weight-unit-label {
                font-size: 0.7rem;
                font-weight: 600;
                color: var(--text-secondary);
                letter-spacing: 0.08em;
                text-transform: uppercase;
            }
            .weight-disclaimer {
                font-size: 0.75rem;
                color: var(--text-secondary);
                margin-top: 0.75rem;
            }
            .weight-reset-btn {
                background: none;
                border: 1px solid var(--border-color);
                border-radius: 10px;
                color: var(--text-secondary);
                font-family: 'Inter', sans-serif;
                font-size: 0.8rem;
                font-weight: 600;
                padding: 0.4rem 0.9rem;
                cursor: pointer;
                transition: border-color 0.15s, color 0.15s;
            }
            .weight-reset-btn:hover { border-color: var(--text-primary); color: var(--text-primary); }
        </style>

        <div class="tools-wrap">
            <div class="tool-card">
                <div class="tool-eyebrow">${t('tool_eyebrow')}</div>
                <h2 class="tool-title">${t('link_converter')}</h2>
                <p class="tool-subtitle">${t('link_converter_subtitle')}</p>
                <div class="converter-row">
                    <input class="converter-input" id="link-input" type="text" placeholder="${t('link_placeholder')}" maxlength="${LINK_INPUT_MAX_LEN}" autocomplete="off" />
                    <div class="agent-dropdown-wrap">
                        <button class="agent-dropdown-btn" id="agent-dropdown-btn" data-action="toggleAgentDropdown">
                            <span style="display:flex;align-items:center;gap:0.45rem;" id="agent-selected-label">
                                <img src="https://www.google.com/s2/favicons?domain=kakobuy.com&sz=64" style="width:20px;height:20px;border-radius:4px;object-fit:contain;" /> KakoBuy
                            </span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
                        </button>
                        <div class="agent-dropdown-menu" id="agent-dropdown-menu">
                            ${AGENTS.map(a => `<div class="agent-option${a.id === 'kakobuy' ? ' selected' : ''}" data-value="${a.id}" data-action="selectAgent" data-arg="${a.id}" data-arg2="${escapeHtml(a.name)}" data-arg3="https://www.google.com/s2/favicons?domain=${a.domain}&sz=64">
                                <img src="https://www.google.com/s2/favicons?domain=${a.domain}&sz=64" style="width:20px;height:20px;border-radius:4px;object-fit:contain;" /> ${escapeHtml(a.name)}
                            </div>`).join('')}
                        </div>
                    </div>
                    <button class="convert-btn" data-action="convertLink">${t('convert_link')}</button>
                </div>
                <div class="converter-result-new" id="converter-result"></div>
            </div>

            <div class="tool-card" id="weight-estimator-card">
                <div class="tool-eyebrow">SHIPPING</div>
                <h2 class="tool-title">Weight Estimator</h2>
                <p class="tool-subtitle">Select your items to estimate parcel weight before shipping.</p>
                <div class="weight-categories" id="weight-cats"></div>
                <div class="weight-result-box" id="weight-result-box">
                    <div>
                        <div style="font-size:0.72rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--text-secondary);margin-bottom:0.3rem;">Total Weight</div>
                        <div class="weight-result-total" id="weight-total-g">0 g</div>
                    </div>
                    <div class="weight-result-units">
                        <div class="weight-unit-block">
                            <div class="weight-unit-val" id="weight-kg">0.00</div>
                            <div class="weight-unit-label">kg</div>
                        </div>
                        <div class="weight-unit-block">
                            <div class="weight-unit-val" id="weight-lbs">0.00</div>
                            <div class="weight-unit-label">lbs</div>
                        </div>
                        <div class="weight-unit-block">
                            <div class="weight-unit-val" id="weight-pkg">50</div>
                            <div class="weight-unit-label">pkg (g)</div>
                        </div>
                    </div>
                    <button class="weight-reset-btn" data-action="weightReset">Reset</button>
                </div>
                <p class="weight-disclaimer">Weights are approximate averages. Actual weights may vary by ±10-15% depending on brand and materials.</p>
            </div>

            <div class="tracking-card">
                <h2 class="tool-title">${t('package_tracking')}</h2>
                <p class="tool-subtitle" style="margin-bottom:1.25rem;">${t('tools_subtitle')}</p>
                <input class="tracking-input" type="text" placeholder="${t('tracking_placeholder')}" id="tracking-input" maxlength="${INPUT_MAX_LEN}" data-action-input="updateTrackerLinks" />
                <div class="tracker-grid">
                    <a class="tracker-card" href="https://t.17track.net/en" target="_blank" rel="noopener" id="track-17">
                        <div class="tracker-icon" style="background:#fff;display:flex;align-items:center;justify-content:center;"><img src="https://www.google.com/s2/favicons?domain=17track.net&sz=64" style="width:28px;height:28px;object-fit:contain;" /></div>
                        <span class="tracker-name">17TRACK</span>
                        <span class="tracker-open-btn">${t('open_btn')}</span>
                    </a>
                    <a class="tracker-card" href="https://www.dhl.de/en/privatkunden/pakete-empfangen/verfolgen.html" target="_blank" rel="noopener" id="track-dhl">
                        <div class="tracker-icon" style="background:#FFCC00;border-radius:14px;display:flex;align-items:center;justify-content:center;padding:10px;"><img src="/images/dhl-logo.svg" style="width:54px;height:auto;" alt="DHL" /></div>
                        <span class="tracker-name">DHL</span>
                        <span class="tracker-open-btn">${t('open_btn')}</span>
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
    const navLinks = document.querySelectorAll('.nav-link');

    function renderPage(pageId) {
        if (productsRefreshTimer) {
            clearInterval(productsRefreshTimer);
            productsRefreshTimer = null;
        }
        // Inject home styles before rendering home page
        if (pageId === 'home') injectHomeStyles();

        // Show navbar on all pages
        const navEl = document.querySelector('.nav-container');
        if (navEl) navEl.style.display = '';

        if (pageId === 'stores') storesFilter = { platform: 'all', query: '' };
        mainContent.innerHTML = getPages()[pageId] || getPages().home;

        // CSP-safe: handle data-action buttons instead of inline onclick
        mainContent.querySelectorAll('[data-action="go-products"]').forEach(el => {
            el.addEventListener('click', e => {
                e.preventDefault();
                const seller = el.getAttribute('data-seller');
                const cat = el.getAttribute('data-cat');
                if (seller) { filterState.seller = seller; filterState.category = 'All'; }
                else if (cat) { filterState.category = cat; filterState.seller = ''; }
                (window.navigateTo||renderPage)('products');
            });
        });
        mainContent.querySelectorAll('[data-action="go-stores"]').forEach(el => {
            el.addEventListener('click', e => { e.preventDefault(); (window.navigateTo||renderPage)('stores'); });
        });
        // Carousel handlers (arrows + drag scroll)
        attachCarouselHandlers(mainContent);
        mainContent.querySelectorAll('[data-action="go-tools"]').forEach(el => {
            el.addEventListener('click', e => { e.preventDefault(); (window.navigateTo||renderPage)('tools'); });
        });

        navLinks.forEach(link => {
            link.classList.toggle('active', link.getAttribute('data-page') === pageId);
        });
        updateNavIndicator(pageId);

        document.querySelectorAll('.bottom-nav-item').forEach(item => {
            item.classList.toggle('active', item.getAttribute('data-page') === pageId);
        });

        // Show/hide the navbar search depending on scroll past the hero search.
        if (window.requestAnimationFrame) requestAnimationFrame(setupNavSearchReveal);
        else setupNavSearchReveal();

        if (pageId === 'tools') {
            if (window.initWeightEstimator) window.initWeightEstimator();
        }

        // Re-attach hover-pause listeners every time home is rendered.
        // The home DOM (including #rv-track) is rebuilt on each navigation,
        // so a single startup call would only work for the first visit.
        if (pageId === 'home') {
            // Home search bar
            const homeSearch = document.getElementById('home-search');
            if (homeSearch) {
                homeSearch.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && homeSearch.value.trim()) {
                        filterState.search = homeSearch.value.trim();
                        navigateTo('products');
                    }
                });
            }
            const pasteBtn = document.getElementById('home-paste-btn');
            if (pasteBtn) {
                pasteBtn.addEventListener('click', async () => {
                    try {
                        const text = await navigator.clipboard.readText();
                        if (homeSearch && text) { homeSearch.value = text; homeSearch.focus(); }
                    } catch(e) {}
                });
            }
            // Home category tabs
            document.querySelectorAll('.pl-cat[data-home-cat]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const cat = btn.getAttribute('data-home-cat');
                    filterState.seller = '';
                    if (cat === 'All') {
                        filterState.category = 'All';
                    } else {
                        filterState.category = cat;
                    }
                    navigateTo('products');
                });
            });
            initRvMarquee();
            // 12s after home is shown, refetch popularity bypassing the
            // edge cache. Catches the case where the first call happened
            // before any clicks existed (so the marquee was all-fallback).
            setTimeout(() => {
                if (pageFromPath() !== 'home') return;
                loadPopularProducts({ force: true }).then(() => {
                    if (pageFromPath() === 'home') refreshHomeMarquee();
                });
            }, 12000);
        }

        if (pageId === 'stores') {
            const reRenderStores = () => {
                const el = document.getElementById('stores-page');
                if (el) { el.innerHTML = buildStoresPage(); attachCarouselHandlers(mainContent); }
            };
            // Platform pills
            document.querySelectorAll('.stores-pill').forEach(btn => {
                btn.addEventListener('click', () => {
                    storesFilter.platform = btn.dataset.plat;
                    document.querySelectorAll('.stores-pill').forEach(b => b.classList.toggle('active', b === btn));
                    reRenderStores();
                });
            });
            // Search (sellers + products), debounced
            const ss = document.getElementById('stores-search-input');
            if (ss) {
                ss.value = storesFilter.query || '';
                let tmr;
                ss.addEventListener('input', () => {
                    clearTimeout(tmr);
                    tmr = setTimeout(() => { storesFilter.query = ss.value; reRenderStores(); }, 200);
                });
            }
            // Fill the catalog first if this was a cold deep-link.
            if (allProductsCache.length === 0) {
                (window._prefetchPromise || fetchFromSupabase()).then(data => {
                    if (Array.isArray(data) && !allProductsCache.length) allProductsCache = data;
                    reRenderStores();
                }).catch(() => {});
            }
        }

        if (pageId === 'products') {
            filterState = { search: filterState.search || '', category: filterState.category || 'All', batch: 'All Tags', seller: filterState.seller || '' };

            // Bind pl-cat tabs on products page — each updates URL
            document.querySelectorAll('.pl-cat[data-pl-cat]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const cat = btn.getAttribute('data-pl-cat');
                    filterState.category = cat;
                    filterState.seller = '';
                    // Update URL
                    const slug = cat.toLowerCase();
                    history.pushState({ page: 'products' }, '', '/products/' + slug);
                    document.querySelectorAll('.pl-cat[data-pl-cat]').forEach(b => b.classList.toggle('active', b.getAttribute('data-pl-cat') === cat));
                    renderFilteredProducts();
                });
            });

            // Bind search input
            const plSearch = document.getElementById('kf-search');
            if (plSearch) {
                if (filterState.search) plSearch.value = filterState.search;
                plSearch.addEventListener('input', () => {
                    filterState.search = plSearch.value.trim();
                    renderFilteredProducts();
                });
            }

            // Paste button
            const pasteBtn = document.getElementById('products-paste-btn');
            if (pasteBtn && plSearch) {
                pasteBtn.addEventListener('click', async () => {
                    try {
                        const text = await navigator.clipboard.readText();
                        if (text) { plSearch.value = text; plSearch.dispatchEvent(new Event('input')); }
                    } catch(e) {}
                });
            }

            const onData = (data) => {
                lastProductsSignature = JSON.stringify(data);
                allProductsCache = data;
                window.allProductsCache = data;
                const loader = document.getElementById('loading-text');
                if (loader) loader.remove();
                bindFilterEvents();
                renderFilteredProducts();
                requestAnimationFrame(() => {
                    document.querySelectorAll('.product-card:not(.sr-visible)').forEach(card => {
                        if (card.getBoundingClientRect().top < window.innerHeight + 100) {
                            card.classList.add('sr-visible');
                        }
                    });
                });
                const info = document.getElementById('kf-results-info');
                if (info) info.textContent = t('showing_of', { a: data.length, b: data.length });
                productsRefreshTimer = setInterval(() => refreshProductsFromServer(true), PRODUCTS_AUTO_REFRESH_MS);
            };

            if (allProductsCache.length > 0) {
                onData(allProductsCache);
            } else {
                if (window.showSkeletonCards) window.showSkeletonCards(10);
                (window._prefetchPromise || fetchFromSupabase())
                    .then(onData)
                    .catch(err => {
                        const container = document.getElementById('products-container');
                        if (container) container.innerHTML = `<p style="grid-column:1/-1;color:#ff6b6b;text-align:center;">${escapeHtml(t('products_error', { e: err && err.message ? err.message : 'unknown' }))}</p>`;
                    });
            }
        }
    }

    const VALID_PAGES = ['home', 'products', 'tutorials', 'qccheck', 'tools', 'stores'];
    // Product sub-routes: /products/shoes, /products/hoodies etc.
    const PRODUCT_CATS_ROUTES = ['all','shoes','slides','shorts','pants','t-shirts','long-sleeve','hoodies','jackets','accessories'];
    function pageFromPath() {
        const path = (window.location.pathname || '/').replace(/^\/+|\/+$/g, '').toLowerCase();
        if (VALID_PAGES.includes(path)) return path;
        // Handle /products/category routes
        const parts = path.split('/');
        if (parts[0] === 'products' && parts[1] && PRODUCT_CATS_ROUTES.includes(parts[1])) return 'products';
        return 'home';
    }
    function catFromPath() {
        const parts = (window.location.pathname || '/').replace(/^\/+|\/+$/g, '').toLowerCase().split('/');
        if (parts[0] === 'products' && parts[1]) {
            if (parts[1] === 'all') return 'All';
            if (PRODUCT_CATS_ROUTES.includes(parts[1])) {
                return CATEGORIES.find(c => c.toLowerCase() === parts[1]) || 'All';
            }
        }
        return null;
    }
    function updateNavIndicator(pageId) {
        // Disabled — no pill indicator needed
    }

    function navigateTo(pageId, replace) {
        if (!VALID_PAGES.includes(pageId)) pageId = 'home';
        let path;
        if (pageId === 'products') {
            path = '/products/' + (filterState.category || 'All').toLowerCase();
        } else {
            path = pageId === 'home' ? '/' : '/' + pageId;
        }
        if (window.location.pathname !== path) {
            if (replace) history.replaceState({ page: pageId }, '', path);
            else history.pushState({ page: pageId }, '', path);
        }
        mainContent.classList.add('page-exit');
        setTimeout(() => {
            renderPage(pageId);
            mainContent.classList.remove('page-exit');
        }, 120);
    }
    window.navigateTo = navigateTo;

    navLinks.forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            navigateTo(link.getAttribute('data-page'));
        });
    });

    document.querySelectorAll('.bottom-nav-item').forEach(item => {
        item.addEventListener('click', e => {
            e.preventDefault();
            navigateTo(item.getAttribute('data-page'));
        });
    });

    // Global navbar search (persists across pages since the navbar is static).
    // Enter applies the term to the product filter and jumps to /products.
    const navSearch = document.getElementById('nav-search');
    if (navSearch) {
        navSearch.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                filterState.search = navSearch.value.trim();
                navigateTo('products');
            }
        });
    }
    const navPaste = document.getElementById('nav-paste-btn');
    if (navPaste && navSearch) {
        navPaste.addEventListener('click', async () => {
            try {
                const text = await navigator.clipboard.readText();
                if (text) { navSearch.value = text; navSearch.focus(); }
            } catch (_) {}
        });
    }
    // Bind the scroll-reveal once; the handler resolves the current hero bar
    // dynamically, so it works on every page without per-render setup.
    setupNavSearchReveal();

    window.addEventListener('popstate', () => {
        const urlCat = catFromPath();
        if (urlCat) filterState.category = urlCat;
        else if (pageFromPath() === 'products') filterState.category = 'All';
        renderPage(pageFromPath());
    });

    const initial = pageFromPath();
    // If URL is /products/shoes etc., set the category filter before rendering
    const urlCat = catFromPath();
    if (urlCat) filterState.category = urlCat;
    history.replaceState({ page: initial }, '', window.location.pathname === '/' ? '/' : window.location.pathname);
    renderPage(initial);

    // Hover-pause is now handled by .rv-track-wrap:hover in CSS — no
    // JS listeners needed, so re-renders of the marquee can't break it.
    function initRvMarquee() { /* no-op, kept for callers */ }
    initRvMarquee();

    // Prefetch products in background so Products page loads instantly,
    // and pull global popularity rankings in parallel.
    if (initial !== 'products' && allProductsCache.length === 0) {
        window._prefetchPromise = Promise.all([
            fetchFromSupabase().then(data => {
                lastProductsSignature = JSON.stringify(data);
                allProductsCache = data;
                window.allProductsCache = data;
                return data;
            }),
            loadPopularProducts(),
        ]).then(() => {
            window._prefetchPromise = null;
            if (pageFromPath() === 'home') refreshHomeMarquee();
        }).catch(() => { window._prefetchPromise = null; });
    } else {
        // Catalog already loaded -> just refresh popularity in the background.
        loadPopularProducts().then(() => {
            if (pageFromPath() === 'home') refreshHomeMarquee();
        });
    }
}

// ─── WELCOME MODAL ─────────────────────────────────────────────────────────
function showWelcomeModal() {
    if (localStorage.getItem('jf_onboarded')) return;

    const LANGS   = [
        { id:'EN', flag:'GB', label:'English' },
        { id:'RON', flag:'RO', label:'Română' },
        { id:'PLN', flag:'PL', label:'Polski' },
        { id:'CNY', flag:'CN', label:'中文' },
    ];
    const CURRENCIES = [
        { id:'USD', label:'$ USD' }, { id:'EUR', label:'€ EUR' },
        { id:'RON', label:'RON' },   { id:'PLN', label:'zł PLN' },
        { id:'CNY', label:'¥ CNY' },
    ];
    let selLang  = currentCurrency === 'RON' ? 'RON' : currentCurrency === 'PLN' ? 'PLN' : currentCurrency === 'CNY' ? 'CNY' : 'EN';
    let selCur   = currentCurrency;

    const S = {
        pill: (on) => `padding:.5rem 1.1rem;border-radius:999px;font-size:.85rem;font-weight:600;cursor:pointer;white-space:nowrap;transition:all .15s;border:1.5px solid ${on?'#ff9f0a':'#404040'};background:${on?'#ff9f0a':'transparent'};color:${on?'#fff':'#888'};`,
    };

    const overlay = document.createElement('div');
    overlay.id = 'jf-welcome-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.8);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;padding:1rem;animation:fadeIn .3s ease;overflow-y:auto;';

    overlay.innerHTML = `
    <style>
        .jf-wel-cta:hover { opacity: 0.85; }
        .jf-wel-signup { display:inline-flex;align-items:center;gap:.5rem;padding:.7rem 1.3rem;border-radius:999px;background:transparent;color:#ff9f0a;font-weight:600;font-size:.85rem;text-decoration:none;border:1.5px solid #ff9f0a;transition:all .15s;white-space:nowrap; }
        .jf-wel-signup:hover { background:#ff9f0a;color:#fff; }
    </style>
    <div style="background:#242424;border-radius:24px;width:100%;max-width:960px;overflow:hidden;box-shadow:0 40px 120px rgba(0,0,0,.8);animation:jfFadeUp .35s cubic-bezier(.16,1,.3,1);">

        <!-- Header -->
        <div style="padding:1.4rem 2.2rem 1.2rem;border-bottom:1px solid #333;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                <div>
                    <div style="font-size:1.8rem;font-weight:800;letter-spacing:-1px;line-height:1;margin-bottom:.4rem;">
                        <span style="color:#fff;">jarvis</span> <span style="color:#ff9f0a;">finder</span>
                    </div>
                    <p style="color:#666;font-size:.9rem;margin:0;">Customize your experience before you start.</p>
                </div>
                <button data-action="jfWelDone" style="background:none;border:none;color:#555;cursor:pointer;padding:.3rem;font-size:1.2rem;line-height:1;">✕</button>
            </div>
        </div>

        <!-- Prefs -->
        <div style="padding:1.2rem 2.2rem;display:flex;flex-direction:column;gap:1rem;border-bottom:1px solid #333;">

            <div>
                <p style="color:#666;font-size:.7rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;margin-bottom:.6rem;">Language</p>
                <div style="display:flex;gap:.4rem;flex-wrap:wrap;" id="jf-lang-grid">
                    ${LANGS.map(l=>`<button data-action="jfWelSelLang" data-arg="${escapeHtml(l.id)}" id="jf-wl-${escapeHtml(l.id)}" style="${S.pill(l.id===selLang)}">${escapeHtml(l.label)}</button>`).join('')}
                </div>
            </div>

            <div>
                <p style="color:#666;font-size:.7rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;margin-bottom:.6rem;">Currency</p>
                <div style="display:flex;gap:.4rem;flex-wrap:wrap;" id="jf-cur-grid">
                    ${CURRENCIES.map(c=>`<button data-action="jfWelSelCur" data-arg="${escapeHtml(c.id)}" id="jf-wc-${escapeHtml(c.id)}" style="${S.pill(c.id===selCur)}">${escapeHtml(c.label)}</button>`).join('')}
                </div>
            </div>

        </div>

        <!-- KakoBuy Sign Up — minimalist -->
        <div style="padding:1.4rem 2.2rem;border-bottom:1px solid #2a2a2a;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:1.2rem;flex-wrap:wrap;">
                <div style="flex:1;min-width:240px;">
                    <p style="color:#fff;font-size:.95rem;font-weight:600;margin:0 0 .25rem;line-height:1.3;">
                        $450 sign-up bonus on <span style="color:#ff9f0a;">KakoBuy</span>
                    </p>
                    <p style="color:#666;font-size:.78rem;margin:0;line-height:1.4;">
                        Optional. Costs you nothing &middot; keeps this site free.
                        <span style="color:#888;">Code <span style="color:#fff;font-family:'JetBrains Mono',ui-monospace,monospace;">keviinn</span></span>
                    </p>
                </div>
                <a href="https://ikako.vip/r/keviinn" target="_blank" rel="noopener noreferrer" class="jf-wel-signup">
                    Sign up
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
                </a>
            </div>
        </div>

        <!-- CTA -->
        <div style="padding:1.2rem 2.2rem;">
            <button data-action="jfWelDone" class="jf-wel-cta" style="width:100%;padding:.85rem;border-radius:999px;border:none;background:#ff9f0a;color:#fff;font-size:.95rem;font-weight:700;cursor:pointer;transition:opacity .15s;">
                Get Started →
            </button>
            <p style="text-align:center;margin-top:.8rem;">
                <span data-action="jfWelDone" style="color:#444;font-size:.8rem;cursor:pointer;">Maybe later</span>
            </p>
        </div>
    </div>`;

    document.body.appendChild(overlay);

    window.jfWelSelLang = function(l) {
        selLang = l;
        document.querySelectorAll('[id^="jf-wl-"]').forEach(btn => {
            const on = btn.id === 'jf-wl-' + l;
            btn.style.background = on ? '#ff9f0a' : 'transparent';
            btn.style.borderColor = on ? '#ff9f0a' : '#404040';
            btn.style.color = on ? '#fff' : '#888';
        });
        const map = { EN:'USD', RON:'RON', PLN:'PLN', CNY:'CNY' };
        if (map[l]) window.jfWelSelCur(map[l]);
    };

    window.jfWelSelCur = function(c) {
        selCur = c;
        document.querySelectorAll('[id^="jf-wc-"]').forEach(btn => {
            const on = btn.id === 'jf-wc-' + c;
            btn.style.background = on ? '#ff9f0a' : 'transparent';
            btn.style.borderColor = on ? '#ff9f0a' : '#404040';
            btn.style.color = on ? '#fff' : '#888';
        });
    };

    window.jfWelDone = function() {
        localStorage.setItem('jf_onboarded', '1');
        localStorage.setItem('jf_lang', selLang);
        if (selCur !== currentCurrency) window.changeCurrencyUI(selCur);
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.25s';
        setTimeout(() => overlay.remove(), 260);
    };
}

// Save scroll position before unload
window.addEventListener('beforeunload', () => {
    sessionStorage.setItem('jf-scroll', window.scrollY);
    sessionStorage.setItem('jf-path', window.location.pathname);
});

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

    // Restore scroll position on refresh (same path only)
    const savedPath = sessionStorage.getItem('jf-path');
    const savedScroll = sessionStorage.getItem('jf-scroll');
    if (savedPath === window.location.pathname && savedScroll) {
        // Wait for content to render then restore
        setTimeout(() => window.scrollTo(0, parseInt(savedScroll)), 300);
    }
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
    if (btn) btn.innerHTML = `<img src="${escapeHtml(safeExternalUrl(imgSrc))}" style="width:20px;height:20px;border-radius:4px;object-fit:contain;" /> ${escapeHtml(label)}`;
    document.querySelectorAll('.agent-option').forEach(o => {
        o.classList.toggle('selected', o.dataset.value === value);
    });
    const menu = document.getElementById('agent-dropdown-menu');
    if (menu) menu.classList.remove('open');
};

// ─── QC CHECKER ────────────────────────────────────────────────────────────
function qcPickslyToSource(url) {
    const m = url.match(/picks\.ly\/item\/(WD|TB|1688|AL)(\d+)/i);
    if (!m) return null;
    const prefix = m[1].toUpperCase(), id = m[2];
    if (prefix === 'WD') return `https://weidian.com/item.html?itemID=${id}`;
    if (prefix === 'TB') return `https://item.taobao.com/item.htm?id=${id}`;
    if (prefix === '1688' || prefix === 'AL') return `https://detail.1688.com/offer/${id}.html`;
    return null;
}
function qcSourceToPicksly(src) {
    if (!src) return null;
    if (/picks\.ly\/item\//i.test(src)) return src;
    try {
        const u = new URL(src);
        const host = u.hostname.toLowerCase();
        const q = u.searchParams;
        if (host.includes('weidian.com')) {
            const id = q.get('itemID') || q.get('itemId') || q.get('id');
            if (id) return `https://picks.ly/item/WD${id}`;
        }
        if (host.includes('taobao.com') || host.includes('tmall.com')) {
            const id = q.get('id');
            if (id) return `https://picks.ly/item/TB${id}`;
        }
        if (host.includes('1688.com')) {
            const m = u.pathname.match(/\/offer\/(\d+)/);
            if (m) return `https://picks.ly/item/1688${m[1]}`;
        }
    } catch (_) { /* bad URL */ }
    return null;
}
function qcBuildSource(shop, id) {
    const s = (shop || '').toLowerCase();
    if (s === 'weidian' || s === 'wd') return `https://weidian.com/item.html?itemID=${id}`;
    if (s === 'taobao' || s === 'tb') return `https://item.taobao.com/item.htm?id=${id}`;
    if (s === 'tmall') return `https://detail.tmall.com/item.htm?id=${id}`;
    if (s === '1688' || s === 'ali' || s === 'al') return `https://detail.1688.com/offer/${id}.html`;
    return null;
}
function qcNormalizeSource(raw) {
    let u = (raw || '').trim();
    if (!u) return null;

    // picks.ly
    if (/picks\.ly\/item\//i.test(u)) return qcPickslyToSource(u);

    // Direct source — pass through
    if (/weidian\.com|taobao\.com|tmall\.com|1688\.com/i.test(u)) return u;

    // Agent links: extract url= / link= query param (kakobuy, superbuy, cssbuy, etc.)
    try {
        const urlObj = new URL(u);
        const q = urlObj.searchParams;
        const nested = q.get('url') || q.get('link') || q.get('u') || q.get('target') || q.get('href');
        if (nested) {
            const dec = decodeURIComponent(nested);
            if (/weidian\.com|taobao\.com|tmall\.com|1688\.com/i.test(dec)) return dec;
        }
        // ACBuy / Mulebuy / Hoobuy style: shop_type=X&id=Y  OR  source=X&id=Y  OR  platform=X&id=Y  OR  /<shop>/<id>
        const shop = q.get('shop_type') || q.get('source') || q.get('platform') || q.get('shoptype') || q.get('from');
        const id   = q.get('id') || q.get('goods_id') || q.get('itemID') || q.get('goodsId');
        if (shop && id) {
            const built = qcBuildSource(shop, id);
            if (built) return built;
        }
        // Path style: /product/weidian/123456 or /item/tb-123456
        const pathMatch = urlObj.pathname.match(/\/(weidian|taobao|tmall|1688|wd|tb|al)[\/\-_]+(\d{6,})/i);
        if (pathMatch) {
            const built = qcBuildSource(pathMatch[1], pathMatch[2]);
            if (built) return built;
        }
    } catch (_) { /* bad URL */ }
    return null;
}
window.runQcCheck = async function () {
    const input = document.getElementById('qc-input');
    const statusEl = document.getElementById('qc-status');
    const spinner = document.getElementById('qc-spinner');
    const groupsEl = document.getElementById('qc-groups');
    const btn = document.getElementById('qc-submit');
    const raw = (input.value || '').trim().slice(0, 200);

    statusEl.style.display = 'none';
    statusEl.classList.remove('err');
    groupsEl.innerHTML = '';
    const actionsEl = document.getElementById('qc-actions');
    if (actionsEl) { actionsEl.innerHTML = ''; actionsEl.style.display = 'none'; }

    // picks.ly → source conversion (partner API doesn't accept picks.ly links directly)
    let src = raw;
    if (/picks\.ly\/item\//i.test(raw)) {
        src = qcPickslyToSource(raw);
        if (!src) {
            statusEl.textContent = t('qc_invalid_picksly');
            statusEl.classList.add('err');
            statusEl.style.display = 'block';
            return;
        }
    }
    if (!/^https?:\/\//i.test(src)) {
        statusEl.textContent = t('qc_paste_full');
        statusEl.classList.add('err');
        statusEl.style.display = 'block';
        return;
    }

    btn.disabled = true; spinner.classList.add('on');
    try {
        const api = `/api/qc?url=${encodeURIComponent(src)}`;
        const r = await fetch(api);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        if (!data.success) throw new Error(data.error || data.message || 'No QC data');

        // Accept multiple response shapes: groups / albums / qc / results
        const rawGroups = data.groups || data.albums || data.qc || data.results || data.data || [];
        const groups = Array.isArray(rawGroups) ? rawGroups : [];
        if (!groups.length) {
            statusEl.textContent = t('qc_none');
            statusEl.classList.add('err');
            statusEl.style.display = 'block';
            return;
        }

        // Build normalized batch list, store globally for modal
        const batches = groups.map((g, gi) => {
            const rawImgs = g.images || g.photos || g.pictures || g.imgs || [];
            const imgs = (Array.isArray(rawImgs) ? rawImgs : []).map(i =>
                typeof i === 'string' ? i : (i.url || i.src || i.href || i.image || '')
            ).filter(Boolean);
            const label = [g.size && ('Size: ' + g.size), g.color && ('Color: ' + g.color)]
                .filter(Boolean).join(' · ') || g.label || g.title || g.variant || `${t('qc_batch')} ${gi + 1}`;
            const date = (g.date || g.time || g.created_at || '').toString().slice(0, 10);
            const source = g.source || g.agent || '';
            const meta = [date, source].filter(Boolean).join(' · ');
            return { label, meta, imgs };
        }).filter(b => b.imgs.length);
        window._qcBatches = batches;

        groupsEl.innerHTML = batches.map((b, bi) => `
            <div class="qc-batch-card" data-action="openQcBatch" data-arg="${bi}">
                <div class="qc-batch-cover">
                    <img src="${escapeHtml(safeExternalUrl(b.imgs[0]))}" loading="lazy" alt="${escapeHtml(b.label)}"/>
                    <div class="qc-batch-count">${b.imgs.length} ${t('qc_photos')}</div>
                </div>
                <div class="qc-batch-info">
                    <div class="qc-group-title">${escapeHtml(b.label)}</div>
                    <div class="qc-group-meta">${escapeHtml(b.meta) || '&nbsp;'}</div>
                </div>
            </div>
        `).join('');

        statusEl.textContent = t('qc_found', { n: groups.length });
        statusEl.style.display = 'block';

        // "View on picks.ly" button — original link if it was picks.ly, otherwise derive from source.
        const pickslyUrl = /picks\.ly\/item\//i.test(raw) ? raw : qcSourceToPicksly(src);
        if (actionsEl) {
            actionsEl.style.display = 'flex';
            // Build Buy Now button — derive marketplace URL from source
            const buyUrl = safeExternalUrl(src);
            const buyBtnHtml = (buyUrl && buyUrl !== '#')
                ? `<button class="card-btn-buy" data-kakobuy="${escapeHtml(buyUrl)}" style="padding:0.55rem 1.2rem;font-size:0.85rem;">Buy Now</button>`
                : '';
            const pickslyBtnHtml = pickslyUrl
                ? `<a class="qc-picksly-btn" href="${escapeHtml(safeExternalUrl(pickslyUrl))}" target="_blank" rel="noopener noreferrer">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    ${t('qc_view_picksly')}
                </a>`
                : '';
            actionsEl.innerHTML = buyBtnHtml + pickslyBtnHtml;
        }
    } catch (err) {
        statusEl.textContent = t('qc_failed', { e: err.message });
        statusEl.classList.add('err');
        statusEl.style.display = 'block';
    } finally {
        btn.disabled = false; spinner.classList.remove('on');
    }
};
window.openQcBatch = function (idx) {
    const b = (window._qcBatches || [])[idx];
    if (!b) return;
    document.getElementById('qc-batch-modal-title').textContent = b.label;
    document.getElementById('qc-batch-modal-meta').textContent = [b.meta, `${b.imgs.length} ${t('qc_photos')}`].filter(Boolean).join(' · ');
    const imagesContainer = document.getElementById('qc-batch-modal-images');
    while (imagesContainer.firstChild) imagesContainer.removeChild(imagesContainer.firstChild);
    b.imgs.forEach((url, i) => {
        const wrap = document.createElement('div');
        wrap.className = 'qc-img-wrap';
        const safeUrl = safeExternalUrl(url);
        wrap.addEventListener('click', () => { if (safeUrl !== '#') openQcLightbox(safeUrl); });
        const img = document.createElement('img');
        img.src = safeUrl;
        img.loading = 'lazy';
        img.alt = `QC ${idx}-${i}`;
        wrap.appendChild(img);
        imagesContainer.appendChild(wrap);
    });
    document.getElementById('qc-batch-modal').classList.add('open');
    document.body.style.overflow = 'hidden';
    window.scrollTo(0, 0);
    // Hide navbar + bottom nav
    const nav = document.querySelector('.nav-container');
    const bottomNav = document.getElementById('bottom-nav');
    if (nav) { nav.style.transition = 'opacity 0.2s ease'; nav.style.opacity = '0'; nav.style.pointerEvents = 'none'; }
    if (bottomNav) { bottomNav.style.transition = 'opacity 0.2s ease'; bottomNav.style.opacity = '0'; bottomNav.style.pointerEvents = 'none'; }
};
window.closeQcBatch = function () {
    document.getElementById('qc-batch-modal').classList.remove('open');
    if (!document.getElementById('qc-lightbox').classList.contains('open')) {
        document.body.style.overflow = '';
    }
    // Show navbar + bottom nav again
    const nav = document.querySelector('.nav-container');
    const bottomNav = document.getElementById('bottom-nav');
    if (nav) { nav.style.opacity = '1'; nav.style.pointerEvents = ''; }
    if (bottomNav) { bottomNav.style.opacity = '1'; bottomNav.style.pointerEvents = ''; }
};
window.openQcLightbox = function (url) {
    document.getElementById('qc-lightbox-img').src = url;
    document.getElementById('qc-lightbox').classList.add('open');
    document.body.style.overflow = 'hidden';
};
window.closeQcLightbox = function () {
    document.getElementById('qc-lightbox').classList.remove('open');
    document.body.style.overflow = '';
};
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const lb = document.getElementById('qc-lightbox');
        if (lb && lb.classList.contains('open')) { closeQcLightbox(); return; }
        const bm = document.getElementById('qc-batch-modal');
        if (bm && bm.classList.contains('open')) closeQcBatch();
    }
});

// ─── LINK CONVERTER ────────────────────────────────────────────────────────
// ─── RECENTLY VIEWED ───────────────────────────────────────────────────────
const RV_KEY = 'jf_recently_viewed';
const RV_MAX = 20;

// Exposed for the search-focus panel (Trending chips). Derives the most common
// meaningful words across the most-clicked product titles.
window.jfTrendingTerms = function(n) {
    const STOP = new Set(['the','and','for','with','new','set','pcs','size','color','colour','style','men','women','of','pack','quality','version','tee','shirt','shoes','batch','best','budget','random']);
    const freq = new Map();
    (popularTitlesOrder || []).slice(0, 300).forEach(t => {
        String(t).split(/[^a-z0-9]+/i).forEach(w => {
            w = w.trim().toLowerCase();
            if (w.length < 3 || STOP.has(w) || /^\d+$/.test(w)) return;
            freq.set(w, (freq.get(w) || 0) + 1);
        });
    });
    return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, n || 8).map(e => e[0]);
};

// Exposed raw recently-viewed list (personal, from localStorage) for thumbnails.
window.jfRecentlyViewedRaw = function() {
    try { return JSON.parse(localStorage.getItem(RV_KEY)) || []; } catch (e) { return []; }
};

// Delegated listener: picks up clicks on .product-card and reads the
// HTML-escaped JSON from data-rv. Inline onclick removed to harden against
// stored XSS via product fields.
document.addEventListener('click', function(e) {
    const card = e.target.closest && e.target.closest('.product-card[data-rv]');
    if (card) {
        const raw = card.getAttribute('data-rv');
        if (raw) window.trackRecentlyViewed(raw);
    }

    // Agent popup: intercept Buy Now button clicks
    const buyBtn = e.target.closest && e.target.closest('button.card-btn-buy[data-kakobuy]');
    if (buyBtn) {
        e.preventDefault();
        e.stopPropagation();
        const kakobuyUrl = buyBtn.getAttribute('data-kakobuy');
        if (kakobuyUrl && kakobuyUrl !== '#') showAgentPopup(kakobuyUrl);
        // Also track popularity
        const cardEl = buyBtn.closest('.product-card, .hc-card');
        if (cardEl) {
            const titleEl = cardEl.querySelector('.product-title');
            const title = titleEl ? titleEl.textContent.trim() : '';
            if (title && window.jfTrackClick) window.jfTrackClick(title);
        }
        return;
    }

    // Universal popularity tracking for QC links
    const link = e.target.closest && e.target.closest('a.card-btn-qc');
    if (link) {
        const cardEl = link.closest('.product-card, .hc-card');
        if (cardEl) {
            const titleEl = cardEl.querySelector('.product-title');
            const title = titleEl ? titleEl.textContent.trim() : '';
            if (title && window.jfTrackClick) window.jfTrackClick(title);
        }
    }
});

window.trackRecentlyViewed = function(jsonStr) {
    try {
        // jsonStr comes from card.getAttribute('data-rv') which returns the
        // browser-decoded value. Do NOT manually decode entities again — that
        // would corrupt legitimate titles containing literal "&quot;" text.
        const item = JSON.parse(String(jsonStr || ''));
        // Re-validate URLs on the way into localStorage so a tampered DOM
        // can't inject javascript: URLs that are later rendered in the marquee.
        if (item && typeof item === 'object') {
            if (item.kakobuy) item.kakobuy = sanitizeStoredUrl(item.kakobuy);
            if (item.picksly) item.picksly = sanitizeStoredUrl(item.picksly);
            if (item.img) item.img = sanitizeStoredUrl(item.img);
        }
        let rv = [];
        try { rv = JSON.parse(localStorage.getItem(RV_KEY)) || []; } catch(e) {}
        rv = rv.filter(x => x.title !== item.title);
        rv.unshift(item);
        if (rv.length > RV_MAX) rv = rv.slice(0, RV_MAX);
        localStorage.setItem(RV_KEY, JSON.stringify(rv));
    } catch(e) {}
};

// Global popularity cache. Filled by /api/popular on startup.
// Map: lowercased title -> click count. Same data shown to every visitor.
let popularTitlesOrder = []; // ordered list of titles, most-clicked first
let popularLoaded = false;

function getRecentlyViewed() {
    // Universal feed: most-clicked products first, padded with newest items
    // so the marquee always has at least RV_MAX cards (otherwise a single
    // popular item would just loop alone and look broken).
    const cache = (typeof allProductsCache !== 'undefined' ? allProductsCache : []) || [];
    if (!cache.length) return [];

    const out = [];
    const seen = new Set();
    if (popularTitlesOrder.length) {
        const byTitle = new Map(cache.map(p => [String(p.title || '').toLowerCase(), p]));
        for (const t of popularTitlesOrder) {
            const p = byTitle.get(t);
            if (p && !seen.has(p.title)) {
                out.push(p);
                seen.add(p.title);
                if (out.length >= RV_MAX) return out;
            }
        }
    }
    // Pad with newest catalog items (catalog tail, ordered newest-first).
    const newest = cache.slice(-RV_MAX * 2).reverse();
    for (const p of newest) {
        if (!seen.has(p.title)) {
            out.push(p);
            seen.add(p.title);
            if (out.length >= RV_MAX) break;
        }
    }
    return out;
}

// Reveal the navbar search bar once the page's primary (hero/products) search
// bar has been scrolled out of view, mirroring picks.ly. A plain scroll
// listener is used instead of IntersectionObserver because the page's
// overflow:clip ancestor stops IO (viewport root) from ever firing.
let _navSearchScrollBound = false;
function _updateNavSearchReveal() {
    const navWrap = document.getElementById('nav-search-wrap');
    if (!navWrap) return;
    const hero = document.getElementById('home-search') || document.getElementById('kf-search');
    if (!hero) { navWrap.classList.remove('show'); return; }
    // Trigger on the input text itself: reveal the navbar search the moment
    // the hero "Search products..." input scrolls up under the 77px navbar.
    const past = hero.getBoundingClientRect().bottom < 77;
    navWrap.classList.toggle('show', past);
}
function setupNavSearchReveal() {
    if (!_navSearchScrollBound) {
        _navSearchScrollBound = true;
        // Poll via rAF instead of the scroll event: this page's overflow:clip
        // ancestor stops scroll events from firing, so an event listener never
        // runs. The loop only does work when the scroll position changes.
        let lastY = -1;
        (function loop() {
            const y = window.scrollY || document.documentElement.scrollTop || 0;
            if (y !== lastY) { lastY = y; _updateNavSearchReveal(); }
            requestAnimationFrame(loop);
        })();
    }
    _updateNavSearchReveal();
}

// Top-N most-clicked products within a single category (global click data),
// padded with the newest items of that category so a section is never thin.
function getPopularInCategory(cat, n) {
    const cache = (typeof allProductsCache !== 'undefined' ? allProductsCache : []) || [];
    const lc = String(cat || '').toLowerCase();
    const inCat = cache.filter(p => (p.category || '').toLowerCase() === lc);
    if (!inCat.length) return [];

    const out = [];
    const seen = new Set();
    if (popularTitlesOrder.length) {
        const byTitle = new Map(inCat.map(p => [String(p.title || '').toLowerCase(), p]));
        for (const t of popularTitlesOrder) {
            const p = byTitle.get(t);
            if (p && !seen.has(p.title)) {
                out.push(p);
                seen.add(p.title);
                if (out.length >= n) return out;
            }
        }
    }
    const newest = inCat.slice().reverse();
    for (const p of newest) {
        if (!seen.has(p.title)) {
            out.push(p);
            seen.add(p.title);
            if (out.length >= n) break;
        }
    }
    return out;
}

async function loadPopularProducts(opts) {
    const force = opts && opts.force;
    if (popularLoaded && !force) return;
    popularLoaded = true;
    try {
        // Cache-buster on forced reload so we bypass the edge cache when
        // the user just clicked something and we want fresh popularity.
        const url = force ? `/api/popular?t=${Date.now()}` : '/api/popular';
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data)) {
            popularTitlesOrder = data
                .map(row => String(row && row.title || '').toLowerCase())
                .filter(Boolean);
        }
    } catch (_) { /* silent — fallback already in place */ }
}

// Fire-and-forget visit tracker. One beacon per full page load. A random
// visitor id (persisted in localStorage) lets the backend count unique
// visitors and "online now" without any personal data.
(function trackVisit() {
    try {
        let vid = localStorage.getItem('jf_visitor');
        if (!vid) {
            vid = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2));
            localStorage.setItem('jf_visitor', vid);
        }
        const body = JSON.stringify({ visitor: vid, path: location.pathname.slice(0, 200) });
        if (navigator.sendBeacon) {
            navigator.sendBeacon('/api/visit', new Blob([body], { type: 'application/json' }));
        } else {
            fetch('/api/visit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
        }
    } catch (_) {}
})();

// Fire-and-forget click tracker. Uses sendBeacon when available so the
// request survives navigation (clicking Buy Now opens a new tab but the
// browser still flushes the beacon).
window.jfTrackClick = function(title) {
    if (!title) return;
    try {
        const body = JSON.stringify({ title: String(title).slice(0, 300) });
        if (navigator.sendBeacon) {
            navigator.sendBeacon('/api/click', new Blob([body], { type: 'application/json' }));
        } else {
            fetch('/api/click', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
        }
    } catch (_) {}
};

// ── Drag-to-scroll for carousels ──
function initDragScroll(el) {
    let isDown = false, startX, scrollL;
    el.addEventListener('mousedown', e => {
        if (e.button !== 0) return;
        isDown = true; startX = e.pageX - el.offsetLeft; scrollL = el.scrollLeft;
        el.style.scrollBehavior = 'auto'; el.style.cursor = 'grabbing';
    });
    el.addEventListener('mouseleave', () => { isDown = false; el.style.cursor = 'grab'; el.style.scrollBehavior = 'smooth'; });
    el.addEventListener('mouseup', () => { isDown = false; el.style.cursor = 'grab'; el.style.scrollBehavior = 'smooth'; });
    el.addEventListener('mousemove', e => {
        if (!isDown) return; e.preventDefault();
        el.scrollLeft = scrollL - (e.pageX - el.offsetLeft - startX) * 1.2;
    });
}

function attachCarouselHandlers(root) {
    root.querySelectorAll('.hc-arrow').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-carousel');
            const dir = parseInt(btn.getAttribute('data-dir'), 10);
            const carousel = document.getElementById(id);
            if (!carousel) return;
            const cardW = carousel.querySelector('.hc-card')?.offsetWidth || 240;
            carousel.scrollBy({ left: dir * (cardW + 16), behavior: 'smooth' });
        });
    });
    root.querySelectorAll('.hc-carousel').forEach(initDragScroll);
    root.querySelectorAll('[data-action="go-products"]').forEach(el => {
        el.addEventListener('click', e => {
            e.preventDefault();
            const seller = el.getAttribute('data-seller');
            const cat = el.getAttribute('data-cat');
            if (seller) { filterState.seller = seller; filterState.category = 'All'; }
            else if (cat) { filterState.category = cat; filterState.seller = ''; }
            (window.navigateTo||renderPage)('products');
        });
    });
    root.querySelectorAll('[data-action="go-stores"]').forEach(el => {
        el.addEventListener('click', e => { e.preventDefault(); (window.navigateTo||renderPage)('stores'); });
    });
}

// Refresh home category sections after catalog loads.
function refreshHomeMarquee() {
    const container = document.getElementById('home-sections');
    if (!container) return;
    const fresh = buildHomeSections();
    if (!fresh) return;
    container.innerHTML = fresh;
    attachCarouselHandlers(container);
}

// Reusable product card (picks.ly style) used by the Stores page.
function buildProductCard(item, idx) {
    const safeTitle = escapeHtml(stripEmojis(item.title || 'Untitled'));
    const rawImg = (item.img || '').trim();
    const isHttp = rawImg.startsWith('http');
    const isKnownPlaceholder = /nstatic\.kakobuy\.com\/banner\//i.test(rawImg) || /picks\.ly\/(marketplace|agent)-logos\//i.test(rawImg) || /picks\.ly\/twitter-image/i.test(rawImg);
    const safeImg = (isHttp && !isKnownPlaceholder) ? rawImg : '';
    const img = safeImg
        ? `<img src="${escapeHtml(thumb(safeImg, 600))}" alt="${safeTitle}" style="width:100%;height:100%;object-fit:cover;" loading="${idx < 5 ? 'eager' : 'lazy'}" decoding="async" fetchpriority="low" data-fallback="no-image-text" data-orig="${escapeHtml(safeExternalUrl(safeImg))}" />`
        : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--text-secondary);font-size:0.7rem;">No img</div>`;
    const picksly = escapeHtml(safeExternalUrl(item.picksly || '#'));
    return `<div class="hc-card product-card">
        <div class="product-image" style="overflow:hidden;">${img}</div>
        <div class="product-info">
            <div class="product-batch-row">${platformBadge(item.picksly)}<span class="product-store-name">${escapeHtml(catSellerLabel(item))}</span></div>
            <h3 class="product-title">${safeTitle}</h3>
            <div class="product-price">${formatPrice(item.price)}</div>
            <div class="product-actions">
                <button class="card-btn-buy" data-kakobuy="${escapeHtml(safeExternalUrl(item.kakobuy || ''))}">Buy Now</button>
                <a href="${picksly}" target="_blank" rel="noopener noreferrer" class="card-btn-qc">View QC</a>
            </div>
        </div>
    </div>`;
}

// Full Stores page: one section per seller (picks.ly /stores style).
function buildStoresPage() {
    const cache = (typeof allProductsCache !== 'undefined' ? allProductsCache : []) || [];
    const aL = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`;
    const aR = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;
    const sellerMap = new Map();
    cache.forEach(p => {
        const s = validSeller(p.seller);
        if (!s) return;
        if (!sellerMap.has(s)) sellerMap.set(s, []);
        sellerMap.get(s).push(p);
    });
    let sellers = [...sellerMap.entries()].filter(([, it]) => it.length >= 3);
    // Platform filter (All / Weidian / 1688 / Taobao)
    const plat = (typeof storesFilter !== 'undefined' && storesFilter.platform) || 'all';
    if (plat !== 'all') {
        sellers = sellers.filter(([, items]) => platformName((items.find(p => p.picksly) || {}).picksly) === plat);
    }
    // Search: match seller name (show all its products) or product titles (show
    // only matching products within that store).
    const q = ((typeof storesFilter !== 'undefined' && storesFilter.query) || '').toLowerCase().trim();
    if (q) {
        sellers = sellers.map(([s, items]) => {
            if (s.toLowerCase().includes(q)) return [s, items];
            const m = items.filter(p => (p.title || '').toLowerCase().includes(q));
            return m.length ? [s, m] : null;
        }).filter(Boolean);
    }
    sellers.sort((a, b) => b[1].length - a[1].length);
    if (!sellers.length) {
        const msg = q || plat !== 'all' ? 'No stores match your filter.' : 'No stores yet — sellers are still being indexed.';
        return `<p style="text-align:center;color:var(--text-secondary);padding:4rem 1rem;">${msg}</p>`;
    }
    return sellers.map(([seller, items], si) => {
        const platform = platformName((items.find(p => p.picksly) || {}).picksly);
        const id = 'st-' + si;
        const cards = items.slice(0, 20).map((it, i) => buildProductCard(it, i)).join('');
        return `<div class="store-section-card">
            <div class="store-page-header">
                <div class="store-header">
                    <div class="store-icon">店</div>
                    <div class="store-meta">
                        <span class="store-name">${escapeHtml(seller)}</span>
                        <span class="store-sub">${escapeHtml(platform)}</span>
                    </div>
                </div>
                <button class="store-view-btn store-view-btn-sm" data-action="go-products" data-seller="${escapeHtml(seller)}">View Store</button>
            </div>
            <div class="store-section-divider"></div>
            <div class="hc-carousel-wrap">
                <button class="hc-arrow hc-arrow-left" data-carousel="${id}" data-dir="-1">${aL}</button>
                <div class="hc-carousel" id="${id}">${cards}</div>
                <button class="hc-arrow hc-arrow-right" data-carousel="${id}" data-dir="1">${aR}</button>
            </div>
        </div>`;
    }).join('');
}

function buildHomeSections() {
    const cache = (typeof allProductsCache !== 'undefined' ? allProductsCache : []) || [];
    if (!cache.length) return '';
    const HOME_CATS = ['Shoes', 'T-shirts', 'Hoodies', 'Jackets', 'Shorts', 'Pants', 'Long-sleeve', 'Accessories'];
    const arrow = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;
    const arrowLeft = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`;
    const arrowRight = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;

    // ── Trending Items section (most-clicked first, padded with newest) ──
    const trending = getRecentlyViewed().slice(0, 20);
    let trendingHtml = '';
    if (trending.length >= 3) {
        const tCards = trending.map((item, idx) => {
            const safeTitle = escapeHtml(stripEmojis(item.title || 'Untitled'));
            const rawImg = (item.img || '').trim();
            const isHttp = rawImg.startsWith('http');
            const isKnownPlaceholder = /nstatic\.kakobuy\.com\/banner\//i.test(rawImg) || /picks\.ly\/marketplace-logos\//i.test(rawImg) || /picks\.ly\/agent-logos\//i.test(rawImg) || /picks\.ly\/twitter-image/i.test(rawImg);
            const safeImg = (isHttp && !isKnownPlaceholder) ? rawImg : '';
            const img = safeImg
                ? `<img src="${escapeHtml(thumb(safeImg, 600))}" alt="${safeTitle}" style="width:100%;height:100%;object-fit:cover;" loading="${idx < 5 ? 'eager' : 'lazy'}" decoding="async" fetchpriority="low" data-fallback="no-image-text" data-orig="${escapeHtml(safeExternalUrl(safeImg))}" />`
                : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--text-secondary);font-size:0.7rem;">No img</div>`;
            const sellerName = catSellerLabel(item);
            return `<div class="hc-card product-card">
                <div class="product-image" style="overflow:hidden;">${img}</div>
                <div class="product-info">
                    <div class="product-batch-row">${platformBadge(item.picksly)}<span class="product-store-name">${escapeHtml(sellerName)}</span></div>
                    <h3 class="product-title">${safeTitle}</h3>
                    <div class="product-price">${formatPrice(item.price)}</div>
                    <div class="product-actions">
                        <button class="card-btn-buy" data-kakobuy="${escapeHtml(safeExternalUrl(item.kakobuy || ''))}">Buy Now</button>
                        <a href="${escapeHtml(safeExternalUrl(item.picksly || '#'))}" target="_blank" rel="noopener noreferrer" class="card-btn-qc">View QC</a>
                    </div>
                </div>
            </div>`;
        }).join('');
        trendingHtml = `<div class="hc-section">
            <div class="hc-header">
                <a class="hc-title" data-action="go-products">Trending Items ${arrow}</a>
                <a class="hc-viewmore" data-action="go-products">View more</a>
            </div>
            <div class="hc-carousel-wrap">
                <button class="hc-arrow hc-arrow-left" data-carousel="hc-trending" data-dir="-1">${arrowLeft}</button>
                <div class="hc-carousel" id="hc-trending">${tCards}</div>
                <button class="hc-arrow hc-arrow-right" data-carousel="hc-trending" data-dir="1">${arrowRight}</button>
            </div>
        </div>`;
    }

    // ── Category sections ──
    const catSections = HOME_CATS.map(cat => {
        const items = getPopularInCategory(cat, 20);
        if (items.length < 3) return '';
        const id = 'hc-' + cat.toLowerCase().replace(/[^a-z]/g, '');
        const cards = items.map((item, idx) => {
            const safeTitle = escapeHtml(stripEmojis(item.title || 'Untitled'));
            const rawImg = (item.img || '').trim();
            const isHttp = rawImg.startsWith('http');
            const isKnownPlaceholder =
                /nstatic\.kakobuy\.com\/banner\//i.test(rawImg) ||
                /s\.yupoo\.com\/website\/.*\/logo_/i.test(rawImg) ||
                /picks\.ly\/marketplace-logos\//i.test(rawImg) ||
                /picks\.ly\/agent-logos\//i.test(rawImg) ||
                /picks\.ly\/twitter-image/i.test(rawImg);
            const safeImg = (isHttp && !isKnownPlaceholder) ? rawImg : '';
            const img = safeImg
                ? `<img src="${escapeHtml(thumb(safeImg, 600))}" alt="${safeTitle}" style="width:100%;height:100%;object-fit:cover;" loading="${idx < 5 ? 'eager' : 'lazy'}" decoding="async" fetchpriority="low" data-fallback="no-image-text" data-orig="${escapeHtml(safeExternalUrl(safeImg))}" />`
                : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--text-secondary);font-size:0.7rem;">No img</div>`;
            const kakobuy = escapeHtml(buildAgentLink(item.kakobuy || '#'));
            const picksly = escapeHtml(safeExternalUrl(item.picksly || '#'));
            const sellerName = catSellerLabel(item);
            return `<div class="hc-card product-card">
                <div class="product-image" style="overflow:hidden;">${img}</div>
                <div class="product-info">
                    <div class="product-batch-row">
                        ${platformBadge(item.picksly)}
                        <span class="product-store-name">${escapeHtml(sellerName)}</span>
                    </div>
                    <h3 class="product-title">${safeTitle}</h3>
                    <div class="product-price">${formatPrice(item.price)}</div>
                    <div class="product-actions">
                        <button class="card-btn-buy" data-kakobuy="${escapeHtml(safeExternalUrl(item.kakobuy || ''))}">Buy Now</button>
                        <a href="${picksly}" target="_blank" rel="noopener noreferrer" class="card-btn-qc">View QC</a>
                    </div>
                </div>
            </div>`;
        }).join('');
        return `<div class="hc-section">
            <div class="hc-header">
                <a class="hc-title" data-action="go-products" data-cat="${escapeHtml(cat)}">${escapeHtml(cat)} ${arrow}</a>
                <a class="hc-viewmore" data-action="go-products" data-cat="${escapeHtml(cat)}">View more</a>
            </div>
            <div class="hc-carousel-wrap">
                <button class="hc-arrow hc-arrow-left" data-carousel="${id}" data-dir="-1">${arrowLeft}</button>
                <div class="hc-carousel" id="${id}">${cards}</div>
                <button class="hc-arrow hc-arrow-right" data-carousel="${id}" data-dir="1">${arrowRight}</button>
            </div>
        </div>`;
    }).filter(Boolean).join('');

    // ── Stores section (picks.ly style — grouped by seller) ──
    function storeGoodImg(p) {
        const raw = (p.img || '').trim();
        if (!raw.startsWith('http')) return '';
        if (/nstatic\.kakobuy\.com\/banner\//i.test(raw) || /picks\.ly\/(marketplace|agent)-logos\//i.test(raw) || /picks\.ly\/twitter-image/i.test(raw)) return '';
        return raw;
    }
    const sellerMap = new Map();
    cache.forEach(p => {
        const s = validSeller(p.seller);
        if (!s) return;
        if (!sellerMap.has(s)) sellerMap.set(s, []);
        sellerMap.get(s).push(p);
    });
    const sellerList = [...sellerMap.entries()]
        .filter(([, items]) => items.length >= 3)
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 15);
    const useSellers = sellerList.length >= 4;
    const sellerCards = sellerList.map(([seller, items]) => {
        const platform = platformName((items.find(p => p.picksly) || {}).picksly);
        const catMap = new Map();
        items.forEach(p => {
            const c = (p.category || 'Other').trim() || 'Other';
            if (!catMap.has(c)) catMap.set(c, []);
            catMap.get(c).push(p);
        });
        const topCats = [...catMap.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 3);
        const catCells = topCats.map(([c, cps]) => {
            const imgSrc = cps.map(storeGoodImg).find(Boolean) || '';
            const imgHtml = imgSrc ? `<img src="${escapeHtml(thumb(imgSrc, 260))}" alt="" loading="lazy" data-fallback="hide" data-orig="${escapeHtml(safeExternalUrl(imgSrc))}" />` : '';
            return `<div class="store-cat">
                <div class="store-cat-thumb">${imgHtml}</div>
                <div class="store-cat-name">${escapeHtml(c)}</div>
                <div class="store-cat-count">${cps.length} items</div>
            </div>`;
        }).join('');
        return `<div class="store-card">
            <div class="store-header">
                <div class="store-icon">店</div>
                <div class="store-meta">
                    <span class="store-name">${escapeHtml(seller)}</span>
                    <span class="store-sub">${escapeHtml(platform)}</span>
                </div>
            </div>
            <div class="store-cats">${catCells}</div>
            <button class="store-view-btn" data-action="go-products" data-seller="${escapeHtml(seller)}">View Store</button>
        </div>`;
    }).join('');

    // Fallback: until enough sellers are populated, show the category-based
    // store cards so the section is never empty.
    const catStoreCards = HOME_CATS.map(cat => {
        const items = cache.filter(p => (p.category || '').toLowerCase() === cat.toLowerCase());
        if (!items.length) return '';
        const thumbs = items.slice(0, 4).map(item => {
            const safeImg = storeGoodImg(item);
            return safeImg ? `<div class="store-thumb"><img src="${escapeHtml(thumb(safeImg, 260))}" alt="" loading="lazy" data-fallback="hide" data-orig="${escapeHtml(safeExternalUrl(safeImg))}" /></div>` : '';
        }).filter(Boolean).join('');
        return `<div class="store-card" data-action="go-products" data-cat="${escapeHtml(cat)}">
            <div class="store-header">
                <div class="store-icon">店</div>
                <div class="store-meta">
                    <span class="store-name">${escapeHtml(cat)}</span>
                    <span class="store-sub">${items.length} items</span>
                </div>
            </div>
            <div class="store-thumbs">${thumbs}</div>
        </div>`;
    }).filter(Boolean).join('');

    const storeCards = useSellers ? sellerCards : catStoreCards;
    const storesId = 'hc-stores';
    const storesHtml = storeCards ? `<div class="hc-section">
        <div class="hc-header">
            <a class="hc-title" data-action="go-stores">Stores ${arrow}</a>
            ${useSellers ? '<a class="hc-viewmore" data-action="go-stores">View more</a>' : ''}
        </div>
        <div class="hc-carousel-wrap">
            <button class="hc-arrow hc-arrow-left" data-carousel="${storesId}" data-dir="-1">${arrowLeft}</button>
            <div class="hc-carousel" id="${storesId}">${storeCards}</div>
            <button class="hc-arrow hc-arrow-right" data-carousel="${storesId}" data-dir="1">${arrowRight}</button>
        </div>
    </div>` : '';

    return trendingHtml + storesHtml + catSections;
}

// ─── WEIGHT ESTIMATOR ──────────────────────────────────────────────────────
const WEIGHT_CATS = [
    { id: 'footwear',     label: 'Shoes',         weight: 2000 },
    { id: 'tops',         label: 'Tops & T-shirts', weight: 300 },
    { id: 'bottoms',      label: 'Bottoms',       weight: 500 },
    { id: 'hoodies',      label: 'Hoodies',       weight: 750 },
    { id: 'bags',         label: 'Bags',           weight: 1000 },
    { id: 'accessories',  label: 'Accessories',   weight: 300 },
    { id: 'electronics',  label: 'Electronics',   weight: 300 },
    { id: 'socks',        label: 'Socks',         weight: 100 },
    { id: 'hats',         label: 'Hats / Caps',   weight: 200 },
];
const PKG_WEIGHT = 50;
let weightQty = {};

function weightRender() {
    const container = document.getElementById('weight-cats');
    if (!container) return;
    container.innerHTML = WEIGHT_CATS.map(cat => {
        const qty = weightQty[cat.id] || 0;
        return `
        <div class="weight-cat-btn${qty > 0 ? ' selected' : ''}" id="wcat-${cat.id}">
            <span>${cat.label}</span>
            <span class="weight-cat-count">~${cat.weight}g each</span>
            <div class="weight-cat-qty">
                <button class="weight-qty-btn" data-action="weightChange" data-arg="${escapeHtml(cat.id)}" data-arg2="-1">-</button>
                <span class="weight-qty-val">${qty}</span>
                <button class="weight-qty-btn" data-action="weightChange" data-arg="${escapeHtml(cat.id)}" data-arg2="1">+</button>
            </div>
        </div>`;
    }).join('');
    weightUpdateResult();
}

window.weightChange = function(id, delta) {
    weightQty[id] = Math.max(0, (weightQty[id] || 0) + delta);
    weightRender();
};

window.weightReset = function() {
    weightQty = {};
    weightRender();
};

function weightUpdateResult() {
    let total = PKG_WEIGHT;
    WEIGHT_CATS.forEach(cat => {
        total += (weightQty[cat.id] || 0) * cat.weight;
    });
    const gEl  = document.getElementById('weight-total-g');
    const kgEl = document.getElementById('weight-kg');
    const lbsEl= document.getElementById('weight-lbs');
    const pkgEl= document.getElementById('weight-pkg');
    if (!gEl) return;
    gEl.textContent  = total + ' g';
    kgEl.textContent = (total / 1000).toFixed(3);
    lbsEl.textContent= (total / 453.592).toFixed(2);
    pkgEl.textContent= PKG_WEIGHT;
}

window.initWeightEstimator = function() {
    weightQty = {};
    weightRender();
};

window.convertLink = function () {
    const input = document.getElementById('link-input').value.trim().slice(0, LINK_INPUT_MAX_LEN);
    const agentValue = selectedAgent;
    const agentObj = AGENTS.find(a => a.id === agentValue);
    const agentText = agentObj ? agentObj.name : agentValue;
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
        resultDiv.innerHTML = t('conv_invalid');
        resultDiv.style.display = 'block';
        return;
    }

    const validHosts = ['weidian.com', 'taobao.com', 'tmall.com', '1688.com'];
    const host = parsedInput.hostname.toLowerCase();
    // Suffix match — `weidian.com.evil.tld` must NOT pass.
    const hostAllowed = validHosts.some(h => host === h || host.endsWith('.' + h));
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

    // Extract item ID for agents that need it
    let itemId = '';
    const weidianMatch = input.match(/itemID=(\d+)/i);
    const taobaoMatch = input.match(/[?&]id=(\d+)/i);
    const alibMatch = input.match(/\/(\d+)\.html/i);
    if (weidianMatch) itemId = weidianMatch[1];
    else if (taobaoMatch) itemId = taobaoMatch[1];
    else if (alibMatch) itemId = alibMatch[1];

    switch (agentValue) {
        case 'kakobuy':  finalUrl = `https://www.kakobuy.com/item/details?url=${encoded}&affcode=keviinn`; break;
        case 'oopbuy':   finalUrl = itemId ? `https://oopbuy.com/product/2/${itemId}` : `https://oopbuy.com/product?url=${encoded}`; break;
        case 'acbuy':    finalUrl = `https://www.acbuy.com/en/page/buy/?url=${encoded}`; break;
        case 'mulebuy': {
            let shopType = '';
            if (input.includes('weidian.com')) shopType = 'weidian';
            else if (input.includes('taobao.com') || input.includes('tmall.com')) shopType = 'taobao';
            else if (input.includes('1688.com')) shopType = '1688';
            finalUrl = (shopType && itemId)
                ? `https://mulebuy.com/product/?shop_type=${shopType}&id=${itemId}`
                : `https://mulebuy.com/product/?url=${encoded}`;
            break;
        }
        case 'superbuy': finalUrl = `https://www.superbuy.com/en/page/buy/?url=${encoded}`; break;
        case 'joyagoo':  finalUrl = itemId ? `https://joyagoo.com/product?id=${itemId}&platform=WEIDIAN` : `https://joyagoo.com/product?url=${encoded}`; break;
        case 'usfans':   finalUrl = `https://usfans.com/product?url=${encoded}`; break;
        default:         finalUrl = `https://www.kakobuy.com/item/details?url=${encoded}&affcode=keviinn`; break;
    }

    resultDiv.style.border = '1px solid var(--border-color)';
    resultDiv.style.background = 'rgba(128,128,128,0.08)';
    resultDiv.style.color = 'var(--text-primary)';
    resultDiv.innerHTML = `Link converted for <strong>${escapeHtml(agentText)}</strong>. <a href="${escapeHtml(finalUrl)}" target="_blank" rel="noopener noreferrer" style="color:var(--text-primary);font-weight:600;text-decoration:underline;">Click here to open →</a>`;
    resultDiv.style.display = 'block';
    setTimeout(() => window.open(finalUrl, '_blank', 'noopener,noreferrer'), 800);
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

// ─── ONLINE COUNTER (cosmetic) ────────────────────────────────────────────
// Shows a number between MIN and MAX, deterministically derived from the
// current 10-minute time bucket so every visitor sees the same value and it
// changes every 10 minutes. Small jitter every ~30s keeps it feeling alive.
(function initOnlineCounter() {
    const MIN = 20, MAX = 40;
    const BUCKET_MS = 10 * 60 * 1000; // 10 min
    const JITTER_MS = 30 * 1000;
    function setCount(n) {
        const el = document.getElementById('online-count');
        if (el) el.textContent = n;
        const elM = document.getElementById('online-count-mobile');
        if (elM) elM.textContent = n;
    }
    // Simple deterministic hash → [0,1)
    function seededRand(seed) {
        let x = Math.sin(seed * 9301 + 49297) * 233280;
        return x - Math.floor(x);
    }
    function pickCount() {
        const bucket = Math.floor(Date.now() / BUCKET_MS);
        const base = MIN + Math.floor(seededRand(bucket) * (MAX - MIN + 1));
        // Tiny jitter (-1, 0, +1) for a "live" feel, also bucketed.
        const jitterBucket = Math.floor(Date.now() / JITTER_MS);
        const jitter = Math.floor(seededRand(bucket * 1000 + jitterBucket) * 3) - 1;
        let n = base + jitter;
        if (n < MIN) n = MIN;
        if (n > MAX) n = MAX;
        return n;
    }
    function tick() { setCount(pickCount()); }
    function start() {
        tick();
        setInterval(tick, JITTER_MS);
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();


// ─── DELEGATED ACTION DISPATCHER ───────────────────────────────────────────
// Replaces every inline `onclick=` / `oninput=` / `onkeydown=` so we can drop
// `'unsafe-inline'` from CSP script-src. Elements get `data-action="name"`
// (and optionally data-arg / data-arg2 / data-arg3); a single document-level
// listener routes the event to the right handler. Defends in depth against
// any future XSS — even if injection succeeds, the browser refuses to run
// inline scripts.

(function initActionDispatcher() {
    function call(fn, ...args) {
        if (typeof fn === 'function') return fn(...args);
    }

    function runAction(el) {
        const a = el.dataset.action;
        const a1 = el.dataset.arg;
        const a2 = el.dataset.arg2;
        const a3 = el.dataset.arg3;
        switch (a) {
            case 'home-nav': {
                const home = document.querySelector('[data-page=home]');
                if (home) home.click();
                break;
            }
            case 'toggleTheme':         call(window.toggleTheme); break;
            case 'openSettings':        { const m = document.getElementById('settings-modal'); if (m) m.style.display = 'flex'; break; }
            case 'closeSettings':       { const m = document.getElementById('settings-modal'); if (m) m.style.display = 'none'; break; }
            case 'changeCurrency':      call(window.changeCurrencyUI, a1); break;
            case 'runQcCheck':          call(window.runQcCheck); break;
            case 'closeQcBatch':        call(window.closeQcBatch); break;
            case 'closeQcLightbox':     call(window.closeQcLightbox); break;
            case 'toggleAgentDropdown': call(window.toggleAgentDropdown); break;
            case 'selectAgent':         call(window.selectAgent, a1, a2, a3); break;
            case 'convertLink':         call(window.convertLink); break;
            case 'weightReset':         call(window.weightReset); break;
            case 'weightChange':        call(window.weightChange, a1, parseInt(a2 || '0', 10)); break;
            case 'jfWelDone':           call(window.jfWelDone); break;
            case 'jfWelSelLang':        call(window.jfWelSelLang, a1); break;
            case 'jfWelSelCur':         call(window.jfWelSelCur, a1); break;
            case 'jfWelSelAgent':       call(window.jfWelSelAgent, a1); break;
            case 'copyAffcode': {
                const code = a1 || 'keviinn';
                if (navigator.clipboard) navigator.clipboard.writeText(code).catch(() => {});
                el.textContent = 'Copied!';
                setTimeout(() => { el.textContent = 'Copy'; }, 2000);
                break;
            }
            case 'openQcBatch':         call(window.openQcBatch, parseInt(a1 || '0', 10)); break;
        }
    }

    // Walk from click target upward. If we hit `data-stop="click"` first, do
    // not propagate to ancestor actions (mirrors the old inline
    // event.stopPropagation() pattern). If `data-stop` and `data-action` are
    // both on the same node, the action still runs.
    document.addEventListener('click', function(e) {
        let node = e.target;
        while (node && node !== document.body && node !== document) {
            const ds = node.dataset;
            if (ds) {
                if (ds.stop === 'click') {
                    if (ds.action) runAction(node);
                    return;
                }
                if (ds.action) {
                    runAction(node);
                    return;
                }
            }
            node = node.parentElement;
        }
    });

    // Input-event delegation (oninput="updateTrackerLinks(this.value)" etc.)
    // e.target may not be an Element (e.g. Document for synthetic events) —
    // guard with `instanceof Element` before calling closest.
    document.addEventListener('input', function(e) {
        if (!(e.target instanceof Element)) return;
        const el = e.target.closest('[data-action-input]');
        if (!el) return;
        const a = el.dataset.actionInput;
        if (a === 'updateTrackerLinks') {
            call(window.updateTrackerLinks, (el.value || '').trim());
        }
    }, true);

    // Keydown delegation (onkeydown="if(Enter) runQcCheck()" pattern)
    document.addEventListener('keydown', function(e) {
        if (!(e.target instanceof Element)) return;
        const el = e.target.closest('[data-action-key]');
        if (!el) return;
        const action = el.dataset.actionKey;
        if (e.key === 'Enter' && action === 'runQcCheck') {
            e.preventDefault();
            call(window.runQcCheck);
        }
    }, true);
})();


// ─── IMG FALLBACK BINDER ───────────────────────────────────────────────────
// Replaces inline `onerror="this.style.display='none'"` patterns. New <img>
// elements with `data-fallback` get an error listener attached automatically
// via MutationObserver. Two modes:
//   - data-fallback="hide"          → just hide on error
//   - data-fallback="no-image-text" → hide and append a localized "no image"
//                                     placeholder (replaces the giant inline
//                                     onerror that used insertAdjacentHTML).

(function initImgFallback() {
    function bind(img) {
        if (img._fallbackBound) return;
        img._fallbackBound = true;
        const mode = img.dataset.fallback;
        img.addEventListener('error', function onErr() {
            // If the proxied (wsrv) image failed — which happens under burst
            // load — retry once with the original, unproxied URL before giving
            // up. The original always loads (just larger/uncompressed).
            const orig = this.dataset.orig;
            if (orig && !this._triedOrig && this.src !== orig) {
                this._triedOrig = true;
                this.src = orig;
                return;
            }
            this.removeEventListener('error', onErr);
            this.style.display = 'none';
            if (mode === 'no-image-text' && this.parentElement) {
                if (!this.parentElement.querySelector('.img-fallback-text')) {
                    const div = document.createElement('div');
                    div.className = 'img-fallback-text';
                    div.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--text-secondary);font-size:0.8rem;opacity:.7;';
                    div.textContent = (typeof t === 'function') ? t('no_image') : 'No image';
                    this.parentElement.appendChild(div);
                }
            }
        });
    }
    function bindAll(root) {
        root.querySelectorAll('img[data-fallback]').forEach(bind);
    }
    function start() {
        bindAll(document);
        new MutationObserver(records => {
            for (const r of records) {
                for (const node of r.addedNodes) {
                    if (node.nodeType !== 1) continue;
                    if (node.tagName === 'IMG' && node.dataset.fallback) bind(node);
                    else if (node.querySelectorAll) bindAll(node);
                }
            }
        }).observe(document.body, { childList: true, subtree: true });
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
