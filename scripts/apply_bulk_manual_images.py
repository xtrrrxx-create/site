import json
import re

DB_PATH = "products.json"

RAW = """
https://cbu01.alicdn.com/img/ibank/O1CN01sEWWNt29HIDvHnsFC_!!2218972528042-0-cib.jpg
https://img.alicdn.com/imgextra/i1/2216942154536/O1CN01bpHwbH1jNXfOZ9RNR_!!2216942154536.png
https://img.alicdn.com/imgextra/i1/2216942154536/O1CN01eWAVOU1jNXfpnfCgn_!!2216942154536.png
https://img.alicdn.com/bao/uploaded/i1/3297964169/O1CN01JP0VDq1gfSFCP1tOh_!!3297964169.jpg
https://cbu01.alicdn.com/img/ibank/O1CN01miuo0Y2Crsl1oNt7y_!!2219709768528-0-cib.jpg
https://cbu01.alicdn.com/img/ibank/O1CN01mlABAs1o2zygalflh_!!2219741095168-0-cib.jpg
https://si.geilicdn.com/wdseller1845163825-12bb00000190071fdd410a81347d_1080_1080.jpg
https://si.geilicdn.com/wdseller1845163825-7eaa0000019553d90ffd0a23057e_1074_1074.jpg
https://img.alicdn.com/bao/uploaded/i1/2206400253538/O1CN01VZuzoe1c0S8rduQWB_!!2206400253538.jpg
https://cbu01.alicdn.com/img/ibank/O1CN01eyyOuk1taUnPMTueM_!!2216503575918-0-cib.jpg
https://img.alicdn.com/bao/uploaded/i1/1062626882/O1CN01CdvZ8r20i0P5uwFkU_!!1062626882.jpg
https://img.alicdn.com/bao/uploaded/i4/2200689338739/O1CN01WqY1DY2EQW2pCRJXV_!!2200689338739.jpg
https://img.alicdn.com/bao/uploaded/i2/3716464028/O1CN01EWd12e1fcsQNF5zry_!!3716464028.jpg
https://img.alicdn.com/bao/uploaded/i4/224630337/O1CN01QX1hgu1EMOEmsSArQ_!!224630337.jpg
https://img.alicdn.com/bao/uploaded/i2/2206855272711/O1CN01fw4vAW1VtgmoGHNkA_!!2206855272711.jpg
https://img.alicdn.com/bao/uploaded/i1/224630337/O1CN010alMNK1EMOANzqjRC_!!224630337.jpg
https://img.alicdn.com/bao/uploaded/i2/2206855272711/O1CN01jKPFyy1VtgoNsQcbx_!!2206855272711.jpg
https://img.alicdn.com/bao/uploaded/i4/224630337/O1CN01nMdhbE1EMOGxsB0nm_!!224630337.jpg
https://img.alicdn.com/bao/uploaded/i3/2206855272711/O1CN01lrsWtv1VtgoQEUSZ0_!!2206855272711.jpg
https://img.alicdn.com/bao/uploaded/i1/2206855272711/O1CN016qjqsk1VtgmtSxEX7_!!2206855272711.jpg
https://img.alicdn.com/bao/uploaded/i1/2073165527/O1CN01O1ibqJ1qhQ9wbQNjq_!!2073165527.png
https://img.alicdn.com/bao/uploaded/i2/224630337/O1CN01fA9Ycg1EMOILJtHPW_!!224630337.jpg
https://img.alicdn.com/bao/uploaded/i1/224630337/O1CN01kHLD0t1EMO2HxYKBt_!!224630337.jpg
https://img.alicdn.com/bao/uploaded/i4/2201195940100/O1CN012eFFWB1CbqZcEkgLo_!!0-item_pic.jpg
https://img.alicdn.com/bao/uploaded/i1/224630337/O1CN01nV5onM1EMOQhG34Qm_!!224630337.jpg
https://img.alicdn.com/bao/uploaded/i4/224630337/O1CN01EqScQN1EMOA0l7AE5_!!224630337.jpg
https://cbu01.alicdn.com/img/ibank/O1CN011vBiKS2Br8R0jFZJJ_!!2208840498391-0-cib.jpg
https://img.alicdn.com/bao/uploaded/i3/2907383402/O1CN0166QL871b0AURoVs7j_!!2907383402.jpg
https://img.alicdn.com/bao/uploaded/i2/2912275653/O1CN01dcyaTL1rd85k5kmzS_!!2912275653.jpg
https://img.alicdn.com/bao/uploaded/i2/2907383402/O1CN01Oye30s1b0ASfOMyqC_!!2907383402.jpg
https://img.alicdn.com/bao/uploaded/i3/783814701/O1CN01U04GDZ1kb6qdGa7jV_!!783814701.jpg
https://img.alicdn.com/bao/uploaded/i2/2742814422/O1CN01qjBrG61iXKTmnDjgB_!!2742814422.jpg
https://img.alicdn.com/bao/uploaded/i4/2073165527/O1CN01NdZewU1qhQ9vpxacb_!!2073165527.jpg
https://img.alicdn.com/bao/uploaded/i4/2866286580/O1CN01ayW4uk1yThBiUXe7A_!!2866286580.jpg
https://img.alicdn.com/bao/uploaded/i4/2217088571930/O1CN01mDhDYE1Q7zKS0V00C_!!2217088571930.png
https://img.alicdn.com/bao/uploaded/i2/1049492230/O1CN01qj2PYz1SLNyljQNFM_!!1049492230.jpg
https://cbu01.alicdn.com/img/ibank/O1CN01mZoBtb1PoIAgBBJZn_!!2215098051887-0-cib.jpg
https://img.alicdn.com/bao/uploaded/i3/2217088571930/O1CN01bvrmIB1Q7zKQu2YTs_!!2217088571930.png
""".strip()

SKIP_TITLE = "Nike Air Force 1 x Lil Yachty Concrete Boys XP Batch"


def valid_image(url: str) -> bool:
    return bool(re.search(r"^https?://.+\.(jpg|jpeg|png|webp)(\?.*)?$", url, re.I))


def main():
    urls = [u.strip() for u in RAW.splitlines() if u.strip()]
    urls = [u for u in urls if valid_image(u)]

    with open(DB_PATH, "r", encoding="utf-8") as f:
        db = json.load(f)

    missing_idxs = [
        i for i, item in enumerate(db)
        if (item.get("kakobuy") or "").strip()
        and not (item.get("img") or "").strip()
        and item.get("title", "") != SKIP_TITLE
    ]

    n = min(len(urls), len(missing_idxs))
    for i in range(n):
        db[missing_idxs[i]]["img"] = urls[i]

    with open(DB_PATH, "w", encoding="utf-8") as f:
        json.dump(db, f, indent=4, ensure_ascii=False)

    rem = sum(1 for x in db if (x.get("kakobuy") or "").strip() and not (x.get("img") or "").strip())
    print("provided_urls", len(urls))
    print("applied", n)
    print("remaining_missing", rem)


if __name__ == "__main__":
    main()
