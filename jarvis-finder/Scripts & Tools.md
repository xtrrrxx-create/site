# Jarvis Finder — Scripts & Tools Backend

Toate scripturile sunt în `C:\Users\kevin\Desktop\site\`

## Import & Sync produse
| Script | Rol |
|--------|-----|
| `auto_import.py` | Import automat produse |
| `full_import_fast.py` | Import rapid complet |
| `enrich_products.py` | Îmbogățire date produse |
| `enrich_products_browser.py` | Îmbogățire via browser (scraping) |
| `fill_picksly_from_ikako.py` | Completează link-uri Picksly din Kakobuy |
| `fill_missing_images.py` | Completează imagini lipsă |
| `fill_qc_all.py` | Completează date QC |

## Admin & Realtime
| Script | Rol |
|--------|-----|
| `admin_realtime.py` | Admin panel cu actualizări realtime (WebSocket/Supabase) |
| `requirements-admin-realtime.txt` | Dependințe Python pentru admin realtime |

## Curățare & Fix
| Script | Rol |
|--------|-----|
| `clear_bad_imgs.py` | Șterge imagini invalide |
| `dedup_prefer_image.py` | Deduplicare, preferă produse cu imagini |
| `delete_after_id.py` | Șterge produse după un ID |

## JS Tools
| Script | Rol |
|--------|-----|
| `fix_images.js` | Fix imagini |
| `fix_images_fast.js` | Fix imagini rapid |
| `fix_images_turbo.js` | Fix imagini ultra-rapid |
| `import-products.js` | Import produse din JSON în Supabase |
| `update_prices.js` | Actualizare prețuri |
| `update_supabase_imgs.js` | Actualizare imagini în Supabase |

## Scrapers
| Script | Rol |
|--------|-----|
| `discord_scraper.py` | Scraper produse din Discord |
| `multi_scraper.py` | Scraper multi-sursă |

## Date locale
- `products.json` — cache local produse
- `products_supabase.json` — snapshot Supabase
- `discord_products_backup.json` — backup Discord
