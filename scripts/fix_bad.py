import httpx, sys, time
from concurrent.futures import ThreadPoolExecutor, as_completed
sys.path.insert(0, "C:/Users/kevin/Desktop/site")
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from qc_best_photo import analyze_image, score_photo, picksly_to_source, fetch_qc_images, pick_best, update_img

KEY = "sb_secret_28LDjCJdDK9Pg2LkyL8MVw_VzVS6uqg"
PKEY = "pk_493983c96d5de61e1543134132ae5c0b8151959e"

BAD_IDS = [796,797,800,803,818,819,823,841,844,845,861,873,881,1209,1211,1213,1404,1418,1428,1434,1436,1441,1443,1445,1448,1456,1457,1471,1483,1497,1498,1500,1586,1614,1649,1778,1779,1793,1797,1808,1817,1827,1838,1843,1848,1873,1874,1875,1880,1881,1883,1885,1886,1887,1890,1896,1901,1906,1908,1924,1928,1949,1951,1954,1956,1960,1967,1968,1970,1971,1973,1991,2002,2004,2005,2010,2024,2025,2027,2029,2034,2042,2052,2056,2057,2058,2060,2063,2064,2065,2066,2071,2072,2073,2074,2075,2077,2079,2082,2083,2086,3669,3675,3716,3734,3780]

# Fetch these products
r = httpx.get(
    f"https://jcfcyqnuhufmtoxlqknt.supabase.co/rest/v1/products?id=in.({','.join(str(i) for i in BAD_IDS)})&select=id,title,img,picksly&order=id.asc",
    headers={"apikey": KEY, "Authorization": f"Bearer {KEY}"},
    timeout=30
)
products = r.json()
print(f"Fetched {len(products)} bad products, re-picking QC photos...\n")

def process(p):
    pid = p["id"]
    title = (p.get("title") or "")[:40]
    picksly = (p.get("picksly") or "").strip()
    if not picksly:
        return f"  #{pid} SKIP no picksly | {title}"
    
    source = picksly_to_source(picksly)
    if not source:
        return f"  #{pid} SKIP bad picksly | {title}"
    
    client = httpx.Client(
        follow_redirects=True,
        headers={"User-Agent": "jarvis-qc/1.0", "X-API-Key": PKEY},
        timeout=15,
    )
    try:
        images = fetch_qc_images(source, client)
        if not images:
            return f"  #{pid} SKIP no QC albums | {title}"
        
        best_url, best_score, a = pick_best(images, client)
        if not best_url:
            return f"  #{pid} SKIP no photos loaded | {title}"
        
        # Use threshold of -5 instead of 2.0 - accept anything reasonable
        current_img = p.get("img", "")
        if best_score < -5:
            return f"  #{pid} SKIP score={best_score:.1f} too bad | {title}"
        
        # Check if new pick is better than current
        if current_img and "alicdn" not in current_img and "kakobuy" not in current_img:
            try:
                cr = client.get(current_img, timeout=8)
                if cr.status_code == 200 and len(cr.content) > 5000:
                    ca = analyze_image(cr.content)
                    cs = score_photo(ca)
                    if cs >= best_score:
                        return f"  #{pid} KEEP current={cs:.1f} >= new={best_score:.1f} | {title}"
            except:
                pass
        
        ok = update_img(pid, best_url)
        info = f"g={a['green']:.0%} cc={a['cc']:.0%} w={a['w']:.0%} h={a['h']:.0%} sc={best_score:.1f}"
        return f"  #{pid} {'OK' if ok else 'FAIL'} {info} | {title}"
    except Exception as e:
        return f"  #{pid} ERR {e} | {title}"
    finally:
        client.close()

t0 = time.time()
ok = 0
with ThreadPoolExecutor(max_workers=50) as pool:
    futs = {pool.submit(process, p): p for p in products}
    for f in as_completed(futs):
        result = f.result()
        print(result)
        if " OK " in result:
            ok += 1

print(f"\nDone {time.time()-t0:.0f}s | Fixed: {ok}/{len(products)}")
