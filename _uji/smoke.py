"""Smoke E2E RDI-STO (STO-WHRDI) — 100% lokal + backend dimock.

Server  : python -m http.server 8901 (via with_server.py)
Backend : fetch ke script.google.com DIINTERSEP Playwright route
          -> tidak ada trafik nyata, tidak menyentuh data produksi.
Alur    : login -> tambah gudang -> pilih gudang -> mulai STO ->
          isi stok fisik -> Selesai STO -> riwayat -> export PDF.
"""
from playwright.sync_api import sync_playwright
import json, os, pathlib

BASE = f"http://localhost:{os.environ.get('STO_PORT', '8905')}/"
OUT = pathlib.Path(r'C:\projec\STO-WHRDI\_uji')

MASTER = [
    {'kode': 'MAT-001', 'nama': 'Kayu Jati', 'spesifikasi': '5x10 cm', 'unit': 'PCS',
     'lokasi': 'Rak-1', 'Stok Inventory': 100},
    {'kode': 'MAT-002', 'nama': 'Paku Emerson', 'spesifikasi': '2 inch', 'unit': 'KG',
     'lokasi': 'Rak-2', 'Stok Inventory': 50},
]

steps = []
console, errors = [], []

def tutup_dialog(d):
    try:
        d.accept()
    except Exception:
        pass

def mock_backend(route):
    try:
        payload = json.loads(route.request.post_data or '{}')
    except Exception:
        payload = {}
    aksi = payload.get('action', '')
    balasan = {'ok': True}  # default aman
    if aksi == 'login':
        balasan = {'ok': True, 'token': 'TOKEN-TEST', 'username': 'bullend.gudangA', 'role': 'admin'}
    elif aksi == 'listAccounts':
        balasan = {'ok': True, 'accounts': [{'sheetName': 'Gudang_A'}]}
    elif aksi == 'getMaster':
        balasan = {'ok': True, 'rows': MASTER}
    elif aksi == 'listGroupSessions':
        balasan = {'ok': True, 'sessions': []}
    elif aksi == 'adminListUsers':
        balasan = {'ok': True, 'users': [{'username': 'bullend.gudangA', 'role': 'admin', 'active': True}]}
    print(f'[MOCK] {aksi}')
    route.fulfill(status=200, content_type='application/json', body=json.dumps(balasan))

def langkah(nama, fungsi):
    try:
        fungsi()
        steps.append((nama, 'OK', ''))
        print(f'[OK] {nama}')
    except Exception as e:
        steps.append((nama, 'GAGAL', str(e).splitlines()[0][:180]))
        print(f'[GAGAL] {nama}: {e}')

def klik_teks(pg, teks, harap_terlihat=True):
    loc = pg.locator(f'button:has-text("{teks}")').first
    loc.click(timeout=8000)
    return loc

