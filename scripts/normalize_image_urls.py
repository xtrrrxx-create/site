import html
import json
import re

DB_PATH = "products.json"


def clean_img_url(url: str) -> str:
    u = (url or "").strip()
    if not u.startswith("http"):
        return u

    # Decode HTML entities like &amp;
    u = html.unescape(u)

    # Remove tiny thumbnail query params that produce blurry images
    u = re.sub(r"\?(?:w|h|cp|x-oss-process)=[^#]*$", "", u, flags=re.I)
    u = re.sub(r"&(?:w|h|cp|x-oss-process)=[^&]*", "", u, flags=re.I)
    u = re.sub(r"\?$", "", u)

    # If it still contains a query string, keep base URL for full quality
    if "?" in u:
        u = u.split("?", 1)[0]

    # Prefer original asset extension over transformed *.jpg.webp URLs
    u = re.sub(r"\.(jpg|jpeg|png|gif)\.webp$", r".\1", u, flags=re.I)

    return u


def main():
    with open(DB_PATH, "r", encoding="utf-8") as f:
        db = json.load(f)

    changed = 0
    for item in db:
        old = item.get("img", "")
        new = clean_img_url(old)
        if new != old:
            item["img"] = new
            changed += 1

    with open(DB_PATH, "w", encoding="utf-8") as f:
        json.dump(db, f, indent=4, ensure_ascii=False)

    print("normalized_images", changed)


if __name__ == "__main__":
    main()
