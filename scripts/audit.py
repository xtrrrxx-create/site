import httpx, sys, json
sys.path.insert(0, "C:/Users/kevin/Desktop/site")
from qc_best_photo import analyze_image, score_photo, picksly_to_source, fetch_qc_images, pick_best
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

KEY = "sb_secret_28LDjCJdDK9Pg2LkyL8MVw_VzVS6uqg"
PKEY = "pk_493983c96d5de61e1543134132ae5c0b8151959e"

# Fetch all T-shirts with images
r = httpx.get(
    "https://jcfcyqnuhufmtoxlqknt.supabase.co/rest/v1/products?category=eq.T-shirts&select=id,title,img,picksly&order=id.asc&limit=500",
    headers={"apikey": KEY, "Authorization": f"Bearer {KEY}"},
    timeout=30
)
products = r.json()

# Skip first 40 (user's manual picks)
products = products[40:]

# Analyze current images and find bad ones (score < 14)
client = httpx.Client(follow_redirects=True, timeout=15)
bad_ones = []
checked = 0
for p in products:
    img = p.get("img", "")
    if not img or "alicdn" in img or "kakobuy.com/banner" in img:
        bad_ones.append({"id": p["id"], "title": p["title"][:35], "reason": "no_img", "score": -99})
        continue
    try:
        resp = client.get(img, timeout=8)
        if resp.status_code != 200 or len(resp.content) < 5000:
            bad_ones.append({"id": p["id"], "title": p["title"][:35], "reason": "broken", "score": -99})
            continue
        a = analyze_image(resp.content)
        s = score_photo(a)
        checked += 1
        if s < 14:
            bad_ones.append({"id": p["id"], "title": p["title"][:35], "reason": f"low_score", "score": round(s,1),
                "g": round(a["green"],2), "cc": round(a["cc"],2), "corner": round(a["corner"],2), "cvar": round(a["cvar"],1)})
    except:
        continue

client.close()
print(f"Checked {checked} images, found {len(bad_ones)} bad ones:")
for b in bad_ones:
    print(f"  #{b['id']} sc={b['score']} ({b['reason']}) | {b['title']}")
