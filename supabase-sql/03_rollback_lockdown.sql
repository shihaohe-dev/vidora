-- Mengembalikan keadaan sebelum 02_lockdown.sql (bila fitur baru bermasalah).
create policy rep_insert on public.site_reports for insert
  with check (status = 'open'
    and reason in ('underage','non_consent','copyright','self','other')
    and length(coalesce(details,'')) <= 2000
    and length(coalesce(contact,'')) <= 200
    and length(coalesce(ref,'')) <= 500);
grant insert on public.site_reports to anon;
grant execute on function public.site_add_view(uuid) to anon, authenticated;
grant select on public.site_videos to anon;
