import concurrent.futures
import json
import re
import urllib.request

DB_PATH = "products.json"

UA = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}


def resolve_url(url: str) -> str:
    try:
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=6) as resp:
            return resp.geturl() or url
    except Exception:
        return url


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


def image_from_source(source_url: str) -> str:
    try:
        req = urllib.request.Request(source_url, headers=UA)
        with urllib.request.urlopen(req, timeout=6) as resp:
            html = resp.read().decode("utf-8", errors="ignore")
    except Exception:
        return ""

    patterns = [
        r'"pic":"(https?://[^"]+?\.(?:jpg|png|webp|gif))',
        r'"img":"(https?://[^"]+?\.(?:jpg|png|webp|gif))',
        r'<img[^>]+src="(https?://[^"]+?\.(?:jpg|png|webp|gif)[^"]*)"',
        r'"picList":\["(https?://[^"]+?\.(?:jpg|png|webp|gif))',
    ]
    for pattern in patterns:
        match = re.search(pattern, html, re.I)
        if match:
            return match.group(1).replace("\\u002F", "/").replace("\\/", "/")
    return ""


def enrich_one(index_and_item: tuple[int, dict]) -> tuple[int, str, str]:
    index, item = index_and_item
    kakobuy = (item.get("kakobuy") or "").strip()
    if not kakobuy:
        return index, "", ""

    source = resolve_url(kakobuy)

    new_picksly = ""
    new_img = ""
    if not (item.get("picksly") or "").strip():
        new_picksly = picksly_from_source(source)
    if not (item.get("img") or "").strip():
        new_img = image_from_source(source)
    return index, new_picksly, new_img


def main():
    with open(DB_PATH, "r", encoding="utf-8") as f:
        db = json.load(f)

    targets = [(i, item) for i, item in enumerate(db) if (item.get("kakobuy") or "").strip() and
               (not (item.get("picksly") or "").strip() or not (item.get("img") or "").strip())]

    updated_picksly = 0
    updated_img = 0

    with concurrent.futures.ThreadPoolExecutor(max_workers=24) as executor:
        for index, new_picksly, new_img in executor.map(enrich_one, targets):
            if new_picksly:
                db[index]["picksly"] = new_picksly
                updated_picksly += 1
            if new_img:
                db[index]["img"] = new_img
                updated_img += 1

    with open(DB_PATH, "w", encoding="utf-8") as f:
        json.dump(db, f, indent=4, ensure_ascii=False)

    missing_picksly = sum(1 for item in db if (item.get("kakobuy") or "").strip() and not (item.get("picksly") or "").strip())
    missing_img = sum(1 for item in db if (item.get("kakobuy") or "").strip() and not (item.get("img") or "").strip())

    print("targets", len(targets))
    print("updated_picksly", updated_picksly)
    print("updated_img", updated_img)
    print("missing_picksly", missing_picksly)
    print("missing_img", missing_img)


if __name__ == "__main__":
    main()
