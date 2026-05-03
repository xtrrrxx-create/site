# Jarvis Finder — Site Brain

## Ce este site-ul
**jarvis-finder.com** — un site de găsit produse Taobao/Weidian pentru agent shopping (Kakobuy, PandaBuy etc).  
SPA (Single Page App) fără framework — vanilla JS, HTML, CSS pur.  
Hosting: **Vercel** (auto-deploy din `main` branch pe GitHub).

## Stack tehnic
- `index.html` — structura paginii, navbar pill fix, bottom nav mobile, command palette, settings modal
- `css/style.css` — tot CSS-ul, inclusiv dark/light mode via CSS variables
- `js/app.js` — logica principală: routing, pagini, produse, filtre, traduceri, tools
- `js/enhancements.js` — features extra: command palette (Ctrl+K), 3D tilt, scroll reveal, live search dropdown, skeleton loading, cursor mac

## Baza de date
**Supabase** — tabel `products` cu coloanele: `id, title, price, img, kakobuy, picksly, category, batch`  
Produsele se fetch-uiesc client-side la fiecare vizită.

## Pagini (SPA routing prin History API)
| URL | pageId | Descriere |
|-----|--------|-----------|
| `/` | `home` | Hero cu animație Goodly font |
| `/products` | `products` | Grid produse cu filtre + search |
| `/tutorials` | `tutorials` | Ghid how-to-buy |
| `/qccheck` | `qccheck` | QC checker cu Picksly |
| `/tools` | `tools` | Link converter + package tracker |

## Navigație
- **Desktop**: navbar pill flotant centrat sus (`nav-container > navbar`)
- **Mobile**: bottom nav fix jos (`bottom-nav`)
- Middle-click pe link deschide URL corect (href real pe fiecare link, nu `#`)

## Features active (js/enhancements.js)
- **Command Palette** — `Ctrl+K`, caută pagini + produse din cache
- **3D Card Tilt** — pe `.product-card` la hover, via `applyTilt()`
- **Scroll Reveal** — fade+slide carduri la scroll, IntersectionObserver
- **Live Search Dropdown** — top 5 rezultate sub search box instant
- **Skeleton Loading** — `showSkeletonCards(10)` înaintea fetch-ului de produse
- **Cursor Mac** — săgeată neagră cu contur alb (SVG data URL în CSS)

## CSS Variables (dark mode default)
```
--bg-color: #121212
--nav-bg: #18181A
--border-color: #27272A
--text-primary: #ffffff
--text-secondary: #A1A1AA
```
Light mode activat cu `body.light-mode`.

## Cum se adaugă produse
Via **admin-app** (Electron local, nu e pe GitHub public) sau direct în Supabase dashboard.

## Convenții importante
- Nu folosi frameworks (React, Vue etc) — totul vanilla
- Nu adăuga build steps — fișierele se servesc direct
- `git push origin main` = deploy automat pe Vercel
- Imaginile sunt URL-uri externe (Taobao CDN)
- Prețurile sunt stocate în CNY, convertite client-side după currency selectat

## Utilizator
Kevin — owner site, preferă răspunsuri scurte și directe. Face push automat la final.

## Obsidian Vault
Vault la: `C:\Users\kevin\Desktop\site\jarvis-finder\`  
**Citește întotdeauna la start** notele relevante din vault:
- `Site Overview.md` — arhitectura completă a site-ului
- `Changelog.md` — istoricul schimbărilor
- `Scripts & Tools.md` — toate scripturile backend
- `2026-05-03 Jarvis Finder schimbări.md` — ultima sesiune de lucru
