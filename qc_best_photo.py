"""
Pick the best QC photo for products using green-background + shape analysis.

Scoring heuristics (trained on Acne/Balenciaga/Supreme QC sets):
  GOOD (front laid flat):  green 25-50%, center_cloth 55-85%, width 70%+, height 80%+
  BAD  (tag/label):        green <8%, cloth fills everything, often high texture (text)
  BAD  (folded/packaged):  green >55%, width <60%, height <75%
  BAD  (back/plain):       low texture (<15), few unique hues, very uniform color
  BAD  (close-up detail):  green <8%, cloth 100%, width+height 100%
"""

import argparse
import io
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import quote

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import httpx
from PIL import Image

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
PICKSLY_KEY = os.environ.get("PICKSLY_API_KEY", "")

SZ = 200
WORKERS = 50


def is_green(r, g, b):
    return g > 80 and g > r * 1.3 and g > b * 1.3


def analyze_image(img_bytes: bytes) -> dict:
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB").resize((SZ, SZ))
    arr = list(img.getdata())
    total = len(arr)

    green = sum(1 for r, g, b in arr if is_green(r, g, b)) / total
    white = sum(1 for r, g, b in arr if r > 220 and g > 220 and b > 220) / total

    # Center 60% (rows 40-160)
    center = arr[SZ * (SZ // 5) : SZ * (SZ * 4 // 5)]
    non_green = [(r, g, b) for r, g, b in center if not is_green(r, g, b)]
    cc = len(non_green) / len(center) if center else 0

    # Clothing blob dimensions
    rows_with_cloth = 0
    for row in range(SZ):
        cloth_in_row = sum(1 for r, g, b in arr[row * SZ : (row + 1) * SZ] if not is_green(r, g, b))
        if cloth_in_row > SZ * 0.2:
            rows_with_cloth += 1
    h_ratio = rows_with_cloth / SZ

    cols_with_cloth = 0
    for col in range(SZ):
        cloth_in_col = sum(1 for row in range(SZ) if not is_green(*arr[row * SZ + col]))
        if cloth_in_col > SZ * 0.2:
            cols_with_cloth += 1
    w_ratio = cols_with_cloth / SZ

    # Texture: average pixel-to-pixel contrast in clothing area
    texture = 0.0
    if len(non_green) > 20:
        diffs = []
        step = max(1, len(non_green) // 300)
        for j in range(0, len(non_green) - 1, step):
            r1, g1, b1 = non_green[j]
            r2, g2, b2 = non_green[j + 1]
            diffs.append(abs(r1 - r2) + abs(g1 - g2) + abs(b1 - b2))
        texture = sum(diffs) / len(diffs) if diffs else 0

    # Unique color clusters in clothing (few = uniform/plain, many = print/pattern)
    hue_set = set()
    for r, g, b in non_green[:300]:
        hue_set.add((r // 40, g // 40, b // 40))
    hues = len(hue_set)

    # Average brightness of clothing
    brightness = 0.0
    if non_green:
        brightness = sum(r + g + b for r, g, b in non_green) / (len(non_green) * 3)

    # Corner sticker detection (top-left quadrant white/bright patch = weight sticker)
    tl_quarter = []
    for row in range(SZ // 4):
        tl_quarter.extend(arr[row * SZ : row * SZ + SZ // 4])
    tl_white = sum(1 for r, g, b in tl_quarter if r > 200 and g > 200 and b > 200) / max(len(tl_quarter), 1)

    # Top-right corner too
    tr_quarter = []
    for row in range(SZ // 4):
        tr_quarter.extend(arr[row * SZ + SZ * 3 // 4 : (row + 1) * SZ])
    tr_white = sum(1 for r, g, b in tr_quarter if r > 200 and g > 200 and b > 200) / max(len(tr_quarter), 1)

    corner_sticker = max(tl_white, tr_white)

    # Color uniformity of clothing (std dev of RGB channels — low = plain back)
    color_var = 0.0
    if len(non_green) > 30:
        rs = [r for r, g, b in non_green[:500]]
        gs = [g for r, g, b in non_green[:500]]
        bs = [b for r, g, b in non_green[:500]]
        def std(vals):
            m = sum(vals) / len(vals)
            return (sum((v - m) ** 2 for v in vals) / len(vals)) ** 0.5
        color_var = (std(rs) + std(gs) + std(bs)) / 3

    # Top-edge green ratio (good laid-flat photos have green at top edge = sleeve area visible)
    top_rows = arr[: SZ * (SZ // 10)]
    top_green = sum(1 for r, g, b in top_rows if is_green(r, g, b)) / max(len(top_rows), 1)

    return {
        "green": green,
        "white": white,
        "cc": cc,
        "h": h_ratio,
        "w": w_ratio,
        "tex": texture,
        "hues": hues,
        "brt": brightness,
        "corner": corner_sticker,
        "cvar": color_var,
        "topg": top_green,
    }


def score_photo(a: dict) -> float:
    g = a["green"]
    cc = a["cc"]
    h = a["h"]
    w = a["w"]
    tex = a["tex"]
    hues = a["hues"]
    wh = a["white"]
    brt = a["brt"]
    corner = a["corner"]
    cvar = a["cvar"]
    topg = a["topg"]

    # ── Hard rejects ──

    # Tag/close-up: no green at all, clothing fills frame
    if g < 0.08 and cc > 0.90:
        return -20.0

    # Way too much green: tiny folded item
    if g > 0.60:
        return -15.0

    # Item too narrow (folded/packaged)
    if w < 0.55:
        return -12.0

    # Item too short (folded at top/bottom)
    if h < 0.65:
        return -10.0

    # Tag with lots of white text
    if wh > 0.20 and g < 0.15:
        return -10.0

    # Barcode/weight sticker in corner
    if corner > 0.40 and g > 0.10:
        return -8.0

    # Very uniform color = plain back side (low color variance + low texture + few hues)
    if cvar < 12 and tex < 12 and hues < 7 and g > 0.15:
        return -6.0

    # ── Scoring ──
    score = 0.0

    # Green frame: ideal 30-45%
    if 0.25 <= g <= 0.48:
        score += 4.0
    elif 0.20 <= g <= 0.55:
        score += 2.0
    else:
        score -= 2.0
    score -= abs(g - 0.37) * 3

    # Center cloth coverage: ideal 60-80%
    if 0.55 <= cc <= 0.85:
        score += 4.0
    elif 0.45 <= cc <= 0.90:
        score += 2.0
    else:
        score -= 2.0

    # Spread: item should fill width (>75%) and height (>80%)
    if w >= 0.75:
        score += 3.0
    elif w >= 0.65:
        score += 1.0

    if h >= 0.85:
        score += 2.0
    elif h >= 0.75:
        score += 1.0

    # Texture: prefer 15-40 (has print/detail, not plain back)
    if 15 <= tex <= 40:
        score += 2.0
    elif 10 <= tex <= 50:
        score += 0.5
    elif tex > 55:
        score -= 2.0
    elif tex < 10:
        score -= 1.5

    # Hue diversity: front with print = 8-20 hues, plain back = <8
    if 8 <= hues <= 20:
        score += 1.0
    elif hues < 6:
        score -= 1.0

    # Penalize very bright clothing (often white tags/labels)
    if brt > 210 and wh > 0.10:
        score -= 2.0

    # Clean photo bonus (no tags/stickers in frame)
    if wh < 0.04:
        score += 0.5

    # Corner sticker penalty (graduated)
    if corner > 0.25:
        score -= 3.0
    elif corner > 0.15:
        score -= 1.5

    # Color variety bonus (front prints have higher variance)
    if cvar > 25:
        score += 1.5
    elif cvar > 18:
        score += 0.5
    elif cvar < 10:
        score -= 1.5

    # Top edge green = item doesn't fill to very top (good for laid-flat)
    if 0.30 <= topg <= 0.80:
        score += 1.0
    elif topg < 0.05:
        score -= 1.0  # no green at top = close-up or tag

    return score


def picksly_to_source(picksly_url: str) -> str:
    m = re.match(r"https?://picks\.ly/item/(WD|TB|AL)(\d+)", picksly_url)
    if not m:
        return ""
    prefix, item_id = m.group(1), m.group(2)
    if prefix == "WD":
        return f"https://weidian.com/item.html?itemID={item_id}"
    if prefix == "TB":
        return f"https://item.taobao.com/item.htm?id={item_id}"
    if prefix == "AL":
        return f"https://detail.1688.com/offer/{item_id}.html"
    return ""


def fetch_products(category: str) -> list[dict]:
    url = f"{SUPABASE_URL}/rest/v1/products?select=id,title,img,picksly,category,kakobuy"
    if category:
        url += f"&category=eq.{quote(category)}"
    url += "&order=id.asc&limit=5000"
    r = httpx.get(
        url,
        headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"},
        timeout=30,
    )
    r.raise_for_status()
    return r.json()


def fetch_qc_images(source_url: str, client: httpx.Client) -> list[str]:
    r = client.get(
        f"https://partner.picks.ly/api/qc/search?url={quote(source_url, safe='')}&limit=50&page=1",
        timeout=15,
    )
    if r.status_code != 200:
        return []
    data = r.json()
    if not data.get("success"):
        return []
    urls = []
    seen = set()
    for album in data.get("albums", []):
        for u in album.get("images", []):
            if isinstance(u, str) and u.startswith("http") and u not in seen:
                seen.add(u)
                urls.append(u)
    return urls


def pick_best(photo_urls: list[str], client: httpx.Client) -> tuple[str, float, dict]:
    best_url = ""
    best_score = -999.0
    best_a = {}

    for url in photo_urls[:25]:
        try:
            r = client.get(url, timeout=10)
            if r.status_code != 200 or "image" not in r.headers.get("content-type", ""):
                continue
            if len(r.content) < 5000:
                continue
            a = analyze_image(r.content)
            s = score_photo(a)
            if s > best_score:
                best_score = s
                best_url = url
                best_a = a
        except Exception:
            continue

    return best_url, best_score, best_a


def update_img(pid: int, img_url: str) -> bool:
    r = httpx.patch(
        f"{SUPABASE_URL}/rest/v1/products?id=eq.{pid}",
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        json={"img": img_url},
        timeout=10,
    )
    return r.status_code < 300


def process_one(product: dict, dry_run: bool) -> dict:
    pid = product["id"]
    title = (product.get("title") or "")[:50]
    picksly = (product.get("picksly") or "").strip()

    if not picksly:
        return {"id": pid, "title": title, "s": "no_picksly"}

    source = picksly_to_source(picksly)
    if not source:
        return {"id": pid, "title": title, "s": "bad_picksly"}

    client = httpx.Client(
        follow_redirects=True,
        headers={"User-Agent": "jarvis-qc/1.0", "X-API-Key": PICKSLY_KEY},
        timeout=15,
    )
    try:
        images = fetch_qc_images(source, client)
        if not images:
            return {"id": pid, "title": title, "s": "no_qc"}

        best_url, best_score, a = pick_best(images, client)
        if not best_url or best_score < 2.0:
            return {"id": pid, "title": title, "s": "no_good"}

        info = f"g={a['green']:.0%} cc={a['cc']:.0%} w={a['w']:.0%} h={a['h']:.0%} tex={a['tex']:.0f} sc={best_score:.1f}"

        if dry_run:
            return {"id": pid, "title": title, "s": "dry", "info": info}

        ok = update_img(pid, best_url)
        return {"id": pid, "title": title, "s": "ok" if ok else "fail", "info": info}
    except Exception as e:
        return {"id": pid, "title": title, "s": f"err:{e}"}
    finally:
        client.close()


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--limit", type=int, default=0)
    p.add_argument("--offset", type=int, default=0, help="Skip first N products")
    p.add_argument("--category", default="T-shirts")
    p.add_argument("--force", action="store_true")
    p.add_argument("--workers", type=int, default=WORKERS)
    a = p.parse_args()

    if not all([SUPABASE_URL, SUPABASE_KEY, PICKSLY_KEY]):
        print("ERROR: set SUPABASE_URL, SUPABASE_SERVICE_KEY, PICKSLY_API_KEY")
        sys.exit(1)

    products = fetch_products(a.category)
    print(f"{len(products)} {a.category or 'all'} products")

    if a.offset:
        products = products[a.offset:]
        print(f"Skipping first {a.offset}, {len(products)} remaining")

    if not a.force:
        products = [
            p
            for p in products
            if not (p.get("img") or "").strip()
            or "alicdn.com/imgextra" in (p.get("img") or "")
            or "kakobuy.com/banner" in (p.get("img") or "")
        ]
        print(f"{len(products)} need photos")

    if a.limit:
        products = products[: a.limit]
    if not products:
        print("Nothing to do!")
        return

    print(f"Running {len(products)} with {a.workers} workers...\n")
    ok = skip = fail = done = 0
    t0 = time.time()

    with ThreadPoolExecutor(max_workers=a.workers) as pool:
        futs = {pool.submit(process_one, p, a.dry_run): p for p in products}
        for f in as_completed(futs):
            done += 1
            res = f.result()
            st = res["s"]
            if st in ("ok", "dry"):
                ok += 1
                print(f"  [{done}/{len(products)}] OK #{res['id']} {res['title']} | {res.get('info','')}")
            elif st.startswith(("no_", "bad_")):
                skip += 1
            else:
                fail += 1
                print(f"  [{done}/{len(products)}] FAIL #{res['id']} {res['title']} ({st})")

    print(f"\nDone {time.time() - t0:.0f}s | OK:{ok} Skip:{skip} Fail:{fail}")
    if a.dry_run:
        print("(dry-run, nothing written)")


if __name__ == "__main__":
    main()
