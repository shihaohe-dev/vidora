-- Jalankan sekali di Supabase > SQL Editor. Menyimpan detik frame yang dipakai sebagai thumbnail (bukan gambar).
alter table site_videos add column if not exists thumb_time numeric check (thumb_time is null or thumb_time >= 0);
