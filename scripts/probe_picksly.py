import re
import urllib.request

url = "https://picks.ly/item/TB677093286502"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
html = urllib.request.urlopen(req, timeout=15).read().decode("utf-8", errors="ignore")
print("len", len(html))

og = re.search(r'property="og:image"\s+content="([^"]+)"', html, re.I)
print("og", og.group(1) if og else "none")

all_urls = re.findall(r"https?://[^\\s\"'<>]+", html)
cands = [u for u in all_urls if ("si.geilicdn.com" in u or "img.alicdn.com" in u)]
print("cands", cands[:10])
