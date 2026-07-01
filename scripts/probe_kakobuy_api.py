from playwright.sync_api import sync_playwright
import re

url = "https://ikako.vip/pqzqh"
found = []


def extract_from_text(text: str):
    if not text:
        return []
    urls = re.findall(r"https?://[^\s\"'<>]+", text)
    out = []
    for u in urls:
        lu = u.lower()
        if "si.geilicdn.com" in lu or "img.alicdn.com" in lu:
            out.append(u)
    return out


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(user_agent="Mozilla/5.0")
    page = context.new_page()

    def on_response(resp):
        try:
            ctype = (resp.headers or {}).get("content-type", "")
            if "json" in ctype or "text" in ctype or "javascript" in ctype:
                body = resp.text()
                for u in extract_from_text(body):
                    found.append(u)
        except Exception:
            pass

    page.on("response", on_response)
    page.goto(url, wait_until="domcontentloaded", timeout=15000)
    page.wait_for_timeout(5000)
    print("FINAL", page.url)
    print("FOUND", len(found))
    uniq = []
    seen = set()
    for x in found:
        if x not in seen:
            uniq.append(x)
            seen.add(x)
    print("SAMPLE", uniq[:20])

    context.close()
    browser.close()
