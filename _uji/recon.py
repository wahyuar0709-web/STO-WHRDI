"""Recon STO-WHRDI: buka PWA di browser headless (viewport HP), amati UI + error."""
from playwright.sync_api import sync_playwright
import json, pathlib

URL = 'file:///C:/projec/STO-WHRDI/index.html'
OUT = pathlib.Path(r'C:\projec\STO-WHRDI\_uji')
console, errors = [], []

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_page(viewport={'width': 420, 'height': 900})  # ukuran layar HP
    pg.on('console', lambda m: console.append(f'{m.type}: {m.text[:200]}'))
    pg.on('pageerror', lambda e: errors.append(str(e)[:400]))
    pg.goto(URL, wait_until='load', timeout=60000)
    try:
        pg.wait_for_load_state('networkidle', timeout=20000)
    except Exception:
        pass  # file:// memang tak akan idle sempurna
    pg.screenshot(path=str(OUT / 'recon-phone.png'), full_page=True)

    def teks_aman(loc, maks=25):
        hasil = []
        for el in loc.all()[:maks]:
            try:
                hasil.append((el.text_content() or '').strip()[:60]
                             or el.get_attribute('aria-label') or '<tanpa label>')
            except Exception:
                hasil.append('<elemen tersembunyi>')
        return hasil

    info = {
        'judul': pg.title(),
        'headings': teks_aman(pg.locator('h1,h2,h3'), 15),
        'buttons': teks_aman(pg.locator('button'), 30),
        'input': [f"{el.get_attribute('type') or el.evaluate('e=>e.tagName')}"
                  f"{' | ph: ' + (el.get_attribute('placeholder') or '') if el.get_attribute('placeholder') else ''}"
                  for el in pg.locator('input,select,textarea').all()[:25]],
    }
    print(json.dumps(info, ensure_ascii=False, indent=1))
    print('--- CONSOLE ---')
    for c in console[:20]:
        print(c)
    print('--- PAGEERROR ---')
    for e in errors[:10]:
        print(e)
    b.close()
