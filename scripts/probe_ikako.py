from playwright.sync_api import sync_playwright
import re

links = [
    "https://ikako.vip/pqzqh",
    "https://ikako.vip/n42vr",
    "https://ikako.vip/fbtra",
]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(user_agent="Mozilla/5.0")
    page = context.new_page()
    for url in links:
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=12000)
            page.wait_for_timeout(2500)
            html = page.content()
            urls = re.findall(r"https?://[^\s\"'<>]+", html)
            gei = [u for u in urls if "si.geilicdn.com" in u]
            print("URL", url)
            print("FINAL", page.url)
            print("GEI", gei[:5])
        except Exception as e:
            print("URL", url, "ERR", str(e)[:140])
    context.close()
    browser.close()
