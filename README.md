# Vidora (ganti nama di js/config.js)

Situs video dewasa berbasis URL: Cloudflare Pages + Pages Functions + Supabase. Video tidak diunggah, hanya ditautkan.

## Pasang
1. Supabase > SQL Editor: jalankan `supabase-sql/schema.sql` (tabel berawalan `site_`, tidak mengganggu tabel lain).
2. Supabase > Authentication > Users: buat user admin, lalu jalankan baris `insert into site_admins ...` di bagian bawah schema.sql dengan emailnya.
3. Edit `js/config.js`: `SITE` dan `CONTACT_EMAIL`. Edit `robots.txt`: ganti `domain-anda.com`.
4. Push ke GitHub, hubungkan ke Cloudflare Pages (folder `functions/` ikut terdeploy). Settings > Environment variables: `SUPABASE_URL`, `SUPABASE_KEY` (anon key), `SITE_NAME`.
5. Buka `/admin`, tambah kategori dan video.
6. Google Search Console: verifikasi domain, kirim `https://domainanda/sitemap.xml`.

## Tambah video (admin)
Tempel URL: mp4/webm langsung, link embed, atau link Google Drive (otomatis dijadikan embed). Isi asal/lisensi konten dan centang pernyataan 18+/persetujuan; database menolak video tanpa pernyataan itu.

## Alamat
`/` beranda, `/?c=kategori`, `/?q=kata`, `/v/judul-<id>` video, `/report`, `/terms`, `/privacy`, `/admin`.
