import json
import re

DB_PATH = "products.json"


def normalize_title(title: str) -> str:
    t = (title or "").lower()
    t = re.sub(r"\b(best|budget|random|second)\s*batch\b", "", t, flags=re.I)
    t = re.sub(r"\s+", " ", t).strip(" -_")
    return t


def is_good_image(url: str) -> bool:
    if not url or not url.startswith("http"):
        return False
    if "nstatic.kakobuy.com/banner/" in url.lower():
        return False
    if "s.yupoo.com/website/" in url.lower() and "logo_" in url.lower():
        return False
    return True


def main():
    with open(DB_PATH, "r", encoding="utf-8") as f:
        db = json.load(f)

    by_kakobuy = {}
    by_norm_title = {}
    for item in db:
        img = (item.get("img") or "").strip()
        if not is_good_image(img):
            continue
        kk = (item.get("kakobuy") or "").strip()
        nt = normalize_title(item.get("title", ""))
        if kk and kk not in by_kakobuy:
            by_kakobuy[kk] = img
        if nt and nt not in by_norm_title:
            by_norm_title[nt] = img

    filled = 0
    for item in db:
        if is_good_image((item.get("img") or "").strip()):
            continue

        kk = (item.get("kakobuy") or "").strip()
        nt = normalize_title(item.get("title", ""))

        candidate = ""
        if kk and kk in by_kakobuy:
            candidate = by_kakobuy[kk]
        elif nt and nt in by_norm_title:
            candidate = by_norm_title[nt]

        if candidate:
            item["img"] = candidate
            filled += 1

    with open(DB_PATH, "w", encoding="utf-8") as f:
        json.dump(db, f, indent=4, ensure_ascii=False)

    missing = sum(1 for x in db if not is_good_image((x.get("img") or "").strip()))
    print("filled_images", filled)
    print("still_missing_or_invalid", missing)


if __name__ == "__main__":
    main()
