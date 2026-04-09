import json
import re

from playwright.sync_api import sync_playwright

DB_PATH = "products.json"


def is_bad_or_empty(url: str) -> bool:
    u = (url or "").strip().lower()
    if not u:
        return True
    bad = (
        "img.alicdn.com/imgextra/",
        "img.alicdn.com/tfs/",
        "hz_img_",
        "nstatic.kakobuy.com/banner/",
        "og-image.jpg",
        "picks.ly/marketplace-logos/",
        "picks.ly/agent-logos/",
        "picks.ly/twitter-image",
    )
    return any(x in u for x in bad)


def score_image(url: str) -> int:
    u = url.lower()
    score = 0
    if "si.geilicdn.com" in u:
        score += 100
    if "alicdn.com" in u:
        score += 80
    if re.search(r"\.(jpg|jpeg|png|webp)(\?|$)", u):
        score += 30
    if "imgextra" in u or "/tfs/" in u or "og-image.jpg" in u:
        score -= 200
    if "picks.ly/marketplace-logos/" in u:
        score -= 350
    if "picks.ly/agent-logos/" in u or "picks.ly/twitter-image" in u:
        score -= 300
    # avoid tiny icon-like files
    m = re.search(r"-(\d+)-(\d+)\.(png|jpg|jpeg|webp)$", u)
    if m:
        w = int(m.group(1))
        h = int(m.group(2))
        if w < 220 or h < 220:
            score -= 200
    return score


def pick_best(candidates: list[str]) -> str:
    uniq = []
    seen = set()
    for c in candidates:
        cc = (c or "").strip()
        if not cc.startswith("http"):
            continue
        if cc in seen:
            continue
        seen.add(cc)
        uniq.append(cc)
    if not uniq:
        return ""
    uniq.sort(key=score_image, reverse=True)
    best = uniq[0]
    return best if score_image(best) > 0 else ""


def extract_urls(text: str) -> list[str]:
    if not text:
        return []
    return re.findall(r"https?://[^\s\"'<>]+", text)


def main():
    with open(DB_PATH, "r", encoding="utf-8") as f:
        db = json.load(f)

    target_indices = [
        i for i, x in enumerate(db)
        if (x.get("picksly") or "").strip().startswith("https://picks.ly/item/")
        and is_bad_or_empty(x.get("img", ""))
    ]

    updated = 0

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(user_agent="Mozilla/5.0")
        page = context.new_page()
        page.set_default_timeout(12000)

        for n, idx in enumerate(target_indices, start=1):
            link = db[idx]["picksly"].strip()
            candidates = []

            def on_response(resp):
                try:
                    ct = (resp.headers or {}).get("content-type", "")
                    # parse JSON/text responses for image urls
                    if any(x in ct for x in ("json", "text", "javascript")):
                        body = resp.text()
                        candidates.extend(extract_urls(body))
                    # direct image response
                    if "image/" in ct:
                        candidates.append(resp.url)
                except Exception:
                    pass

            page.on("response", on_response)
            try:
                page.goto(link, wait_until="domcontentloaded")
                page.wait_for_timeout(3000)
                candidates.extend(extract_urls(page.content()))
                dom_imgs = page.eval_on_selector_all("img", "els => els.map(e => e.src).filter(Boolean)")
                if isinstance(dom_imgs, list):
                    candidates.extend(dom_imgs)
            except Exception:
                page.remove_listener("response", on_response)
                continue
            page.remove_listener("response", on_response)

            best = pick_best(candidates)
            if best:
                db[idx]["img"] = best
                updated += 1

            if n % 10 == 0:
                print("progress", n, "/", len(target_indices), "updated", updated)

        context.close()
        browser.close()

    with open(DB_PATH, "w", encoding="utf-8") as f:
        json.dump(db, f, indent=4, ensure_ascii=False)

    remaining = sum(
        1 for x in db if (x.get("kakobuy") or "").strip() and is_bad_or_empty(x.get("img", ""))
    )
    print("targets", len(target_indices))
    print("updated", updated)
    print("remaining_bad_or_missing", remaining)


if __name__ == "__main__":
    main()
