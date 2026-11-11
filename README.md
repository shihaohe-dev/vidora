# Vidora

Situs video dewasa berbasis URL: Cloudflare Pages + Pages Functions + Supabase. Video tidak diunggah, hanya ditautkan.

**Pemasangan dan pembaruan keamanan: baca [`PANDUAN_PEMASANGAN.md`](PANDUAN_PEMASANGAN.md).**

## Pasang pertama kali
1. Supabase > SQL Editor, jalankan berurutan: `supabase-sql/schema.sql`, `thumb_time.sql`, `aspect.sql`, lalu `01_hardening.sql`; `02_lockdown.sql` setelah semuanya diuji.
2. Authentication > Users: buat user admin dan matikan signup publik; jalankan baris `insert into site_admins ...` di dasar `schema.sql` dengan emailnya.
3. Edit `js/config.js` dan `robots.txt`.
4. Isi variabel Cloudflare (lihat panduan: `SUPABASE_SERVICE_KEY`, `HASH_SALT`, dll.), push ke GitHub, hubungkan ke Cloudflare Pages.
5. Buka `/admin`, tambah kategori dan video.

## Fitur
- Tambah video lewat URL (https): mp4/webm langsung, embed (domain dapat dibatasi), atau Google Drive.
- Thumbnail dari frame video, rasio terdeteksi otomatis.
- Wajib asal/lisensi dan pernyataan 18+/persetujuan; database menolak video tanpa itu.
- Laporan konten lewat `/api/report` (batas laju, Turnstile opsional, auto-hide laporan kritis, notifikasi Telegram opsional).
- Tayangan dihitung lewat `/api/view` (dedupe di server).

## Alamat
`/` beranda, `/?c=kategori`, `/?q=kata`, `/v/judul-<id>`, `/report`, `/terms`, `/privacy`, `/admin`, `/sitemap.xml`, `POST /api/report`, `POST /api/view`.
