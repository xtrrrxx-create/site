# Jarvis Finder — Site Overview

**URL**: jarvis-finder.com  
**Tip**: SPA (Single Page App) — vanilla JS, HTML, CSS pur, fără framework  
**Hosting**: Vercel (auto-deploy din `main` branch GitHub)  
**Repo local**: `C:\Users\kevin\Desktop\site`

## Ce face site-ul
Site de găsit produse Taobao/Weidian pentru agent shopping (Kakobuy, PandaBuy etc).  
Userii caută produse, văd prețul convertit în moneda lor, și accesează linkul de agent.

## Stack tehnic
| Fișier | Rol |
|--------|-----|
| `index.html` | Structura paginii, navbar pill, bottom nav mobile, command palette, settings modal |
| `css/style.css` | Tot CSS-ul, dark/light mode via CSS variables |
| `js/app.js` | Routing, pagini, produse, filtre, traduceri, tools, currency |
| `js/enhancements.js` | Command palette, 3D tilt, scroll reveal, live search, skeleton loading, cursor mac |

## Baza de date
**Supabase** — tabel `products`  
Coloane: `id, title, price, img, kakobuy, picksly, category, batch`  
Fetch client-side la fiecare vizită.

## Pagini (SPA routing History API)
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
- Middle-click deschide URL corect (href real, nu `#`)

## Features active (js/enhancements.js)
- **Command Palette** — `Ctrl+K`, caută pagini + produse din cache
- **3D Card Tilt** — pe `.product-card` la hover, via `applyTilt()`
- **Scroll Reveal** — fade+slide carduri la scroll, IntersectionObserver
- **Live Search Dropdown** — top 5 rezultate sub search box instant
- **Skeleton Loading** — `showSkeletonCards(10)` înainte de fetch produse
- **Cursor Mac** — săgeată neagră cu contur alb (SVG data URL în CSS)

## CSS Variables (dark mode default)
```css
--bg-color: #121212
--nav-bg: #18181A
--border-color: #27272A
--text-primary: #ffffff
--text-secondary: #A1A1AA
```
Light mode activat cu `body.light-mode`.

## Currency
Rate-uri fixe Kakobuy din CNY base:
- USD: 1/6.31
- EUR: USD × 0.92
- RON: USD × 4.58
- PLN: USD × 3.98

Stocat în `localStorage('currency')`, default USD.

## Convenții importante
- NO frameworks (React, Vue etc) — totul vanilla
- NO build steps — fișierele se servesc direct
- `git push origin main` = deploy automat pe Vercel
- Imagini = URL-uri externe Taobao CDN
- Prețuri stocate în CNY, convertite client-side

## Cum se adaugă produse
Via **admin-app** (Electron local, nu e pe GitHub public) sau direct în Supabase dashboard.
