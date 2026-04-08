import json
import webbrowser

DB_PATH = "products.json"


def is_missing_img(item: dict) -> bool:
    return not (item.get("img") or "").strip()


def main():
    with open(DB_PATH, "r", encoding="utf-8") as f:
        db = json.load(f)

    targets = [i for i, item in enumerate(db) if (item.get("kakobuy") or "").strip() and is_missing_img(item)]
    if not targets:
        print("Nu exista produse fara imagine.")
        return

    print(f"Produse fara imagine: {len(targets)}")
    print("Comenzi: lipesti URL imagine | skip | stop")
    print("-" * 70)

    filled = 0
    skipped = 0

    for pos, idx in enumerate(targets, start=1):
        item = db[idx]
        title = item.get("title", "")
        kakobuy = (item.get("kakobuy") or "").strip()
        picksly = (item.get("picksly") or "").strip()

        print(f"[{pos}/{len(targets)}] {title}")
        print(f"  KakoBuy: {kakobuy}")
        if picksly:
            print(f"  Picksly : {picksly}")

        try:
            # Deschide mai intai picksly (daca exista), apoi kakobuy.
            if picksly:
                webbrowser.open_new_tab(picksly)
            webbrowser.open_new_tab(kakobuy)
        except Exception:
            pass

        while True:
            value = input("Image URL (sau skip/stop): ").strip()
            if not value:
                print("  -> gol, incearca din nou.")
                continue
            if value.lower() == "skip":
                skipped += 1
                break
            if value.lower() == "stop":
                with open(DB_PATH, "w", encoding="utf-8") as f:
                    json.dump(db, f, indent=4, ensure_ascii=False)
                print(f"Oprit. Salvat partial. Filled={filled}, skipped={skipped}")
                return
            if not value.startswith("http://") and not value.startswith("https://"):
                print("  -> URL invalid, trebuie sa inceapa cu http/https.")
                continue

            item["img"] = value
            filled += 1
            break

        # Save progress after each row to avoid losing work.
        with open(DB_PATH, "w", encoding="utf-8") as f:
            json.dump(db, f, indent=4, ensure_ascii=False)

        print()

    print(f"Gata. Filled={filled}, skipped={skipped}")


if __name__ == "__main__":
    main()
