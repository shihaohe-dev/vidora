# Panduan Pemasangan - Vidora (versi keamanan tahap 1)

Paket ini berisi seluruh perbaikan hasil audit. Fitur yang sudah berjalan (beranda, pencarian, kategori, pemutar, admin, sitemap, SEO `/v/...`, iklan VAST) tetap ada. Urutan di bawah dibuat supaya situs tidak mati di tengah jalan.

## 0. Yang berubah (ringkas)

| Temuan audit | Perbaikan |
|---|---|
| #1 tayangan bisa dimanipulasi | `/api/view`: dedupe per video/pengunjung/hari + batas laju di server. RPC lama dicabut di `02_lockdown.sql` |
| #2, #3 spam laporan | `/api/report`: batas laju (5/jam/pengunjung, 40/jam situs), Turnstile opsional, cek origin, ukuran dibatasi, duplikat diabaikan. Insert langsung dari anon ditutup di `02_lockdown.sql` |
| #4 janji "segera disembunyikan" | Laporan *anak di bawah umur / tanpa persetujuan* memberi notifikasi Telegram (opsional) dan otomatis menyembunyikan video setelah >= `AUTOHIDE_THRESHOLD` pelapor berbeda (default 2). Teks halaman diselaraskan |
| #5, #6 bukti dan jejak audit | Snapshot judul/URL di laporan, `created_by`, `updated_at`, `handled_by/at`, catatan penanganan |
| #7 validasi data | CHECK di database (https, panjang judul/deskripsi/tag, `content_source` tidak kosong) |
| #8 embed | `sandbox` pada iframe + daftar domain `EMBED_ALLOW` + hanya https |
| #9, #10 kebocoran kolom dan hardening | Anon hanya boleh membaca kolom publik; `search_path` fungsi diperketat; hak EXECUTE dibatasi |
| #11 email admin dan robots | Email dihapus dari `schema.sql`; `Disallow: /admin` dihapus (noindex tetap) |
| #12 esm.sh | Dukungan salinan lokal `js/vendor/supabase.js` (skrip `tools/vendor-supabase.sh`) |
| #13-#15 header | `_headers` diperluas, CSP mode **Report-Only**, header yang sama dipasang di respons Function (`functions/_lib/common.js`) |
| #16-#18 fungsi `/v` dan sitemap | Perbaikan `String.replace`, canonical dinormalisasi, ID dicek ketat, nama env `SUPABASE_ANON_KEY` |
| #19-#25 iklan | Hanya https, tombol "Pelajari lebih lanjut" (tidak klik di mana saja), batas macet/durasi, kunci play ganda, iklan diputar langsung di gestur klik bila VAST sudah siap, makro VAST, error pixel, batas frekuensi opsional |
| #26, #27 kebijakan | `privacy.html`, `terms.html`, `report.html` ditulis ulang (pihak ketiga, penyimpanan lokal, retensi, SLA, hak cipta) |

Tidak diubah (disengaja): #28 age gate tetap berupa pernyataan (bukan verifikasi identitas); #29 beban acak beranda (perlu RPC baru, risiko rendah).

## 1. Persiapan

1. **Backup database**: Supabase > Project Settings > Database > Backups (atau ekspor tabel `site_videos`, `site_categories`, `site_reports`).
2. Ambil **service_role key**: Supabase > Project Settings > API > `service_role` (rahasia). **Jangan** ditaruh di kode atau GitHub.
3. Siapkan string acak panjang untuk `HASH_SALT` (mis. 40 karakter).
4. (Opsional) Turnstile: Cloudflare Dashboard > Turnstile > Add widget, isi domain situs. Catat **Site Key** dan **Secret Key**.
5. (Opsional) Notifikasi Telegram: buat bot lewat @BotFather (dapat token), kirim pesan ke bot, lalu ambil `chat_id` Anda (mis. lewat @userinfobot).

## 2. Edit konfigurasi di kode (`js/config.js`)

