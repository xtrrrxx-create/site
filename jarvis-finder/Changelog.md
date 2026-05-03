# Jarvis Finder — Changelog

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
