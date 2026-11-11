-- Jalankan di Supabase > SQL Editor. Aman dijalankan ulang. Tabel diberi awalan site_ agar tidak bentrok dengan proyek lain.
create extension if not exists pgcrypto;

create table if not exists site_admins (user_id uuid primary key references auth.users(id) on delete cascade);
create or replace function site_is_admin() returns boolean language sql security definer set search_path=public stable
as $$ select exists(select 1 from site_admins where user_id = auth.uid()) $$;

create table if not exists site_categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null, name text not null, sort int default 0);

create table if not exists site_videos (
  id uuid primary key default gen_random_uuid(),
  title text not null, description text default '',
  video_url text not null,
  source_type text not null default 'direct' check (source_type in ('direct','embed')),
  thumbnail_url text default '',
  category_id uuid references site_categories(id) on delete set null,
  tags text[] default '{}', views int default 0,
  status text not null default 'published' check (status in ('published','hidden')),
  content_source text not null,
  consent_confirmed boolean not null check (consent_confirmed),
  created_at timestamptz default now());
create index if not exists site_videos_idx on site_videos(status, created_at desc);

create table if not exists site_reports (
  id uuid primary key default gen_random_uuid(),
  video_id uuid references site_videos(id) on delete set null,
  reason text not null, details text, contact text,
  status text not null default 'open', created_at timestamptz default now());

alter table site_admins enable row level security;
alter table site_categories enable row level security;
alter table site_videos enable row level security;
alter table site_reports enable row level security;

drop policy if exists cat_read on site_categories;
create policy cat_read on site_categories for select using (true);
drop policy if exists cat_admin on site_categories;
create policy cat_admin on site_categories for all using (site_is_admin()) with check (site_is_admin());

drop policy if exists vid_read on site_videos;
create policy vid_read on site_videos for select using (status='published' or site_is_admin());
drop policy if exists vid_admin on site_videos;
create policy vid_admin on site_videos for all using (site_is_admin()) with check (site_is_admin());

drop policy if exists rep_insert on site_reports;
create policy rep_insert on site_reports for insert with check (status='open' and length(reason)<=100 and length(coalesce(details,''))<=2000);
drop policy if exists rep_admin on site_reports;
create policy rep_admin on site_reports for all using (site_is_admin()) with check (site_is_admin());

create or replace function site_add_view(vid uuid) returns void language sql security definer set search_path=public
as $$ update site_videos set views = views + 1 where id = vid and status='published' $$;
grant execute on function site_add_view(uuid) to anon, authenticated;
grant execute on function site_is_admin() to anon, authenticated;

insert into site_categories(slug,name,sort) values
 ('amatir','Amatir',1),('berdua','Berdua',2),('solo','Solo',3),('asia','Asia',4),('lainnya','Lainnya',9)
on conflict (slug) do nothing;

-- Setelah membuat user di Authentication > Users, jadikan admin (ganti emailnya):
-- insert into site_admins(user_id) select id from auth.users where email='GANTI_DENGAN_EMAIL_ADMIN_ANDA';
