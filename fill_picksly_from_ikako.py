import json
import re
import urllib.parse

from playwright.sync_api import sync_playwright

DB_PATH = "products.json"


def picksly_from_source(url: str) -> str:
    m = re.search(r"itemID=(\d+)", url, re.I)
    if m:
        return f"https://picks.ly/item/WD{m.group(1)}"

    m = re.search(r"[?&]id=(\d+)", url, re.I)
    if m:
        return f"https://picks.ly/item/TB{m.group(1)}"

    m = re.search(r"/offer/(\d+)\.html", url, re.I)
    if m:
        return f"https://picks.ly/item/1688{m.group(1)}"

    m = re.search(r"/product-detail/[^/]*?(\d+)\.html", url, re.I)
    if m:
        return f"https://picks.ly/item/AL{m.group(1)}"

    return ""


def source_from_final_url(final_url: str) -> str:
    parsed = urllib.parse.urlparse(final_url)
    host = (parsed.netloc or "").lower()
    if "kakobuy.com" in host:
        qs = urllib.parse.parse_qs(parsed.query or "")
        embedded = (qs.get("url") or [""])[0].strip()
        if embedded.startswith("http://") or embedded.startswith("https://"):
            return embedded
    return final_url


def main():
    with open(DB_PATH, "r", encoding="utf-8") as f:
        db = json.load(f)

    targets = [
        i for i, item in enumerate(db)
        if (item.get("kakobuy") or "").strip()
        and not (item.get("picksly") or "").strip()
    ]

    updated = 0
    failed = 0

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(user_agent="Mozilla/5.0")
        page = context.new_page()
        page.set_default_timeout(10000)

        for n, idx in enumerate(targets, start=1):
            kk = (db[idx].get("kakobuy") or "").strip()
            if "ikako.vip" not in kk and "kakobuy.com" not in kk:
                failed += 1
                continue
            try:
                page.goto(kk, wait_until="domcontentloaded")
                page.wait_for_timeout(900)
                src = source_from_final_url(page.url)
                pk = picksly_from_source(src)
                if pk:
                    db[idx]["picksly"] = pk
                    updated += 1
                else:
                    failed += 1
            except Exception:
                failed += 1

            if n % 25 == 0:
                print("progress", n, "/", len(targets))

        context.close()
        browser.close()

    with open(DB_PATH, "w", encoding="utf-8") as f:
        json.dump(db, f, indent=4, ensure_ascii=False)

    missing = sum(1 for x in db if (x.get("kakobuy") or "").strip() and not (x.get("picksly") or "").strip())
    print("targets", len(targets))
    print("updated", updated)
    print("failed", failed)
    print("missing_now", missing)


if __name__ == "__main__":
    main()