- `OPERATOR_NAME`: nama pengelola situs (tampil di Syarat dan Privasi).
- `CONTACT_EMAIL`: pastikan benar.
- `TURNSTILE_SITE_KEY`: isi Site Key bila memakai Turnstile.
- `EMBED_ALLOW`: daftar domain embed yang diizinkan, mis. `["drive.google.com"]`. Kosong = semua https boleh (kurang aman). Lihat domain yang sedang dipakai dengan query di bagian 7.
- `AD_FREQ_CAP_MIN`: 0 = iklan di setiap video (perilaku lama).
- Ubah juga `robots.txt` (alamat sitemap) bila domain Anda berbeda.

## 3. Isi variabel di Cloudflare

Cloudflare Dashboard > Workers & Pages > proyek Vidora > Settings > Variables and Secrets. Tambahkan (tipe **Secret** untuk yang rahasia), pada Production (dan Preview bila dipakai):

| Nama | Wajib | Isi |
|---|---|---|
| `SUPABASE_SERVICE_KEY` | Ya | service_role key (Secret) |
| `HASH_SALT` | Ya | string acak panjang (Secret) |
| `TURNSTILE_SECRET` | Bila Turnstile | Secret Key Turnstile |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Opsional | notifikasi laporan |
| `AUTOHIDE_THRESHOLD` | Opsional | jumlah pelapor berbeda untuk auto-sembunyikan (default 2; 1 = langsung) |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Opsional | hanya bila ingin menimpa nilai bawaan. Isi **anon**, bukan service_role |

## 4. Deploy lalu jalankan SQL (urutan penting)

1. Ganti isi repository dengan isi ZIP ini (jangan hapus folder `.git`), commit, push. Tunggu deploy Cloudflare Pages selesai.
2. **Segera** setelah deploy, di Supabase > SQL Editor jalankan `supabase-sql/01_hardening.sql` (aman, hanya menambah). Pastikan `schema.sql`, `thumb_time.sql`, `aspect.sql` sudah pernah dijalankan.
3. **Uji** (bagian 6, tes A-D).
4. Setelah semua lulus, jalankan `supabase-sql/02_lockdown.sql`. Ini menutup jalur lama (insert laporan langsung, RPC tayangan lama, kolom internal).
5. Uji ulang (bagian 6, tes E-G). Bila ada masalah: jalankan `supabase-sql/03_rollback_lockdown.sql`.

## 5. Langkah lanjutan

- **Salinan lokal supabase-js** (menghilangkan esm.sh): di komputer dengan Node.js, dari folder proyek jalankan `bash tools/vendor-supabase.sh`, commit `js/vendor/supabase.js`, deploy. Setelah berjalan, hapus `https://esm.sh` dari `script-src` di `_headers` **dan** di `functions/_lib/common.js` (konstanta `CSP`).
- **CSP**: saat ini mode Report-Only (tidak memblokir apa pun). Buka beranda, halaman video (video langsung, embed, dan iklan), halaman laporan, dan admin dengan DevTools Console terbuka; bila tidak ada pelanggaran yang tidak diharapkan selama beberapa hari, ganti nama header `Content-Security-Policy-Report-Only` menjadi `Content-Security-Policy` di `_headers` **dan** di `functions/_lib/common.js` (nama header `content-security-policy-report-only` di `functions/v/[[path]].js`). `connect-src https:` sengaja luas karena domain wrapper VAST tidak dapat diketahui sebelumnya; persempit bila sudah terdata.
- **Pengaturan Supabase** (tidak bisa diatur dari kode): Authentication > Providers/Email: **matikan "Allow new users to sign up"** (admin dibuat manual), aktifkan MFA untuk admin bila tersedia, gunakan password kuat. Authentication > Rate Limits: biarkan default atau perketat.
- Pasang admin: setelah membuat user, jalankan baris `insert into site_admins ...` di dasar `schema.sql` dengan email Anda.

## 6. Daftar uji

