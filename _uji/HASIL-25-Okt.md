# HASIL UJI RDI-STO — 25 Okt 2026

## A. Smoke UI lokal dengan backend dimocket — GATE 10/10
Server lokal (with_server.py) + backend dimock via Playwright route. Alur: login →
tambah gudang → aktifkan → Mulai STO → isi fisik → Selesai (saveSession) → Export
PDF (unduhan sungguhan) → Riwayat. Nol trafik nyata.
Skrip: `smoke.py` · Screenshot `t01–t07·png` + `smoke-export.pdf`.

## B. Uji terpadu UI ↔ backend ASLI (Form STO WH) — GATE PASS
URL backend: `https://script.google.com/macros/s/AKfycbx...rt-/exec`

| # | Aksi (semua percobaan GAGAL-tertolak, baca-saja) | Balasan backend |
|---|---|---|
| 1 | `login` username/password salah | `{ok:false, error:"Username atau password salah"}` |
| 2 | `getTemplate` token salah | `{ok:false, error:"Sesi habis atau belum login. Silakan login kembali."}` |
| 3 | `getMaster` token salah | sama di atas |
| 4 | `listAccounts` token salah | sama di atas |

Layar UI memunculkan pesan server persis: **"Username atau password salah"**,
overlay login tetap tampil, 0 pageerror — bukti tautan app↔backend utuh.
Skrip: `uji-backend-nyata.mjs` (protocol) + `integrasi.py` (UI). Screenshot `t08`.

## C. Tidak ada penulisan (diperiksa dua kali)
`_Sessions` tetap **40** baris, `_Tokens` tetap **1** — sebelum & sesudah semua uji.

## D. Peta backend (baca-saja, Spreadsheet `Form STO WH`)
| Tab | Isi |
|---|---|
| `Flammable` | 65 baris master material (Material Code, Name, Spesifikasi, Tanggal Kedatangan, Batch) |
| `_Users` | 1 akun `admin` — password sakti: `passwordHash` + `salt` |
| `_Sessions` | 40 baris riwayat STO (Juli 2026, PT Rayard, Bay 7) |
| `_Tokens` | 1 token aktif |

## E. Belum diuji (butuh password asli `admin`)
Login penuh dengan kredensial nyata: akan **menambah 1 baris `token`** di `_Tokens`
(append kecil, tulis ke prod). Saran: cukup dilakukan di HP sendiri pada pemakaian
normal; atau user pancing terpisah kalau ingin agent menguji dengan kredensial.

## Catatan minor
- Restart server lokal berulang kurangi zombie listener: cek `netstat` untuk stam
  `python.exe` LISTENING port 89xx dan bunuh sebelum pakai port baru.
- CSP halaman ketat (tanpa `unsafe-eval`) → uji jangan pakai `wait_for_function("string")`.

## Perbaikan 26 Okt 2026
- **`frame-ancestors 'none'` dihapus dari meta CSP** (line 12 index.html).
  Sumber: MDN "CSP: frame-ancestors" — "*this directive is not supported in the
  `<meta>` element*" (header-only, CSP v3), browser biasanya mengabaikannya dan
  mencetak **console error tiap pemuatan**.
- Verifikasi pasca-perbaikan: rerun `smoke.py` → **GATE 10/10** dan
  `=== CONSOLE ERROR ===` **kosong** (termasuk peringatan SW sebab sekarang
  berjalan via http). Perilaku halaman tidak berubah — direktif itu memang tak
  pernah diterapkan oleh meta. Jika suatu saat dihosting dengan kontrol header
  (bukan GitHub Pages statis), `frame-ancestors 'none'` boleh ditambahkan lewat
  header HTTP sungguhan sebagai hardening tambahan.
