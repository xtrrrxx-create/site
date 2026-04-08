import json
import re
import time
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

DB_PATH = "products.json"


def picksly_from_source(source_url: str) -> str:
    m = re.search(r"itemID=(\d+)", source_url, re.I)
    if m:
        return f"https://picks.ly/item/WD{m.group(1)}"

    m = re.search(r"[?&]id=(\d+)", source_url, re.I)
    if m:
        return f"https://picks.ly/item/TB{m.group(1)}"

    m = re.search(r"/offer/(\d+)\.html", source_url, re.I)
    if m:
        return f"https://picks.ly/item/1688{m.group(1)}"

    m = re.search(r"/product-detail/[^/]*?(\d+)\.html", source_url, re.I)
    if m:
        return f"https://picks.ly/item/AL{m.group(1)}"

    return ""


def image_from_html(html: str) -> str:
    patterns = [
        r'"pic":"(https?://[^"]+?\.(?:jpg|jpeg|png|webp|gif)[^"]*)"',
        r'"img":"(https?://[^"]+?\.(?:jpg|jpeg|png|webp|gif)[^"]*)"',
        r'"picList":\["(https?://[^"]+?\.(?:jpg|jpeg|png|webp|gif)[^"]*)"',
        r'<img[^>]+src="(https?://[^"]+?\.(?:jpg|jpeg|png|webp|gif)[^"]*)"',
    ]
    for pattern in patterns:
        match = re.search(pattern, html, re.I)
        if match:
            return match.group(1).replace("\\u002F", "/").replace("\\/", "/")
    return ""


def should_process(item: dict) -> bool:
    kk = (item.get("kakobuy") or "").strip()
    if not kk:
        return False
    return not (item.get("picksly") or "").strip() or not (item.get("img") or "").strip()


def main():
    with open(DB_PATH, "r", encoding="utf-8") as f:
        db = json.load(f)

    targets = [(i, x) for i, x in enumerate(db) if should_process(x)]
    if not targets:
        print("No targets.")
        return

    updated_picksly = 0
    updated_img = 0
    checked = 0

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        )
        page = context.new_page()
        page.set_default_timeout(5500)

        for idx, item in targets:
            kakobuy = (item.get("kakobuy") or "").strip()
            checked += 1
            try:
                page.goto(kakobuy, wait_until="domcontentloaded")
                # Mic delay pentru redirect JS.
                page.wait_for_timeout(700)
                final_url = page.url
                final_host = (urlparse(final_url).netloc or "").lower()
                html = page.content()
            except Exception:
                continue

            if not (item.get("picksly") or "").strip():
                pk = picksly_from_source(final_url)
                if pk:
                    db[idx]["picksly"] = pk
                    updated_picksly += 1

            if not (item.get("img") or "").strip():
                img = image_from_html(html)
                if not img and final_host.endswith("ikako.vip"):
                    # Dacă nu s-a făcut redirect real, încercăm un pic mai mult.
                    try:
                        page.wait_for_timeout(900)
                        html2 = page.content()
                        img = image_from_html(html2)
                    except Exception:
                        pass
                if img:
                    db[idx]["img"] = img
                    updated_img += 1

            if checked % 15 == 0:
                with open(DB_PATH, "w", encoding="utf-8") as f:
                    json.dump(db, f, indent=4, ensure_ascii=False)
                print("progress", checked, "/", len(targets))

        context.close()
        browser.close()

    with open(DB_PATH, "w", encoding="utf-8") as f:
        json.dump(db, f, indent=4, ensure_ascii=False)

    missing_picksly = sum(
        1 for x in db if (x.get("kakobuy") or "").strip() and not (x.get("picksly") or "").strip()
    )
    missing_img = sum(
        1 for x in db if (x.get("kakobuy") or "").strip() and not (x.get("img") or "").strip()
    )

    print("targets", len(targets))
    print("checked", checked)
    print("updated_picksly", updated_picksly)
    print("updated_img", updated_img)
    print("missing_picksly", missing_picksly)
    print("missing_img", missing_img)


if __name__ == "__main__":
    start = time.time()
    main()
    print("elapsed_s", round(time.time() - start, 2))
