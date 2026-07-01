import sys, io, json, re, requests
from urllib.parse import urlparse, parse_qs, unquote
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

SESSION = requests.Session()
SESSION.headers.update({'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'})

with open('C:/Users/kevin/Desktop/site/products.json', 'r', encoding='utf-8') as f:
    products = json.load(f)

no_img = [(i, p) for i, p in enumerate(products) if not p.get('img', '').startswith('http')]
print(f"Products without images: {len(no_img)}")

def resolve_and_fetch(idx, p):
    kakobuy = p.get('kakobuy', '')
    clean_url = re.sub(r'[?&]affcode=\w+', '', kakobuy)

    # Step 1: Resolve short URL to get source URL
    source_url = None
    platform = None
    item_id = None

    try:
        r = SESSION.head(clean_url, allow_redirects=True, timeout=12)
        full_url = r.url
    except:
        try:
            r = SESSION.get(clean_url, allow_redirects=True, timeout=12)
            full_url = r.url
        except:
            return idx, None, None, None

    if full_url == 'https://www.kakobuy.com/' or full_url == 'https://www.kakobuy.com':
        return idx, None, None, None

    qs = parse_qs(urlparse(full_url).query)
    raw = qs.get('url', [None])[0]
    if raw:
        raw = unquote(raw)
        source_url = raw
        if 'weidian.com' in raw:
            m = re.search(r'itemID=(\d+)', raw)
            if m: platform, item_id = 'WD', m.group(1)
        elif 'taobao.com' in raw:
            m = re.search(r'id=(\d+)', raw)
            if m: platform, item_id = 'TB', m.group(1)
        elif '1688.com' in raw:
            m = re.search(r'offer/(\d+)', raw)
            if m: platform, item_id = 'AL', m.group(1)

    # Step 2: Build picksly link
    picksly = None
    if platform and item_id:
        picksly = f'https://picks.ly/item/{platform}{item_id}'

    # Step 3: Fetch image from source
    img = None
    if source_url:
        try:
            r2 = SESSION.get(source_url, timeout=12)
            html = r2.text

            if 'weidian.com' in source_url:
                # Weidian: get 750x750 image
                imgs = re.findall(r'(https://si\.geilicdn\.com/[^"\'<>\s]+\.(?:jpg|png|jpeg)\.webp\?w=750[^"\'<>\s]*)', html)
                if imgs:
                    img = imgs[0].replace('&amp;', '&')
                else:
                    # Fallback: any geilicdn product image
                    imgs = re.findall(r'(https://si\.geilicdn\.com/(?:wdseller|pcitem|weidian)[^"\'<>\s]+_\d+_\d+\.(?:jpg|png|jpeg)[^"\'<>\s]*)', html)
                    if imgs:
                        img = imgs[0].replace('&amp;', '&')

            elif 'taobao.com' in source_url:
                # Taobao: try to find image in any format
                imgs = re.findall(r'(https?://(?:img|gw)\.alicdn\.com/[^"\'<>\s]+\.(?:jpg|png|webp))', html)
                if imgs:
                    img = imgs[0]
                else:
                    imgs = re.findall(r'(https?://[^"\'<>\s]+alicdn[^"\'<>\s]+\.(?:jpg|png|webp))', html)
                    if imgs:
                        img = imgs[0]

            elif '1688.com' in source_url:
                imgs = re.findall(r'(https://cbu01\.alicdn\.com/[^"\'<>\s]+\.(?:jpg|png|webp))', html)
                if imgs:
                    img = imgs[0]
        except:
            pass

    return idx, picksly, img, (platform or 'unknown')

# Process all in parallel
print("Resolving and fetching images...")
results = {}
platform_counts = {'WD': 0, 'TB': 0, 'AL': 0, 'unknown': 0}
img_count = 0
picksly_count = 0

with ThreadPoolExecutor(max_workers=20) as ex:
    futures = {ex.submit(resolve_and_fetch, i, p): i for i, p in no_img}
    done = 0
    for f in as_completed(futures):
        done += 1
        idx, picksly, img, platform = f.result()

        if picksly and products[idx].get('picksly', '#') == '#':
            products[idx]['picksly'] = picksly
            picksly_count += 1

        if img:
            products[idx]['img'] = img
            img_count += 1

        if platform:
            platform_counts[platform] = platform_counts.get(platform, 0) + 1

        if done % 50 == 0:
            print(f"  {done}/{len(no_img)} processed | images: {img_count} | picksly fixed: {picksly_count}")

print(f"\nDone! Images found: {img_count}")
print(f"Picksly links fixed: {picksly_count}")
print(f"Platforms: {platform_counts}")

total_img = sum(1 for p in products if p.get('img', '').startswith('http'))
total_picksly = sum(1 for p in products if p.get('picksly', '#') != '#')
print(f"\nTotal with images: {total_img}/{len(products)}")
print(f"Total with picksly: {total_picksly}/{len(products)}")

with open('C:/Users/kevin/Desktop/site/products.json', 'w', encoding='utf-8') as f:
    json.dump(products, f, indent=2, ensure_ascii=False)
print("Saved!")
