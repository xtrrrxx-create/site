import json
import re
import sys
import urllib.parse

from playwright.sync_api import sync_playwright

DB_PATH = "products.json"

GOOD_HOST_HINTS = (
    "si.geilicdn.com",
    "img.alicdn.com",
    "cbu01.alicdn.com",
)

BAD_HINTS = (
    "nstatic.kakobuy.com/banner/",
    "s.yupoo.com/website/",
    "logo_3.png",
    "img.alicdn.com/imgextra/",
    "img.alicdn.com/tfs/",
    "-2-tps-48-48.png",
    "-2-tps-553-313.png",
    "hz_img_",
    "og-image.jpg",
)


def is_good_image(url: str) -> bool:
    if not url or not url.startswith("http"):
        return False
    u = url.lower()
    if any(b in u for b in BAD_HINTS):
        return False
    # reject tiny icon-like assets
    if re.search(r"-(\d+)-(\d+)\.(png|jpg|jpeg|webp)$", u):
        m = re.search(r"-(\d+)-(\d+)\.(png|jpg|jpeg|webp)$", u)
        if m and (int(m.group(1)) < 220 or int(m.group(2)) < 220):
            return False
    return any(h in u for h in GOOD_HOST_HINTS)


def extract_source_from_final(final_url: str) -> str:
    try:
        p = urllib.parse.urlparse(final_url)
        if "kakobuy.com" not in (p.netloc or "").lower():
            return final_url
        qs = urllib.parse.parse_qs(p.query or "")
        embedded = (qs.get("url") or [""])[0].strip()
        if embedded.startswith("http://") or embedded.startswith("https://"):
            return embedded
    except Exception:
        pass
    return ""


def collect_candidate_urls(text: str) -> list[str]:
    if not text:
        return []
    urls = re.findall(r"https?://[^\s\"'<>]+", text)
    # keep order, unique
    out = []
    seen = set()
    for u in urls:
        if u in seen:
            continue
        seen.add(u)
        out.append(u)
    return out


def choose_best_image(candidates: list[str]) -> str:
    # strong preference: geilicdn png/jpg/webp/gif
    for u in candidates:
        lu = u.lower()
        if not (lu.startswith("http://") or lu.startswith("https://")):
            continue
        if any(b in lu for b in BAD_HINTS):
            continue
        if "si.geilicdn.com" in lu and re.search(r"\.(jpg|jpeg|png|webp|gif)(\?|$)", lu):
            return u
    # second: alicdn
    for u in candidates:
        lu = u.lower()
        if any(b in lu for b in BAD_HINTS):
            continue
        if ("img.alicdn.com" in lu or "cbu01.alicdn.com" in lu) and re.search(r"\.(jpg|jpeg|png|webp|gif)(\?|$)", lu):
            return u
    return ""


def main():
    batch_size = 50
    if len(sys.argv) > 1:
        try:
            batch_size = max(1, int(sys.argv[1]))
        except Exception:
            pass

    with open(DB_PATH, "r", encoding="utf-8") as f:
        db = json.load(f)

    targets = [
        i for i, item in enumerate(db)
        if (item.get("kakobuy") or "").strip() and not is_good_image((item.get("img") or "").strip())
    ]
    targets = targets[:batch_size]

    if not targets:
        print("targets", 0)
        return

    updated = 0
    resolved_source = 0

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        page = context.new_page()
        page.set_default_timeout(9000)

        for n, idx in enumerate(targets, start=1):
            kk = (db[idx].get("kakobuy") or "").strip()

            try:
                page.goto(kk, wait_until="domcontentloaded")
                page.wait_for_timeout(900)
            except Exception:
                continue

            final_url = page.url
            source = extract_source_from_final(final_url)
            if source:
                resolved_source += 1

            candidates = []
            # 1) from kakobuy page content
            try:
                candidates.extend(collect_candidate_urls(page.content()))
            except Exception:
                pass

            # 2) from source page content
            if source:
                try:
                    page.goto(source, wait_until="domcontentloaded")
                    page.wait_for_timeout(900)
                    html = page.content()
                    candidates.extend(collect_candidate_urls(html))
                    # capture loaded img src directly from DOM
                    dom_imgs = page.eval_on_selector_all("img", "els => els.map(e => e.src).filter(Boolean)")
                    if isinstance(dom_imgs, list):
                        candidates.extend(dom_imgs)
                except Exception:
                    pass

            best = choose_best_image(candidates)
            if best:
                db[idx]["img"] = best
                updated += 1

            if n % 10 == 0:
                print("progress", n, "/", len(targets), "updated", updated)

        context.close()
        browser.close()

    with open(DB_PATH, "w", encoding="utf-8") as f:
        json.dump(db, f, indent=4, ensure_ascii=False)

    remaining = sum(
        1 for x in db if (x.get("kakobuy") or "").strip() and not is_good_image((x.get("img") or "").strip())
    )
    print("targets", len(targets))
    print("resolved_source", resolved_source)
    print("updated", updated)
    print("remaining_missing_or_bad", remaining)


if __name__ == "__main__":
    main()
