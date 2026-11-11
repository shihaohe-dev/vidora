-- ============================================================================
-- Vidora - 01_hardening.sql  (AMAN, hanya menambah; boleh dijalankan ulang)
-- Jalankan di Supabase > SQL Editor SETELAH schema.sql, thumb_time.sql, aspect.sql
-- dan SETELAH kode baru ter-deploy ke Cloudflare Pages (lihat PANDUAN_PEMASANGAN.md).
-- File ini tidak memutus akses lama. Penguncian ada di 02_lockdown.sql.
-- ============================================================================

-- 1) Fungsi lama diperketat: search_path kosong + nama schema eksplisit ---------
create or replace function public.site_is_admin() returns boolean
language sql security definer set search_path = '' stable
as $$ select exists(select 1 from public.site_admins where user_id = auth.uid()) $$;

create or replace function public.site_add_view(vid uuid) returns void
language sql security definer set search_path = ''
as $$ update public.site_videos set views = coalesce(views,0) + 1 where id = vid and status = 'published' $$;

revoke execute on function public.site_is_admin() from public;
grant  execute on function public.site_is_admin() to anon, authenticated;
revoke execute on function public.site_add_view(uuid) from public;
grant  execute on function public.site_add_view(uuid) to anon, authenticated;  -- dicabut di 02_lockdown.sql

-- 2) Jejak audit pada video -------------------------------------------------------
alter table public.site_videos add column if not exists created_by uuid default auth.uid();
alter table public.site_videos add column if not exists updated_at timestamptz default now();

create or replace function public.site_touch() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists site_videos_touch on public.site_videos;
-- hanya saat kolom konten diubah (bukan saat penghitung tayangan naik)
create trigger site_videos_touch
  before update of title, description, video_url, source_type, thumbnail_url, category_id,
                   tags, status, content_source, consent_confirmed, aspect, thumb_time
  on public.site_videos for each row execute function public.site_touch();

-- 3) Validasi data di database (NOT VALID = data lama tidak diperiksa, data baru wajib lolos)
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'site_videos_url_https') then
    alter table public.site_videos add constraint site_videos_url_https
      check (video_url ~* '^https://[^[:space:]]+$' and length(video_url) <= 2000) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'site_videos_thumb_https') then
    alter table public.site_videos add constraint site_videos_thumb_https
      check (thumbnail_url is null or thumbnail_url = '' or (thumbnail_url ~* '^https://[^[:space:]]+$' and length(thumbnail_url) <= 2000)) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'site_videos_title_len') then
    alter table public.site_videos add constraint site_videos_title_len
      check (length(btrim(title)) between 1 and 150) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'site_videos_desc_len') then
    alter table public.site_videos add constraint site_videos_desc_len
      check (description is null or length(description) <= 1000) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'site_videos_tags_len') then
    alter table public.site_videos add constraint site_videos_tags_len
      check (tags is null or coalesce(cardinality(tags), 0) <= 20) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'site_videos_source_len') then
    alter table public.site_videos add constraint site_videos_source_len
      check (length(btrim(content_source)) between 1 and 300) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'site_categories_len') then
    alter table public.site_categories add constraint site_categories_len
      check (length(btrim(name)) between 1 and 40 and length(slug) <= 60) not valid;
  end if;
end $$;

-- 4) Laporan: kolom tambahan (snapshot, jejak penanganan) -------------------------------
alter table public.site_reports add column if not exists video_title  text;
alter table public.site_reports add column if not exists video_url    text;
alter table public.site_reports add column if not exists ref           text;
alter table public.site_reports add column if not exists visitor_hash  text;
alter table public.site_reports add column if not exists handled_by    uuid;
alter table public.site_reports add column if not exists handled_at    timestamptz;
alter table public.site_reports add column if not exists resolution    text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'site_reports_reason_ok') then
    alter table public.site_reports add constraint site_reports_reason_ok
      check (reason in ('underage','non_consent','copyright','self','other')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'site_reports_len_ok') then
    alter table public.site_reports add constraint site_reports_len_ok
      check ((contact is null or length(contact) <= 200)
         and (ref is null or length(ref) <= 500)
         and (details is null or length(details) <= 2000)
         and (resolution is null or length(resolution) <= 1000)) not valid;
  end if;
end $$;

-- Snapshot judul/URL saat laporan masuk (tetap ada walau video dihapus) + cegah pemalsuan id/waktu
create or replace function public.site_report_prepare() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.id := gen_random_uuid();
  new.created_at := now();
  new.status := 'open';
  new.handled_by := null; new.handled_at := null; new.resolution := null;
  if new.video_id is not null then
    select v.title, v.video_url into new.video_title, new.video_url
      from public.site_videos v where v.id = new.video_id;
  else
    new.video_title := null; new.video_url := null;
  end if;
  return new;
end $$;

drop trigger if exists site_reports_prepare on public.site_reports;
create trigger site_reports_prepare before insert on public.site_reports
  for each row execute function public.site_report_prepare();

