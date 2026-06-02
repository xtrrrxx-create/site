import httpx, sys
sys.path.insert(0, "C:/Users/kevin/Desktop/site")
from qc_best_photo import analyze_image, score_photo

KEY = "sb_secret_28LDjCJdDK9Pg2LkyL8MVw_VzVS6uqg"
r = httpx.get(
    "https://jcfcyqnuhufmtoxlqknt.supabase.co/rest/v1/products?category=eq.T-shirts&select=id,title,img&order=id.asc&limit=40",
    headers={"apikey": KEY, "Authorization": f"Bearer {KEY}"},
    timeout=15
)
products = r.json()
client = httpx.Client(follow_redirects=True, timeout=15)
for p in products[:25]:
    img_url = p.get("img","")
    if not img_url or "alicdn" in img_url or "kakobuy.com/banner" in img_url:
        continue
    try:
        resp = client.get(img_url, timeout=10)
        if resp.status_code != 200 or len(resp.content) < 5000:
            continue
        a = analyze_image(resp.content)
        s = score_photo(a)
        pid = p["id"]
        title = p["title"][:30]
        print(f"#{pid} g={a['green']:.0%} cc={a['cc']:.0%} w={a['w']:.0%} h={a['h']:.0%} tex={a['tex']:.0f} hue={a['hues']} cv={a['cvar']:.0f} cor={a['corner']:.0%} tg={a['topg']:.0%} sc={s:.1f} | {title}")
    except Exception as e:
        print(f"#{p['id']} ERR: {e}")
client.close()
