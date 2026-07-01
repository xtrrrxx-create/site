import json
import re

DB_PATH = "products.json"

RAW_LINKS = """
https://picks.ly/item/WD4689600987
https://picks.ly/item/AL938021200206
https://picks.ly/item/TB1005533068865
https://picks.ly/item/TB1020001281762
https://picks.ly/item/TB905287602501
https://picks.ly/item/AL999893201747
https://picks.ly/item/AL938512525167
https://picks.ly/item/WD7616832901
https://picks.ly/item/TB751328545164
https://picks.ly/item/AL739432793291
https://picks.ly/item/AL972250196381
https://picks.ly/item/TB644150165079
https://picks.ly/item/TB709333253256
https://picks.ly/item/TB921827772087
https://picks.ly/item/TB677093286502
https://picks.ly/item/TB917834607497
https://picks.ly/item/TB650792815794
https://picks.ly/item/TB747995615714
https://picks.ly/item/TB595534493098
https://picks.ly/item/TB610390155298
https://picks.ly/item/TB662777460912
https://picks.ly/item/TB920509604217
https://picks.ly/item/TB991296880101
https://picks.ly/item/TB602340635839
https://picks.ly/item/TB590675777148
https://picks.ly/item/TB729882277293
https://picks.ly/item/TB794424566397
https://picks.ly/item/TB647981535608
https://picks.ly/item/TB907333245612
https://picks.ly/item/AL906965790989
https://picks.ly/item/TB906860918759
https://picks.ly/item/TB921344987943
https://picks.ly/item/TB947037952550
https://picks.ly/item/TB968396631528
https://picks.ly/item/TB906568683157
https://picks.ly/item/TB971259832594
https://picks.ly/item/TB974034164022
https://picks.ly/item/TB38245295647
https://picks.ly/item/TB645337749335
https://picks.ly/item/TB991895429708
https://picks.ly/item/TB955161816063
https://picks.ly/item/TB965323576578
https://picks.ly/item/TB764921856787
https://picks.ly/item/TB674780446324
https://picks.ly/item/AL740346165005
https://picks.ly/item/TB765036830859
""".strip()


def is_bad_img(url: str) -> bool:
    u = (url or "").strip().lower()
    if not u:
        return True
    bad_tokens = (
        "img.alicdn.com/imgextra/",
        "img.alicdn.com/tfs/",
        "hz_img_",
        "nstatic.kakobuy.com/banner/",
        "og-image.jpg",
    )
    return any(t in u for t in bad_tokens)


def main():
    links = [x.strip() for x in re.findall(r"https://picks\.ly/item/[A-Z0-9]+", RAW_LINKS)]
    seen = set()
    uniq_links = []
    for link in links:
        if link not in seen:
            uniq_links.append(link)
            seen.add(link)

    with open(DB_PATH, "r", encoding="utf-8") as f:
        db = json.load(f)

    # Assign in order to products still missing picksly
    targets = [i for i, x in enumerate(db) if (x.get("kakobuy") or "").strip() and not (x.get("picksly") or "").strip()]
    assign_count = min(len(targets), len(uniq_links))
    for i in range(assign_count):
        db[targets[i]]["picksly"] = uniq_links[i]

    with open(DB_PATH, "w", encoding="utf-8") as f:
        json.dump(db, f, indent=4, ensure_ascii=False)

    remaining_missing_picksly = sum(1 for x in db if (x.get("kakobuy") or "").strip() and not (x.get("picksly") or "").strip())
    remaining_bad_img = sum(1 for x in db if (x.get("kakobuy") or "").strip() and is_bad_img(x.get("img", "")))

    print("provided_links", len(uniq_links))
    print("assigned_picksly", assign_count)
    print("remaining_missing_picksly", remaining_missing_picksly)
    print("remaining_bad_or_missing_img", remaining_bad_img)


if __name__ == "__main__":
    main()
