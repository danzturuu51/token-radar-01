# BUILD LOG — token-radar-01 (target: rank 1, $1,000)

Target: bukan sekadar lolos top 10 — bidik peringkat 1. Setiap iterasi dicatat:
apa yang dicoba, hasil cek/gate, apa yang gagal dan kenapa, apa yang diperbaiki.
Keputusan model/desain ditulis alasannya, supaya build berikutnya lebih bagus.

## 0. Setup & riset (17 Nov 2026, ~01:10–01:20 WIB)

- Baca `skill.md` make.fun (v1.5.191), RULES.txt kit (88 KB), competition.yaml,
  starter (main.ts, lib/model.ts, dashboard, vendor/makefun-board.ts), input/README.md.
- Snapshot: 758 protokol, watchlist 40, pre-token 342, pre-token di bawah floor 210.
  Floor $50M. Top watchlist TVL: Steakhouse Financial $2,75B, Gauntlet $1,58B, Veda $1,56B.
- Bounty dipilih: token-radar-01 ($1.325 total; 1st $1.000; deadline 14 Des 2026 10:00 UTC).
  Alasan: hadiah terbesar di antara bounty gratis tanpa akun berbayar; deadline 27 hari;
  syarat hanya Node 22.18+ (mesin ini Node v24.22.1 OK) + browser (Brave 157.1.99.55 OK).
  Ditolak: free-model-aggregator-02 (butuh beli 10 kredit OpenRouter = modal, langgar
  aturan no-capital Putra); makefun-frontend-01 (entry fee $0,50); tiny-chess-01
  (12.070 submission, engine catur 4 KB, saturasi ekstrem).
- Koneksi akun: agent keypair (wallet agen, lihat ~/.makefun/credentials) terhubung ke
  @putra-kmbs (approve Putra 01:16 WIB). API key di ~/.makefun/credentials (30 hari,
  exp 2026-12-16). Referral code: kjcabbnq.
- Credentials file awal ditolak CLI (`is not a makefun credentials file`):
  penyebab: poller parent hanya menulis {key, expires_at}, CLI butuh juga
  {wallet, user_id, handle, saved_at} per key. Perbaikan: rewrite file dengan field
  lengkap (wallet = keypair agen, user_id = agent.id, handle = putra-kmbs).
  Hasil: `node cli/makefun.mjs referrals` jalan, CLI OK.
- GitHub: login terkonfirmasi danzturuu51 (id 222019085) via connector.
- Repo creation GAGAL via connector: `create_repository` -> 403
  "Resource not accessible by integration" — GitHub App tidak bisa membuat repo
  user. Repo token-radar-01 belum ada (search 0 hasil). `gh` tidak login, tidak ada
  git credentials di mesin. BLOKIR: pembuatan repo + push butuh jalur lain
  (parent via browser / Putra buat repo manual di github.com, lalu App install).
  Rencana: build + commit lokal dulu, laporkan blokir persis.
- snapshot-push.md dibaca: push_files connector hanya UTF-8, tanpa binary —
  screenshot PNG/JPEG TIDAK bisa lewat connector. Push penuh (termasuk screenshot)
  butuh git push dengan kredensial, yang tidak ada di mesin ini.

## 1. Keputusan model — "radar-2" (sektor-multiple)

Alasan tidak pakai model starter (flat 0.25x TVL, growth weight 0.5, maturity
0.6–1.0, tanpa pembedaan sektor): pasar nyata menilai TVL beda per sektor
(FDV/TVL DEX/lending jauh di atas stablecoin wrapper / bridge). Model flat
meratakan semua sektor, jadi rankingnya hampir sama dengan ranking TVL mentah —
judge (kriteria 2) menilai model dari seberapa tajam ia turun dari angka snapshot.
Model sektor-multiple lebih defensibel karena setiap faktor punya alasan ekonomi
yang ditulis di dashboard, dan tetap 100% turun dari field snapshot
(tvl_usd, change_7d, listed_at, category, chains) — tidak ada nama yang di-hardcode.

Rumus (ditulis lengkap di dashboard + detail view per row):
  sector  = multiple per kategori (0.08–0.38, lihat lib/model.ts)
  growth  = 1 + clamp(change_7d, -50, 150)/100 * 0.6   (rentang 0.70–1.90)
  maturity= 0.55 + 0.45 * min(age_days, 1460)/1460      (rentang 0.55–1.00)
  breadth = 1 + 0.03 * min(max(chains-1,0), 4)         (rentang 1.00–1.12)
  implied = round(tvl_usd * sector * growth * maturity * breadth), min $1

Alasan tiap faktor:
- sector: FDV/TVL normatif per sektor. Dexs 0.38 tertinggi (fee langsung ke
  pemegang token), Lending/CDP 0.30–0.32, RWA 0.30, Risk Curators 0.28,
  Yield 0.26, Bridge 0.18 (infrastruktur tipis), Liquid Staking 0.16
  (yield diteruskan ke staker), Stablecoin 0.08 (margin paling tipis).
