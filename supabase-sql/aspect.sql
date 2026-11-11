-- Jalankan sekali di Supabase > SQL Editor. Menyimpan rasio video (16:9, 9:16, dst) agar pemutar menyesuaikan.
alter table site_videos add column if not exists aspect text not null default '16:9'
  check (aspect in ('16:9','9:16','4:3','3:4','1:1'));
