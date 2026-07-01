import json
import urllib.parse

from playwright.sync_api import sync_playwright

import auto_import as ai

DB_PATH = "products.json"


def extract_source_from_final_url(final_url: str) -> str:
    try:
        parsed = urllib.parse.urlparse(final_url)
        if "kakobuy.com" not in (parsed.netloc or "").lower():
            return final_url
        qs = urllib.parse.parse_qs(parsed.query or "")
        embedded = (qs.get("url") or [""])[0]
        if embedded.startswith("http://") or embedded.startswith("https://"):
            return embedded
    except Exception:
        pass
    return ""


def main():
    with open(DB_PATH, "r", encoding="utf-8") as f:
        db = json.load(f)

    target_indices = [
        i for i, item in enumerate(db)
        if (item.get("kakobuy") or "").strip()
        and (not (item.get("picksly") or "").strip() or not (item.get("img") or "").strip())
    ]

    updated_picksly = 0
    updated_img = 0
    resolved_sources = 0

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(user_agent="Mozilla/5.0")
        page = context.new_page()
        page.set_default_timeout(9000)

        for idx in target_indices:
            kk = (db[idx].get("kakobuy") or "").strip()
            try:
                page.goto(kk, wait_until="domcontentloaded")
                page.wait_for_timeout(1200)
                final_url = page.url
            except Exception:
                continue

            source = extract_source_from_final_url(final_url)
            if not source:
                continue
            resolved_sources += 1

            if not (db[idx].get("picksly") or "").strip():
                pk = ai.make_picksly(source)
                if pk:
                    db[idx]["picksly"] = pk
                    updated_picksly += 1

            if not (db[idx].get("img") or "").strip():
                img = ai.make_img(source)
                if img:
                    db[idx]["img"] = img
                    updated_img += 1

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

    print("targets", len(target_indices))
    print("resolved_sources", resolved_sources)
    print("updated_picksly", updated_picksly)
    print("updated_img", updated_img)
    print("missing_picksly", missing_picksly)
    print("missing_img", missing_img)


if __name__ == "__main__":
    main()
