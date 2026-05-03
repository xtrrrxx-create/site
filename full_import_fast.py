# full_import_fast.py - Procesează 1275 produse în 2 minute
import csv
import json
import os
import re
import urllib.parse

DB_FILE = "products.json"
USD_TO_CNY = 7.3

def clean_price(price_str):
    if not price_str:
        return ""
    match = re.search(r'[\d\.]+', str(price_str))
    if match:
        return str(int(float(match.group()) * USD_TO_CNY))
    return ""

def parse_category(cat_str):
    if not cat_str:
        return "", ""
    
    cat_str = str(cat_str).strip()
    batch = "Random Batch"
    
    if any(x in cat_str.upper() for x in ["1:1", "BEST"]):
        batch = "Best Batch"
    elif "BUDGET" in cat_str.upper():
        batch = "Budget Batch"
    
    base = re.sub(r'\s*/.*|\s+BUDGET|\s+BEST', '', cat_str, flags=re.I).strip().lower()
    
    mapping = {
        'tee': 'T-shirts',
        't-shirt': 'T-shirts',
        'long-sleeve': 'T-shirts',
        'hoodie': 'Hoodies',
        'polo': 'T-shirts',
        'jacket': 'Jackets',
        'shoes': 'Shoes',
    }
    
    return mapping.get(base, 'Other'), batch

def make_links(source_url):
    if not source_url or source_url == 'Link':
        return "", ""
    
    if 'kakobuy.com' in source_url or 'ikako.vip' in source_url:
        parsed = urllib.parse.urlparse(source_url)
        qs = urllib.parse.parse_qs(parsed.query)
        source = qs.get('url', [''])[0]
        if source:
            source_url = urllib.parse.unquote(source)
    
    kakobuy = f"https://www.kakobuy.com/item/details?url={urllib.parse.quote(source_url, safe='')}&affcode=keviinn"
    
    picksly = ""
    m = re.search(r'itemID=(\d+)', source_url, re.I)
    if m:
        picksly = f"https://picks.ly/item/WD{m.group(1)}"
    else:
        m = re.search(r'[?&]id=(\d+)', source_url, re.I)
        if m:
            picksly = f"https://picks.ly/item/TB{m.group(1)}"
        else:
            m = re.search(r'/offer/(\d+)\.html', source_url, re.I)
            if m:
                picksly = f"https://picks.ly/item/AL{m.group(1)}"
    
    return kakobuy, picksly

def process_file(filepath, db):
    print(f"\n>>> Procesez: {filepath}")
    new_count = 0
    
    with open(filepath, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        
        for i, row in enumerate(reader, 1):
            try:
                brand = row.get('Brand', '').strip()
                category_raw = row.get('Category', '').strip()
                link = row.get('Link', '').strip()
                price_usd = row.get('Price', '').strip()
                
                if not brand or not link or link == 'Link' or not link.startswith('http'):
                    continue
                
                title = f"{brand} {category_raw}".strip()
                
                if any(p.get('title') == title for p in db):
                    continue
                
                price_cny = clean_price(price_usd)
                category, batch = parse_category(category_raw)
                kakobuy, picksly = make_links(link)
                
                product = {
                    "title": title,
                    "price": price_cny,
                    "category": category,
                    "batch": batch,
                    "kakobuy": kakobuy,
                    "picksly": picksly,
                    "img": ""
                }
                
                db.append(product)
                new_count += 1
                
                if i % 100 == 0:
                    print(f"  {i} procesate...")
                    
            except Exception as e:
                continue
    
    print(f"  Adăugate: {new_count} produse")
    return new_count

def main():
    print("=" * 60)
    print("IMPORT RAPID - Conversie USD→CNY + Link-uri")
    print("=" * 60)
    
    db = []
    if os.path.exists(DB_FILE):
        with open(DB_FILE, 'r', encoding='utf-8') as f:
            db = json.load(f)
        print(f"DB existent: {len(db)} produse")
    
    files = [f for f in os.listdir('.') if f.endswith('.csv')]
    print(f"Fișiere găsite: {files}")
    
    if not files:
        print("Nu am găsit CSV-uri!")
        return
    
    total_new = 0
    for file in files:
        if any(x in file.lower() for x in ['shoes', 'tops', 'haine', 'papuci', 'clothes']):
            total_new += process_file(file, db)
            with open(DB_FILE, 'w', encoding='utf-8') as f:
                json.dump(db, f, indent=4, ensure_ascii=False)
            print(f"  Salvat: {len(db)} total")
    
    print("\n" + "=" * 60)
    print(f"✅ GATA: {total_new} produse noi")
    print(f"📊 Total DB: {len(db)}")
    print("\nPentru imagini, rulează după:")
    print("python fill_images_quality.py")
    print("=" * 60)

if __name__ == "__main__":
    main()
