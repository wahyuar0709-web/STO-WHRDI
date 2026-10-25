"""Uji terpadu UI <-> backend ASLI (baca-saja): ctx login password salah.

Server lokal: with_server.py. TANPA route mock <= panggilan ke script.google.com nyata.
Harapan: overlay login TETAP tampil + pesan persis backend:
'Username atau password salah'. Nol data ditulis (usulan login ditolak server).
"""
from playwright.sync_api import sync_playwright
import json, os, pathlib

BASE = f"http://localhost:{os.environ.get('STO_PORT', '8909')}/"
URL_EXEC = 'https://script.google.com/macros/s/AKfycbxPuFBhzUa_JZFK5yYNPwC2tgHCczYC_nd0oJA0VfUzGMRQUJNCXTQMwUUTwK12Urt-/exec'
OUT = pathlib.Path(r'C:\projec\STO-WHRDI\_uji')
console, errors = [], []

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_context(viewport={'width': 420, 'height': 900}).new_page()
    pg.on('console', lambda m: console.append(f'{m.type}: {m.text[:200]}') if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errors.append(str(e)[:300]))

    pg.goto(BASE, wait_until='load', timeout=30000)
    try:
        pg.wait_for_load_state('networkidle', timeout=10000)
    except Exception:
        pass
    pg.wait_for_selector('#login-overlay', state='visible', timeout=10000)

    # isikan URL backend ASLI
    pg.fill('#login-cloud-url', URL_EXEC)
    pg.locator('#login-overlay button', has_text='Simpan URL').first.click()
    pg.wait_for_timeout(500)

    # login dengan password SALAH -> backend ganjal tanpa menulis apa pun
    pg.fill('#login-username', 'probe-anonim')
    pg.fill('#login-password', 'bukan-password-nyata')
    t0 = pg.inner_text('#toast') or ''
    pg.locator('#login-overlay button:has-text("Masuk")').first.click()

    # pesan server ASLI harus muncul persis di toast (polling biasa, CSP melarang eval-string)
    for _ in range(40):
        pesan = (pg.inner_text('#toast') or '').strip()
        if 'Username atau password salah' in pesan:
            break
        pg.wait_for_timeout(500)
    else:
        raise RuntimeError(f'pesan backend tak muncul di toast; isi: {pesan[:160]!r}')
    masih_overlay = pg.locator('#login-overlay').is_visible()
    pg.screenshot(path=str(OUT / 't08-backend-nyata-tolak.png'), full_page=False)
    b.close()

hasil = {
    'pesan_backend_di_UI': pesan,
    'overlay_login_masih_tampil': masih_overlay,
    'pageerror': errors[:5],
}
print(json.dumps(hasil, ensure_ascii=False, indent=1))
print('GATE:', 'PASS' if (masih_overlay and 'Username atau password salah' in pesan) else 'GAGAL')