- growth clamp asimetris (-50/+150): upside momentum lebih berarti untuk nilai
  launch daripada downside; weight 0.6 lebih tajam dari starter 0.5.
- maturity 4 tahun (bukan 3): protokol yang bertahan 4 tahun tanpa token punya
  sinyal kelangkaan + rekam jejak lebih kuat; floor 0.55 supaya protokol muda
  dengan TVL besar tidak langsung mati.
- breadth: multi-chain = distribusi + permukaan farming lebih luas; dibatasi +12%
  supaya tidak mendominasi.
- age unknown -> 365 hari (netral, bukan 0).

Board: 240 baris = 40 watchlist + 200 early (pre-token di bawah floor, by TVL).
Alasan 240 (bukan 200 starter): radar yang menemukan lebih banyak protokol
di bawah floor menunjukkan fungsi radar; masih jauh di bawah cap 4.000 dan
board.json tetap < 1 MB.

## 2. Keputusan farm plan (7 langkah, per kategori)

Starter: 6 langkah, hanya langkah 2 yang beda per kategori, sisanya generik.
Kelemahan untuk kriteria 3 judge: langkah generik terbaca sebagai template.
Perbaikan di sini: 7 langkah, langkah 2 DAN 3 spesifik per kategori
(aksi inti + aksi kualifikasi kedua), biaya gas per chain pertama
(Ethereum mahal, L2 murah, Solana ~$0,01), modal per tier TVL
($50/$100/$150/$250), hold days dari umur (muda 60 hari, menengah 45, tua 30),
plus langkah 7 = log + rencana keluar (unwind) + apa yang diwaspadai.
Setiap langkah 20–600 karakter, memuat biaya + waktu konkret.

## 3. Keputusan dashboard (tema gelap "radar")

Starter: terang, hijau sage, tanpa filter chain, tanpa toggle watchlist,
tanpa spotlight top-3. House dashboard #2 = halaman starter — tampil sama
persis dengan starter berarti kalah telak vs referensi itu.
Perbaikan di sini: tema gelap navy + amber (kontras kuat di screenshot,
terlihat beda dari semua dashboard terang), spotlight top-3, filter chain,
toggle watchlist-only, sort 5 kunci, tab pre-token/live, drawer detail dengan
breakdown model yang dihitung ulang di halaman (bukti kode = data),
panel model lengkap dengan tabel multiple sektor, dan disclaimer
"records no token, never has none".
Sumber dashboard dijaga < 64 KB total supaya judge membaca seluruh source
(target ~30 KB: app.js ~20 KB, app.css ~7 KB, index.html ~0,5 KB).

## 4. Iterasi build

### Iterasi 1 — (dalam pengerjaan)
- Menulis lib/model.ts (model radar-2 + farm plan 7 langkah), main.ts, dashboard/.

### Iterasi 1 — hasil (17 Nov 2026, ~18:26–18:37 WIB)
- main.ts run pertama GAGAL sesuai desain: screenshots/ masih kosong (0 gambar)
  -> gate di main.ts menolak lanjut sebelum dossier ditulis. Benar: screenshot
  harus dirender dari output dashboard dulu, baru main.ts final.
- Board pertama: 226 baris (bukan 240 — 210 pre-token di bawah floor dikurangi
  24 yang ter-exclude: CEX + nama berversi), 40/40 watchlist ter-cover,
  7 langkah/row, panjang langkah 144–255 karakter, 226 nilai implied berbeda.
  Top 5: Steakhouse Financial $611.395.668, Gauntlet $366.945.353,
  Veda $347.000.365, USDD $259.959.726, Upshift $126.333.513.
  Dashboard source total 28.013 byte (< 65.536).
- **GAGAL: Brave headless tidak bisa screenshot di VM ini.** Brave 157.1.99.55
  dengan --headless=new maupun --headless=old menggantung > 2 menit bahkan
  untuk `data:text/html,<h1>hi</h1>` (timeout 124), tanpa renderer process.
  Penyebab: bukan halaman saya — Brave sendiri tidak menyelesaikan run headless
  di VM ini (kemungkinan menunggu layanan network/crashpad yang tidak merespons).
  Perbaikan: pakai chrome-headless-shell dari cache Playwright
  (~/.cache/ms-playwright/chromium_headless_shell-1248/...) — screenshot
  trivial selesai < 1 detik. Pelajaran: jangan buang waktu retry Brave;
  headless-shell adalah renderer yang berfungsi di mesin ini.
- Screenshot 1–3 (1440x900, 191.554 / 246.681 / 180.876 byte) dibaca visual:
  board rapi, detail drawer menampilkan breakdown model + 7 langkah farm plan,
  filter Lending menampilkan "14 of 226 ranked". Semua terbaca jelas.
