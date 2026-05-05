# Jarvis Finder — Changelog

## 2026-05-05 — Security audit pass
### Audit findings (verificate)
- ✅ **Zero secrete hardcoded** — toate cheile (Supabase, Picksly) vin din `process.env` în serverless functions
- ✅ **Proxy layer complet** — frontend lovește doar `/api/products` și `/api/qc`, nu vede niciodată Supabase URL/anon key sau Picksly key
- ✅ **`.gitignore`** acoperă `.env*`, scripturi cu service_role, exporturi Supabase, `.obsidian/`
- ✅ **`git ls-files | grep -E "eyJ...|service_role|sk_live"`** → 0 hituri în istoric tracked
- ✅ **CSP strict** în `vercel.json`: `default-src 'self'`, `script-src 'self'` (no inline), `frame-ancestors 'none'`, HSTS preload, COOP/CORP, Permissions-Policy
- ✅ **SSRF safe** în `/api/qc` — host allowlist suffix-match (taobao/weidian/etc), protocol check `http(s):`, max URL 2048, strip credentials/fragment
- ✅ **Rate limit** `/api/qc` — 60 req/IP/5min + burst 10 req/10s, in-memory cu cleanup opportunistic
- ✅ **Origin/Referer/Sec-Fetch-Site** triple check pe `/api/qc`, allowlist Origin pe `/api/products`
- ✅ **No SQL** — Supabase REST cu `select=` cu coloane fixe, fără query injection vector
- ✅ **XSS** — toate inserțiile dinamice trec prin `escapeHtml()` + `safeExternalUrl()`; `innerHTML` folosit doar cu static templates / translation keys
- ✅ **Method allowlist** — `GET` only pe ambele rute, 405 cu header `Allow`
- ✅ **Generic errors** la client (`Upstream error`, `Server misconfigured`); detaliile rămân în `console.error` server-side

### Hardening aplicat în această sesiune
- **`api/products.js`**: validare defense-in-depth a `SUPABASE_URL` — trebuie `https:` și hostname `*.supabase.co|.in`, altfel 500. Previne SSRF dacă env-ul ajunge greșit configurat. Adăugat `Vary: Origin`.
- **`api/qc.js`**: adăugat `Vary: Origin`.
- **`js/app.js`**: scos `console.log("Products refreshed from server.")` și `console.warn` din auto-refresh — zero log-uri în consola browserului în producție.
- **`.env.example`**: documentat `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `PICKSLY_API_KEY` (set în dashboard Vercel, nu commit-uit).

### Recomandări (opționale, nu blocante)
- Pentru rate-limit global cross-region pe `/api/qc` ar trebui Vercel KV / Upstash Redis (acum e per-instanță)
- Rotire periodică Picksly API key în Vercel dashboard
- `npm audit` n/a (no package.json la root — nu sunt dependențe runtime pe site)

## 2026-05-03 (6)
### Cards — Picks.ly clone exact
- Badge 店: `border-radius: 5px` (pătrat cu colțuri rotunjite, identic Picks.ly)
- Titlu: 2 linii (`-webkit-line-clamp: 2`) în loc de 1 linie truncată
- View QC buton: `border: 1px solid #3a3a3c` adăugat (ca Picks.ly)

## 2026-05-03 (5)
### Frontend — Cards 1:1 Picks.ly
- Badge 店: schimbat din rectangular roșu → **cerc portocaliu** (#e8520a, border-radius 50%, 20x20px)
- Store name: schimbat din gri (#888) → **alb** (#fff)

## 2026-05-03 (4)
### Frontend / Site
- Tematică portocalie inspirată din Picks.ly: accent #ff8c00 pe butoane și elemente cheie
- Navbar mai slim și mai lat: `width: 1200px; padding: 0.35rem 0.6rem`
- Hero: eyebrow "Smart Product Discovery" repoziționat, buton "Explore Products" mutat top-right absolut
- Titlu "jarvis finder" pe O SINGURĂ LINIE: `clamp(3rem, 8.5vw, 9rem)`, `white-space: nowrap`, două culori (alb solid + outlined)
- Carduri Recently Viewed umplu ecranul fără scroll: `height: calc(100vh - Xpx)`, 5-6 pe rând
- Carduri produse redesign în stil Picks.ly (fără schimbare dimensiuni):
  - Background `#1c1c1e`, fără border
  - Badge roșu "店" + nume categorie gri
  - Titlu alb truncat, preț alb bold
  - Buton Buy Now: `#f5a623` pill orange
  - Buton View QC: `#2c2c2e` pill gri

## 2026-05-03 (3)
### Home — Recently Viewed Marquee
- Secțiune "Recently Viewed" pe home page cu animație marquee dreapta→stânga
- Tracking automat când userul dă click pe Buy Now sau QC pe orice produs
- Carduri cu imagine, titlu, preț, butoane Buy Now + QC funcționale
- Stocat în localStorage (`jf_recently_viewed`), max 12 produse
- Marquee se oprește la hover
- Fade-out pe margini via CSS mask-image
- Dispare automat dacă nu există produse vizitate

## 2026-05-03 (2)
### Tools — Weight Estimator
- Adăugat tool nou "Weight Estimator" în pagina /tools
- 10 categorii: Footwear, Tops, Bottoms, Hoodies, Jackets, Bags, Accessories, Electronics, Socks, Hats
- Qty selector per categorie (+/- butoane)
- Afișare rezultat în g, kg, lbs + packaging weight (50g fix)
- Reset button
- Logica: `WEIGHT_CATS` array cu greutăți per categorie, `initWeightEstimator()` apelat la render tools page

## 2026-05-03
### Frontend / Site
- Restaurat navbar pill original (flotant, centrat)
- Cursor Mac negru cu contur alb (SVG în CSS)
- Adăugat `CLAUDE.md` — documentație site pentru Claude Code

### Enhancements adăugate
- Command Palette (`Ctrl+K`) — search pagini + produse
- 3D Card Tilt pe hover la product cards
- Scroll Reveal — fade+slide carduri la scroll
- Live Search Dropdown — top 5 rezultate instant sub search box
- Skeleton Loading — placeholder înainte de fetch produse

### Fix-uri
- Middle-click pe linkuri nav acum deschide URL corect (href real, nu `#`)

### Backend / Scripts
- `admin_realtime.py` — refactor major (~400 linii schimbate)
- `auto_import.py`, `enrich_products.py`, `enrich_products_browser.py`, `fill_picksly_from_ikako.py`, `full_import_fast.py` — mici ajustări
- `requirements-admin-realtime.txt` — 2 dependințe noi adăugate
- `products.json` — update produse