A. **Halaman publik**: beranda, kategori, pencarian, buka video langsung dan video embed (tampil dan berputar).
B. **Tayangan**: putar video, angka bertambah 1; muat ulang dan putar lagi: tidak bertambah. Di DevTools > Network ada `POST /api/view` status 200.
C. **Laporan**: kirim laporan biasa (`/report`), berhasil; kirim 6 kali berturut-turut, laporan ke-6 ditolak (429). Laporan muncul di `/admin` > Laporan. Bila Telegram aktif, pesan masuk.
D. **Auto-hide**: dari dua perangkat/jaringan berbeda laporkan video uji dengan alasan "di bawah 18": video otomatis menjadi hidden.
E. **Setelah lockdown, akses langsung ditolak** (ganti `URL` dan `ANON` dengan milik Anda):
   - `curl -X POST "$URL/rest/v1/site_reports" -H "apikey: $ANON" -H "Content-Type: application/json" -d '{"reason":"other"}'` harus gagal (401/403).
   - `curl -X POST "$URL/rest/v1/rpc/site_add_view" -H "apikey: $ANON" -H "Content-Type: application/json" -d '{"vid":"<uuid>"}'` harus gagal.
   - `curl "$URL/rest/v1/site_videos?select=content_source" -H "apikey: $ANON"` harus gagal; `select=title` tetap berhasil.
F. **Admin**: login, tambah/edit video, sembunyikan, hapus, kategori, tutup laporan (muncul kotak catatan). Pastikan video baru berstatus `created_by` terisi.
G. **Header**: `curl -I https://domain/`, `curl -I https://domain/v/<slug>-<id>`, `curl -I https://domain/sitemap.xml` harus memuat `x-frame-options: DENY`, `x-content-type-options: nosniff`, `strict-transport-security`, dan `content-security-policy-report-only` (kecuali sitemap).
H. **Iklan**: uji (1) VAST kosong/error (video tetap jalan), (2) iklan normal (impression, skip, tombol Pelajari), (3) tekan play dua kali cepat (konten tidak berbunyi di bawah iklan), (4) **iPhone Safari dan Android Chrome**, (5) koneksi lambat. Periksa juga di panel Hilltop bahwa impression tercatat. Kebijakan Hilltop tentang format klik perlu Anda cek sendiri.

## 7. Query berguna (SQL Editor)

```sql
-- domain embed yang sedang dipakai (untuk mengisi EMBED_ALLOW)
select substring(video_url from '://([^/]+)') as host, count(*) from site_videos
where source_type='embed' group by 1 order by 2 desc;
-- data lama yang tidak memenuhi aturan https
select id, title, video_url from site_videos where video_url !~* '^https://[^[:space:]]+$';
```

## 8. Catatan penting

- File `README.md`, `PANDUAN_PEMASANGAN.md`, `supabase-sql/` dan `tools/` ikut terdeploy dan dapat dibaca publik (tidak berisi rahasia). Jangan pernah menaruh service_role key di repository.
- Kunci **anon** di `config.js` memang publik; keamanan bertumpu pada RLS dan grant yang diperketat oleh paket ini.
- Auto-hide dapat disalahgunakan bila penyerang memakai banyak IP; Turnstile dan batas laju mengurangi risiko, dan admin dapat menayangkan kembali video lewat tab Video.
- Retensi laporan (12 bulan) dan target waktu penanganan (24 jam / 7 hari) di halaman privasi dan syarat adalah nilai bawaan: sesuaikan dengan kemampuan Anda dan konsultasikan teks hukum (termasuk aturan hukum yurisdiksi Anda, ketentuan Cloudflare, dan Hilltop) dengan ahli hukum.
- Untuk kasus konten anak di bawah umur, jangan menyalin atau menyimpan kontennya; sembunyikan video, simpan metadata (sudah otomatis dalam laporan), dan ikuti arahan penasihat hukum untuk pelaporan ke pihak berwenang.