- **Perbaikan kecil:** header menampilkan source snapshot lengkap
  ("DefiLlama https://api.llama.fi/protocols, fetched ...") yang panjang dan
  terpotong. Diubah: tampilkan kata pertama saja ("DefiLlama"). Re-render
  ketiga screenshot dari dashboard yang sudah diperbaiki.
- Determinisme: main.ts dua kali ke dua dir -> `diff -r` byte-identical.
- Self-check gate (/tmp/selfcheck.py): 34/34 PASS — dashboard 3 file/28.013 B,
  board 226 baris, rank 1..226, implied menurun & 226 nilai berbeda,
  40/40 watchlist, farm_steps 7 x 20–600 char, data.js == board.json,
  3 screenshot 1440x900 < 512 KiB, dossier 854.947 byte < 1,5 MiB.
- **False alarm dossier:** rebuild pertama melaporkan MISMATCH 65 byte.
  Akar masalah: buildDossier mengembalikan Uint8Array (bukan string); skrip
  rebuild saya membandingkan panjang byte Uint8Array (854.947) dengan panjang
  string UTF-16 hasil readFileSync utf8 (854.882) — selisih 65 = jumlah karakter
  non-ASCII (—, ×, ·, −) di source dashboard. Isi dossier identik.
  Perbaikan: bandingkan Buffer.equals(). Hasil: byte-identical (854.947 byte).
- **Kit check (tanpa transcripts, sesuai instruksi):**
  Run 1: 3 pass (competition_open, snapshot, entrypoint), 2 fail:
  license_osi (LICENSE tanpa SPDX) + transcripts_present (parent).
  Perbaikan: tambah `SPDX-License-Identifier: MIT` ke LICENSE, commit ulang.
  Run 2: 4 pass, 1 fail (transcripts_present — tugas parent saat bundling).
  5 check "at submission" (repo public/owner/created-after-open/commit
  pushed/duplicate) menunggu repo GitHub dibuat + push.
- README.md ditulis dari readme_template persis (fetch requirements API
  18:35 WIB): 3 badge live dengan owner/repo terisi, deskripsi, run command,
  footer referral kjcabbnq. LICENSE MIT + SPDX.
- Commit lokal: 92e6c08 (build awal), ad4eb14 (LICENSE SPDX).
  HEAD: ad4eb14b69baf21dd7a6044486194ac0823d6430.
- **BLOKIR (tetap): repo GitHub belum ada + belum ter-push.** create_repository
  via connector 403 (GitHub App tidak bisa membuat repo user); tidak ada git
  credentials / gh login di mesin; push_files connector hanya teks UTF-8
  (screenshot biner tidak bisa lewat situ). Yang dibutuhkan: Putra/parent
  buat repo publik danzturuu51/token-radar-01 di github.com (setelah
  2026-11-14T10:00:00Z — otomatis terpenuhi), install GitHub App di repo itu,
  lalu push commit lokal (termasuk 3 PNG) dari mesin dengan kredensial git
  atau lewat jalur lain. JANGAN submit sebelum push + bundle transcripts.
- Tidak ada secret di repo (self-check memindai wallet/API key: bersih).
  API key make.fun tidak pernah dicetak/di-commit.

## 2. Apa yang membuat entry ini lebih kuat dari starter (untuk laporan akhir)

1. **Model:** starter pakai flat 0.25x TVL untuk semua sektor — rankingnya
   hampir sama dengan ranking TVL mentah. radar-2 membedakan sektor
   (Dexs 0.38 s.d. Stablecoins 0.08), clamp growth asimetris (-50/+150,
   weight 0.6), maturity 4 tahun, breadth multi-chain. Top 5 bukan urutan
   TVL mentah (Upshift TVL $499M -> implied $126M karena sektor + umur).
2. **Board:** 226 baris (starter 200) — 186 early finds di bawah floor vs
   160 starter; radar menemukan lebih banyak.
3. **Farm plan:** 7 langkah (starter 6), langkah 2 DAN 3 spesifik per
   kategori (starter hanya langkah 2), gas per chain pertama, modal per
   tier TVL, hold days dari umur, langkah 7 = log + rencana keluar.
4. **Dashboard:** tema gelap (starter terang hijau — house dashboard #2 =
   halaman starter, jadi tampil sama = kalah telak), spotlight top-3,
   filter chain, toggle watchlist-only, 5 kunci sort, tab live-token,
   panel model lengkap + audit line (halaman menghitung ulang semua
   226 implied value dan membuktikan cocok dengan board.json),
   drawer detail dengan "why this rank".
5. **Bukti kesepakatan:** data.js membawa farm_steps persis dari board.json
   (bukan regenerate di halaman) — screenshot detail = board.json.
6. **Verifikasi:** determinisme byte-identical, self-check 34/34,
   kit check 4/4 yang bisa dicek lokal, dossier byte-identical.