-- Policy insert langsung (masa transisi; dihapus di 02_lockdown.sql)
drop policy if exists rep_insert on public.site_reports;
create policy rep_insert on public.site_reports for insert
  with check (status = 'open'
    and reason in ('underage','non_consent','copyright','self','other')
    and length(coalesce(details,'')) <= 2000
    and length(coalesce(contact,'')) <= 200
    and length(coalesce(ref,'')) <= 500);

-- 5) Pembatas laju + penghitung tayangan (hanya dipanggil Cloudflare Function) -----------
create table if not exists public.site_rate_limits (
  k text not null, bucket bigint not null, n int not null default 0, expires_at timestamptz not null,
  primary key (k, bucket));
alter table public.site_rate_limits enable row level security;   -- tanpa policy = tertutup
revoke all on public.site_rate_limits from anon, authenticated;

create table if not exists public.site_view_hits (
  video_id uuid not null references public.site_videos(id) on delete cascade,
  visitor text not null, day date not null default current_date,
  primary key (video_id, visitor, day));
alter table public.site_view_hits enable row level security;
revoke all on public.site_view_hits from anon, authenticated;

create or replace function public.site_rl_hit(p_scope text, p_key text, p_max int, p_window int)
returns boolean language plpgsql security definer set search_path = '' as $$
declare b bigint := floor(extract(epoch from now()) / p_window); c int;
begin
  insert into public.site_rate_limits as t (k, bucket, n, expires_at)
    values (p_scope || ':' || p_key, b, 1, to_timestamp((b + 1) * p_window) + interval '1 hour')
    on conflict (k, bucket) do update set n = t.n + 1
    returning n into c;
  if random() < 0.02 then delete from public.site_rate_limits where expires_at < now(); end if;
  return c <= p_max;
end $$;

create or replace function public.site_add_view_secure(p_vid uuid, p_visitor text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  insert into public.site_view_hits (video_id, visitor)
    select p_vid, p_visitor where exists (select 1 from public.site_videos where id = p_vid and status = 'published')
    on conflict do nothing;
  if found then
    update public.site_videos set views = coalesce(views, 0) + 1 where id = p_vid;
    if random() < 0.01 then delete from public.site_view_hits where day < current_date - 2; end if;
    return true;
  end if;
  return false;
end $$;

create or replace function public.site_submit_report(
  p_video uuid, p_reason text, p_details text, p_contact text, p_ref text, p_visitor text, p_threshold int)
returns json language plpgsql security definer set search_path = '' as $$
declare rid uuid; hidden boolean := false; cnt int; ttl text;
        crit boolean := p_reason in ('underage','non_consent');
begin
  if p_reason not in ('underage','non_consent','copyright','self','other') then
    raise exception 'alasan tidak valid';
  end if;
  if p_video is not null and not exists (select 1 from public.site_videos where id = p_video) then
    p_video := null;   -- id tidak dikenal: simpan sebagai laporan tanpa tautan (tidak membocorkan keberadaan id)
  end if;
  if p_video is not null and exists (
      select 1 from public.site_reports
      where video_id = p_video and visitor_hash = p_visitor and reason = p_reason and status = 'open') then
    return json_build_object('id', null, 'duplicate', true, 'autohidden', false, 'critical', crit);
  end if;
  insert into public.site_reports (video_id, reason, details, contact, ref, visitor_hash)
    values (p_video, p_reason, left(coalesce(p_details, ''), 2000),
            nullif(left(coalesce(p_contact, ''), 200), ''), nullif(left(coalesce(p_ref, ''), 500), ''), p_visitor)
    returning id, video_title into rid, ttl;
  if crit and p_video is not null then
    select count(distinct visitor_hash) into cnt from public.site_reports
      where video_id = p_video and status = 'open' and reason in ('underage','non_consent');
    if cnt >= greatest(coalesce(p_threshold, 2), 1) then
      update public.site_videos set status = 'hidden' where id = p_video and status = 'published';
      hidden := found;
    end if;
  end if;
  return json_build_object('id', rid, 'duplicate', false, 'autohidden', hidden, 'critical', crit, 'title', ttl);
end $$;

-- Hanya service_role (Cloudflare Function) yang boleh memanggil tiga fungsi ini
revoke execute on function public.site_rl_hit(text, text, int, int) from public, anon, authenticated;
revoke execute on function public.site_add_view_secure(uuid, text) from public, anon, authenticated;
revoke execute on function public.site_submit_report(uuid, text, text, text, text, text, int) from public, anon, authenticated;
grant  execute on function public.site_rl_hit(text, text, int, int) to service_role;
grant  execute on function public.site_add_view_secure(uuid, text) to service_role;
grant  execute on function public.site_submit_report(uuid, text, text, text, text, text, int) to service_role;

-- Pemeriksaan data lama yang TIDAK lolos aturan baru (hanya info; boleh dirapikan manual):
--   select id, title, video_url from public.site_videos where video_url !~* '^https://[^[:space:]]+$';
--   select distinct substring(video_url from '://([^/]+)') as host, count(*) from public.site_videos
--     where source_type='embed' group by 1 order by 2 desc;   -- daftar domain embed untuk EMBED_ALLOW
