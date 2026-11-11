-- ============================================================================
-- Vidora - 02_lockdown.sql  (PENGUNCIAN)
-- Jalankan HANYA SETELAH: (a) kode baru ter-deploy, (b) variabel SUPABASE_SERVICE_KEY
-- sudah diisi di Cloudflare, (c) /api/report dan /api/view sudah Anda uji berhasil.
-- Bila ada masalah: jalankan 03_rollback_lockdown.sql.
-- ============================================================================

-- 1) Pengunjung tidak lagi boleh menulis laporan langsung ke REST (harus lewat /api/report)
drop policy if exists rep_insert on public.site_reports;
revoke all on public.site_reports from anon;

-- 2) Pengunjung tidak lagi boleh memanggil penghitung tayangan lama (harus lewat /api/view)
revoke execute on function public.site_add_view(uuid) from public, anon, authenticated;

-- 3) Tabel admin tidak perlu terlihat lewat API
revoke all on public.site_admins from anon, authenticated;

-- 4) Anon hanya boleh membaca kolom publik video (content_source & consent_confirmed disembunyikan)
revoke select on public.site_videos from anon;
grant select (id, title, description, video_url, source_type, thumbnail_url, category_id,
              tags, views, status, created_at, thumb_time, aspect) on public.site_videos to anon;
grant select on public.site_videos to authenticated;

-- 5) Defense-in-depth: anon memang tidak boleh menulis (RLS sudah menolak; ini mencabut haknya juga)
revoke insert, update, delete on public.site_videos from anon;
revoke insert, update, delete on public.site_categories from anon;
