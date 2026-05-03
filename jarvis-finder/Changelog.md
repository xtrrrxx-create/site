# Jarvis Finder — Changelog

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
