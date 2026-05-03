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
    const activeLink = document.querySelector('.nav-links a.active');
    const pageId = activeLink ? activeLink.getAttribute('data-page') : 'home';
    if (window.navigateTo) window.navigateTo(pageId, true);
    else if (activeLink) activeLink.click();
}

function updateNavbarLanguage() {
    const navLinks = document.querySelectorAll('.nav-links a[data-page]');
    navLinks.forEach(a => {
        const page = a.getAttribute('data-page');
        if (page === 'home') a.innerHTML = t('nav_home');
        if (page === 'products') a.innerHTML = t('nav_products');
        if (page === 'tutorials') a.innerHTML = t('nav_tutorials');
        if (page === 'qccheck') a.innerHTML = t('nav_qc');
        if (page === 'tools') a.innerHTML = t('nav_tools') + ' <span style="font-size: 0.7em; vertical-align: middle; margin-left: 2px;">▼</span>';
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
            info.textContent = t('showing_of', { a: filtered.length, b: data.length });
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
                <input type="text" id="kf-search-input" placeholder="${t('search_placeholder')}" value="" maxlength="${INPUT_MAX_LEN}" autocomplete="off" spellcheck="false"/>
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
            ? `<img src="${safeExternalUrl(safeImg)}" alt="${safeTitle}" style="width:100%;height:100%;object-fit:cover;" loading="lazy" decoding="async" fetchpriority="low" onerror="this.onerror=null;this.style.display='none';this.parentElement.insertAdjacentHTML('beforeend','<div style=&quot;width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--text-secondary);font-size:0.8rem;opacity:.7;&quot;>${t('no_image')}</div>');" />`
            : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--text-secondary);font-size:0.8rem;opacity:.7;">${t('no_image')}</div>`;

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

        const rvItem = JSON.stringify({ title: safeTitle, price: p.price, img: safeImg, kakobuy: p.kakobuy || '', picksly: p.picksly || '' }).replace(/'/g, '&#39;');
        return `
            <div class="product-card" onclick="trackRecentlyViewed('${rvItem.replace(/"/g, '&quot;')}')">
                <div class="product-image" style="overflow:hidden;">${renderImg}</div>
                <div class="product-info">
                    <div class="product-batch-row">
                        <span class="product-store-badge">店</span>
                        <span class="product-store-name">${escapeHtml(p.category || '')}</span>
                        ${batchFlair}
                    </div>
                    <h3 class="product-title">${safeTitle}</h3>
                    <div class="product-price">${formatPrice(p.price)}</div>
                    <div class="product-actions">
                        <a href="${kakobuy}" target="_blank" class="card-btn-buy" onclick="event.stopPropagation();trackRecentlyViewed('${rvItem.replace(/"/g, '&quot;')}')">${t('btn_buy')}</a>
                        <a href="${picksly}" target="_blank" class="card-btn-qc" onclick="event.stopPropagation();trackRecentlyViewed('${rvItem.replace(/"/g, '&quot;')}')">View QC</a>
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
            border: 1px solid rgba(255,140,0,0.35);
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
            background: #ff8c00;
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
            background: #ff8c00;
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
            font-size: 0.95rem;
            font-weight: 400;
            line-height: 1.6;
            margin-bottom: 0.5rem;
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
        <style>
            .rv-section {
                width: 100%;
                padding: 0 0 0.5rem;
                overflow: hidden;
            }
            .rv-label {
                font-size: 0.66rem;
                font-weight: 700;
                letter-spacing: 0.12em;
                text-transform: uppercase;
                color: var(--text-secondary);
                padding: 0 5% 0.5rem;
            }
            .rv-track-wrap {
                overflow: hidden;
                width: 100%;
                -webkit-mask-image: linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%);
                mask-image: linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%);
            }
            .rv-track {
                display: flex;
                gap: 1rem;
                width: max-content;
                animation: rv-scroll 30s linear infinite;
            }
            .rv-track:hover { animation-play-state: paused; }
            @keyframes rv-scroll {
                0%   { transform: translateX(0); }
                100% { transform: translateX(-50%); }
            }
            .rv-card {
                background: var(--nav-bg);
                border: 1px solid var(--border-color);
                border-radius: 16px;
                width: calc((100vw - 80px) / 5.2);
                min-width: 220px;
                flex-shrink: 0;
                overflow: hidden;
                transition: border-color 0.2s;
                display: flex;
                flex-direction: column;
                height: calc(100vh - 480px);
                min-height: 280px;
            }
            .rv-card:hover { border-color: var(--text-secondary); }
            .rv-img {
                width: 100%;
                flex: 1;
                overflow: hidden;
                background: var(--bg-color);
            }
            .rv-info {
                padding: 0.75rem;
                flex-shrink: 0;
            }
            .rv-title {
                font-size: 0.78rem;
                font-weight: 600;
                color: var(--text-primary);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                margin-bottom: 0.25rem;
            }
            .rv-price {
                font-size: 0.85rem;
                font-weight: 800;
                color: #ff8c00;
                margin-bottom: 0.6rem;
            }
            .rv-actions {
                display: flex;
                gap: 0.4rem;
            }
            .rv-btn {
                flex: 1;
                text-align: center;
                text-decoration: none;
                border-radius: 8px;
                padding: 0.45rem 0.2rem;
                font-size: 0.74rem;
                font-weight: 700;
                transition: opacity 0.15s;
            }
            .rv-btn:hover { opacity: 0.8; }
            .rv-btn-qc {
                background: var(--border-color);
                color: var(--text-primary);
            }
        </style>
        <div style="position:relative;min-height:calc(100vh - 5rem);">
            <button data-action="go-products" style="position:absolute;top:33vh;right:9%;display:inline-flex;align-items:center;gap:9px;background:#ff8c00;color:#fff;font-family:'Inter',sans-serif;font-weight:700;font-size:0.9rem;padding:0.9rem 2rem;border-radius:9999px;border:none;cursor:pointer;box-shadow:0 4px 24px rgba(255,140,0,0.35);z-index:10;transition:transform 0.2s,box-shadow 0.2s;">
                ${t('btn_explore')}
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </button>
            <div class="jf-hero">
                <div class="jf-eyebrow">
                    <span class="jf-eyebrow-dot"></span>
                    ${t('hero_eyebrow')}
                </div>
                <h1 class="jf-title" style="white-space:nowrap;"><span style="color:var(--text-primary);">jarvis </span><span style="color:transparent;-webkit-text-stroke:1.5px var(--text-primary);">finder</span></h1>
                <p class="jf-sub">${t('hero_desc')}</p>
                ${buildRecentlyViewedMarquee()}
            </div>
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
                    <div class="htb-img"><img src="images/how-to-buy/step-1.jpg?v=2" alt="Step 1" loading="eager" fetchpriority="high" decoding="async" /></div>
                    <a class="htb-link" href="https://ikako.vip/r/keviinn" target="_blank" rel="noopener">${t('htb_signup')}</a>
                </section>

                <section class="htb-step">
                    <div class="htb-step-top">
                        <span class="htb-num">02</span>
                        <h3>${t('htb_2_h')}</h3>
                    </div>
                    <p>${t('htb_2_p')}</p>
                    <div class="htb-img"><img src="images/how-to-buy/step-2.jpg?v=2" alt="Step 2" loading="eager" fetchpriority="high" decoding="async" /></div>
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
                    <div class="htb-img"><img src="images/how-to-buy/step-3.jpg?v=2" alt="Step 3" loading="eager" fetchpriority="high" decoding="async" /></div>
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
                    <div class="htb-img"><img src="images/how-to-buy/step-4.jpg?v=2" alt="Step 4" loading="eager" fetchpriority="high" decoding="async" /></div>
                </section>

                <section class="htb-step">
                    <div class="htb-step-top">
                        <span class="htb-num">05</span>
                        <h3>${t('htb_5_h')}</h3>
                    </div>
                    <p>${t('htb_5_p')}</p>
                    <div class="htb-coupon">keviinn</div>
                    <div class="htb-img"><img src="images/how-to-buy/step-5.jpg?v=2" alt="Step 5" loading="eager" fetchpriority="high" decoding="async" /></div>
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
            .qc-wrap { max-width: 1800px; margin: 0 auto; padding: 5rem 5% 3rem;
                display: flex; flex-direction: column; gap: 1.5rem;
                animation: fadeIn 0.4s ease-out; width: 100%; box-sizing: border-box; }
            .qc-card { background: var(--nav-bg); border: 1px solid var(--border-color);
                border-radius: 24px; padding: 2.5rem 2.5rem 2rem; width: 100%; box-sizing: border-box; }
            .qc-title { font-size: 2.6rem; font-weight: 900; letter-spacing: -1.5px;
                color: var(--text-primary); margin-bottom: 0.4rem; line-height: 1; text-align: center; }
            .qc-subtitle { color: var(--text-secondary); font-size: 0.92rem; margin-bottom: 1.75rem; text-align: center; }
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
                    <input class="qc-input" id="qc-input" type="text" placeholder="${t('qc_placeholder')}" maxlength="200" autocomplete="off" onkeydown="if(event.key==='Enter'){event.preventDefault();runQcCheck();}" />
                    <button class="qc-btn" id="qc-submit" onclick="runQcCheck()">${t('qc_btn')}</button>
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
                    <button class="qc-batch-back" onclick="closeQcBatch()">
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
        <div class="qc-lightbox" id="qc-lightbox" onclick="closeQcLightbox()">
            <button class="qc-lightbox-close" onclick="event.stopPropagation();closeQcLightbox()" aria-label="Close">×</button>
            <img id="qc-lightbox-img" alt="" onclick="event.stopPropagation()" />
        </div>
    `,
        tools: `
        <style>
            .tools-wrap {
                max-width: 1800px;
                margin: 0 auto;
                padding: 5rem 5% 3rem;
                display: flex;
                flex-direction: column;
                gap: 1.5rem;
                animation: fadeIn 0.4s ease-out;
                width: 100%;
                box-sizing: border-box;
            }
            .tool-card {
                background: var(--nav-bg);
                border: 1px solid var(--border-color);
                border-radius: 24px;
                padding: 2.5rem 2.5rem 2rem;
                width: 100%;
                box-sizing: border-box;
            }
            .tracking-card {
                width: 100%;
                box-sizing: border-box;
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
                    <button class="convert-btn" onclick="convertLink()">${t('convert_link')}</button>
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
                    <button class="weight-reset-btn" onclick="weightReset()">Reset</button>
                </div>
                <p class="weight-disclaimer">Weights are approximate averages. Actual weights may vary by ±10-15% depending on brand and materials.</p>
            </div>

            <div class="tracking-card">
                <h2 class="tool-title">${t('package_tracking')}</h2>
                <p class="tool-subtitle" style="margin-bottom:1.25rem;">${t('tools_subtitle')}</p>
                <input class="tracking-input" type="text" placeholder="${t('tracking_placeholder')}" id="tracking-input" maxlength="${INPUT_MAX_LEN}" oninput="updateTrackerLinks(this.value.trim())" />
                <div class="tracker-grid">
                    <a class="tracker-card" href="https://t.17track.net/en" target="_blank" rel="noopener" id="track-17">
                        <div class="tracker-icon" style="background:#fff;display:flex;align-items:center;justify-content:center;"><img src="https://www.google.com/s2/favicons?domain=17track.net&sz=64" style="width:28px;height:28px;object-fit:contain;" /></div>
                        <span class="tracker-name">17TRACK</span>
                        <span class="tracker-open-btn">${t('open_btn')}</span>
                    </a>
                    <a class="tracker-card" href="https://www.dhl.de/en/privatkunden/pakete-empfangen/verfolgen.html" target="_blank" rel="noopener" id="track-dhl">
                        <div class="tracker-icon" style="background:#FFCC00;border-radius:14px;display:flex;align-items:center;justify-content:center;padding:10px;"><img src="images/dhl-logo.svg" style="width:54px;height:auto;" alt="DHL" /></div>
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
            el.addEventListener('click', e => { e.preventDefault(); (window.navigateTo||renderPage)('products'); });
        });
        mainContent.querySelectorAll('[data-action="go-tools"]').forEach(el => {
            el.addEventListener('click', e => { e.preventDefault(); (window.navigateTo||renderPage)('tools'); });
        });

        navLinks.forEach(link => {
            link.classList.toggle('active', link.getAttribute('data-page') === pageId);
        });

        document.querySelectorAll('.bottom-nav-item').forEach(item => {
            item.classList.toggle('active', item.getAttribute('data-page') === pageId);
        });

        if (pageId === 'tools') {
            if (window.initWeightEstimator) window.initWeightEstimator();
        }

        if (pageId === 'products') {
            filterState = { search: '', category: 'All', batch: 'All Tags' };

            if (window.showSkeletonCards) window.showSkeletonCards(10);
            fetchFromSupabase()
                .then(data => {
                    lastProductsSignature = JSON.stringify(data);
                    allProductsCache = data;

                    const loader = document.getElementById('loading-text');
                    if (loader) loader.remove();

                    bindFilterEvents();
                    renderFilteredProducts();

                    const info = document.getElementById('kf-results-info');
                    if (info) info.textContent = t('showing_of', { a: data.length, b: data.length });

                    // Lightweight periodic sync.
                    productsRefreshTimer = setInterval(() => {
                        refreshProductsFromServer(true);
                    }, PRODUCTS_AUTO_REFRESH_MS);
                })
                .catch(err => {
                    const container = document.getElementById('products-container');
                    if (container) container.innerHTML = `<p style="grid-column:1/-1;color:#ff6b6b;text-align:center;">${t('products_error', { e: err.message })}</p>`;
                });
        }
    }

    const VALID_PAGES = ['home', 'products', 'tutorials', 'qccheck', 'tools'];
    function pageFromPath() {
        const seg = (window.location.pathname || '/').replace(/^\/+|\/+$/g, '').toLowerCase();
        return VALID_PAGES.includes(seg) ? seg : 'home';
    }
    function navigateTo(pageId, replace) {
        if (!VALID_PAGES.includes(pageId)) pageId = 'home';
        const path = pageId === 'home' ? '/' : '/' + pageId;
        if (window.location.pathname !== path) {
            if (replace) history.replaceState({ page: pageId }, '', path);
            else history.pushState({ page: pageId }, '', path);
        }
        renderPage(pageId);
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

    window.addEventListener('popstate', () => {
        renderPage(pageFromPath());
    });

    const initial = pageFromPath();
    history.replaceState({ page: initial }, '', initial === 'home' ? '/' : '/' + initial);
    renderPage(initial);
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
            <div class="qc-batch-card" onclick="openQcBatch(${bi})">
                <div class="qc-batch-cover">
                    <img src="${b.imgs[0]}" loading="lazy" alt="${escapeHtml(b.label)}"/>
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
        if (pickslyUrl && actionsEl) {
            actionsEl.style.display = 'flex';
            actionsEl.innerHTML = `<a class="qc-picksly-btn" href="${pickslyUrl}" target="_blank" rel="noopener">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                ${t('qc_view_picksly')}
            </a>`;
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
    document.getElementById('qc-batch-modal-images').innerHTML = b.imgs.map((url, i) =>
        `<div class="qc-img-wrap" onclick="openQcLightbox('${url.replace(/'/g, "\\'")}')">
            <img src="${url}" loading="lazy" alt="QC ${idx}-${i}"/>
        </div>`).join('');
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
const RV_MAX = 12;

window.trackRecentlyViewed = function(jsonStr) {
    try {
        const item = JSON.parse(jsonStr.replace(/&quot;/g, '"').replace(/&#39;/g, "'"));
        let rv = [];
        try { rv = JSON.parse(localStorage.getItem(RV_KEY)) || []; } catch(e) {}
        rv = rv.filter(x => x.title !== item.title);
        rv.unshift(item);
        if (rv.length > RV_MAX) rv = rv.slice(0, RV_MAX);
        localStorage.setItem(RV_KEY, JSON.stringify(rv));
    } catch(e) {}
};

function getRecentlyViewed() {
    try { return JSON.parse(localStorage.getItem(RV_KEY)) || []; } catch(e) { return []; }
}

function buildRecentlyViewedMarquee() {
    const rv = getRecentlyViewed();
    if (rv.length === 0) return '';
    const kakobuyAffcode = 'affcode=keviinn';
    const cards = rv.map(item => {
        const kakobuy = item.kakobuy
            ? (item.kakobuy.includes('affcode') ? item.kakobuy : item.kakobuy + (item.kakobuy.includes('?') ? '&' : '?') + kakobuyAffcode)
            : '#';
        const picksly = item.picksly || '#';
        const img = item.img
            ? `<img src="${escapeHtml(item.img)}" alt="${escapeHtml(item.title)}" style="width:100%;height:100%;object-fit:cover;" loading="lazy" onerror="this.style.display='none'" />`
            : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--text-secondary);font-size:0.7rem;">No img</div>`;
        return `
        <div class="rv-card">
            <div class="rv-img">${img}</div>
            <div class="rv-info">
                <div class="rv-title">${escapeHtml(stripEmojis(item.title))}</div>
                <div class="rv-price">${formatPrice(item.price)}</div>
                <div class="rv-actions">
                    <a href="${escapeHtml(kakobuy)}" target="_blank" rel="noopener" class="rv-btn" style="background:#ff8c00;color:#fff;flex:1;text-align:center;text-decoration:none;border-radius:8px;padding:0.4rem 0.2rem;font-size:0.72rem;font-weight:700;">Buy Now</a>
                    <a href="${escapeHtml(picksly)}" target="_blank" rel="noopener" class="rv-btn rv-btn-qc">QC</a>
                </div>
            </div>
        </div>`;
    }).join('');

    return `
    <div class="rv-section">
        <div class="rv-label">Recently Viewed</div>
        <div class="rv-track-wrap">
            <div class="rv-track" id="rv-track">${cards}${cards}</div>
        </div>
    </div>`;
}

// ─── WEIGHT ESTIMATOR ──────────────────────────────────────────────────────
const WEIGHT_CATS = [
    { id: 'footwear',     label: 'Footwear',     weight: 900 },
    { id: 'tops',         label: 'Tops',          weight: 250 },
    { id: 'bottoms',      label: 'Bottoms',       weight: 400 },
    { id: 'hoodies',      label: 'Hoodies',       weight: 600 },
    { id: 'jackets',      label: 'Jackets',       weight: 750 },
    { id: 'bags',         label: 'Bags',          weight: 500 },
    { id: 'accessories',  label: 'Accessories',   weight: 120 },
    { id: 'electronics',  label: 'Electronics',   weight: 350 },
    { id: 'socks',        label: 'Socks',         weight: 60  },
    { id: 'hats',         label: 'Hats / Caps',   weight: 150 },
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
                <button class="weight-qty-btn" onclick="weightChange('${cat.id}',-1)">-</button>
                <span class="weight-qty-val">${qty}</span>
                <button class="weight-qty-btn" onclick="weightChange('${cat.id}',1)">+</button>
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
        resultDiv.innerHTML = t('conv_invalid');
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