def klik_teks_terlihat(pg, teks):
    """Klik tombol yang BENAR-BENAR terlihat berikut teks tertentu (abaikan yang tersembunyi)."""
    loc = pg.locator('button:visible', has_text=teks)
    if not loc.count():
        raise RuntimeError(f'tidak ada tombol terlihat "{teks}"')
    loc.first.click()
    return loc.first

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    ctx = b.new_context(viewport={'width': 420, 'height': 900}, accept_downloads=True)
    pg = ctx.new_page()
    pg.on('dialog', tutup_dialog)
    pg.on('console', lambda m: console.append(f'{m.type}: {m.text[:200]}') if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errors.append(str(e)[:300]))
    pg.route('https://script.google.com/**', mock_backend)

    # 1. Buka + login overlay
    def s1():
        pg.goto(BASE, wait_until='load', timeout=30000)
        try:
            pg.wait_for_load_state('networkidle', timeout=10000)
        except Exception:
            pass
        pg.wait_for_selector('#login-overlay', state='visible', timeout=10000)
        pg.screenshot(path=str(OUT / 't01-login.png'), full_page=False)
    langkah('01 layar login tampil', s1)

    # 2. Simpan URL mock
    def s2():
        pg.fill('#login-cloud-url', 'https://script.google.com/macros/d/FAKE123/exec')
        pg.locator('#login-overlay button', has_text='Simpan URL').first.click()
        pg.wait_for_timeout(500)
    langkah('02 simpan cloud URL', s2)

    # 3. Login
    def s3():
        pg.fill('#login-username', 'bullend')
        pg.fill('#login-password', 'test1234')
        pg.locator('#login-overlay button:has-text("Masuk")').first.click()
        pg.wait_for_selector('#login-overlay', state='hidden', timeout=15000)
        pg.screenshot(path=str(OUT / 't02-home.png'), full_page=False)
    langkah('03 login masuk -> home', s3)

    # 4. Kelola Gudang -> tambah gudang baru (modal lokal)
    def s4():
        pg.locator('text="Kelola Gudang"').first.click()
        pg.wait_for_timeout(600)
        pg.screenshot(path=str(OUT / 't03a-halaman-gudang.png'), full_page=False)
        btn = pg.locator('button:visible', has_text='Tambah Gudang').first
        btn.wait_for(state='visible', timeout=8000)
        btn.click()
        pg.wait_for_timeout(500)
        pg.fill('input[placeholder="Contoh: Gudang A"]', 'Gudang A')
        pg.fill('input[placeholder="Contoh: Gudang_A"]', 'Gudang_A')
        pg.screenshot(path=str(OUT / 't03b-modal-gudang.png'), full_page=False)
        for teks_tombol in ['Simpan Gudang', 'Simpan', 'Tambah', 'Buat']:
            try:
                klik_teks_terlihat(pg, teks_tombol)
                break
            except RuntimeError:
                continue
        pg.wait_for_timeout(800)
    langkah('04 tambah gudang (modal)', s4)

    # 5. Aktifkan gudang lalu kembali ke beranda, cak "Belum dipilih" berganti
    def s5():
        gnome = pg.locator('text=Gudang_A')
        if gnome.count():
            gnome.first.click()
            pg.wait_for_timeout(600)
        pg.locator('text=Home').last.click()
        pg.wait_for_timeout(700)
        teks_body = pg.inner_text('body')[:800]
        if 'Belum dipilih' in teks_body:
            raise RuntimeError('gudang aktif masih "Belum dipilih"')
        pg.screenshot(path=str(OUT / 't03c-home-aktif.png'), full_page=False)
    langkah('05 gudang jadi aktif', s5)

    # 6. Mulai STO
    def s6():
        klik_teks(pg, 'Mulai Hitung Stok (STO)')
        pg.wait_for_timeout(500)
        pg.screenshot(path=str(OUT / 't04a-layar-sto.png'), full_page=False)
        klik_teks_terlihat(pg, 'Mulai STO')
        pg.wait_for_selector('#sampling-active-wrap', state='visible', timeout=15000)
        pg.screenshot(path=str(OUT / 't04b-sto-progres.png'), full_page=False)
    langkah('06 mulai STO (master mock 2 item)', s6)

    # 7. Isi stok fisik
    def s7():
        angka = iter([98, 100])
        for el in pg.locator('#sampling-list input').all():
            tipe = (el.get_attribute('type') or 'text')
            if tipe in ('checkbox', 'radio'):
                continue
            el.fill(str(next(angka, 100)))
            pg.wait_for_timeout(120)
        pg.screenshot(path=str(OUT / 't05-fisik-terisi.png'), full_page=False)
    langkah('07 isi stok fisik', s7)

    # 8. Selesai STO
    def s8():
        klik_teks(pg, 'Selesai STO')
        pg.wait_for_timeout(1500)
        pg.screenshot(path=str(OUT / 't06-selesai-sto.png'), full_page=True)
    langkah('08 selesai STO (saveSession dimock)', s8)

    # 9. Export PDF (saat masih di layar STO)
    def s9():
        with pg.expect_download(timeout=15000) as dl:
            pg.locator('button:has-text("Export PDF")').first.click()
        download = dl.value
        nama = download.suggested_filename
        download.save_as(str(OUT / 'smoke-export.pdf'))
        assert nama.lower().endswith('.pdf'), f'nama file: {nama}'
    langkah('09 export PDF terunduh', s9)

    # 10. Riwayat
    def s10():
        pg.locator('text=Riwayat').last.click()
        pg.wait_for_selector('text=Riwayat STO', state='visible', timeout=15000)
        pg.wait_for_timeout(600)
        pg.screenshot(path=str(OUT / 't07-riwayat.png'), full_page=False)
    langkah('10 riwayat (kosong via mock)', s10)

    b.close()

print('\n=== RINGKASAN SMOKE STO-WHRDI ===')
gagal = 0
for nama, hasil, keterangan in steps:
    if hasil == 'GAGAL':
        gagal += 1
    print(f'[{hasil}] {nama}' + (f' -> {keterangan}' if keterangan and hasil == 'GAGAL' else ''))
print(f'\nGATE: {len(steps)-gagal}/{len(steps)} langkah OK, {gagal} gagal')
print('=== CONSOLE ERROR ===')
for c in console[:10]:
    print(c)
print('=== PAGEERROR ===')
for e in errors[:10]:
    print(e)
