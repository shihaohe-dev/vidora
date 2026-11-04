import { supabase, $, esc, card, layout, SITE } from './app.js';
layout();
const id = (location.pathname.match(/[0-9a-f-]{36}$/i) || [])[0] || new URLSearchParams(location.search).get('id');
const box = $('#watch');

(async () => {
  const { data: v } = id ? await supabase.from('site_videos').select('*,site_categories(name,slug)').eq('id', id).eq('status', 'published').maybeSingle() : {};
  if (!v) { box.innerHTML = '<div class="empty"><h3>Video tidak tersedia</h3><p>Video ini mungkin sudah dihapus.</p><a class="btn primary" href="/">Ke beranda</a></div>'; return; }
  document.title = `${v.title} - ${SITE}`;
  const ok = /^https?:\/\//i.test(v.video_url);
  const player = !ok ? '' : v.source_type === 'embed'
    ? `<iframe src="${esc(v.video_url)}" allow="autoplay; fullscreen" allowfullscreen referrerpolicy="no-referrer" title="${esc(v.title)}"></iframe>`
    : `<video controls playsinline preload="metadata" ${v.thumbnail_url ? `poster="${esc(v.thumbnail_url)}"` : ''} src="${esc(v.video_url)}"></video>`;
  const c = v.site_categories;
  box.innerHTML = `<div class="player">${player}</div><h1>${esc(v.title)}</h1>` +
    `<div class="meta">${c ? `<a class="chip" href="/?c=${esc(c.slug)}">${esc(c.name)}</a>` : ''}<span>${(v.views || 0).toLocaleString('id-ID')}x ditonton</span></div>` +
    (v.description ? `<p class="desc">${esc(v.description)}</p>` : '') +
    `<div class="actions"><button class="btn" id="share">Bagikan</button><a class="btn" href="/report?v=${v.id}">Laporkan video ini</a></div>`;
  $('#share').onclick = async () => {
    try { navigator.share ? await navigator.share({ title: v.title, url: location.href }) : (await navigator.clipboard.writeText(location.href), $('#share').textContent = 'Link disalin ✓'); } catch {}
  };
  try { if (!sessionStorage.getItem('v' + v.id)) { sessionStorage.setItem('v' + v.id, 1); supabase.rpc('site_add_view', { vid: v.id }); } } catch {}

  let q = supabase.from('site_videos').select('id,title,thumbnail_url,video_url,source_type,views,site_categories(name,slug)').eq('status', 'published').neq('id', v.id).order('created_at', { ascending: false }).limit(8);
  if (v.category_id) q = q.eq('category_id', v.category_id);
  const { data: rel } = await q;
  if (rel?.length) { $('#related').hidden = false; $('#related-grid').innerHTML = rel.map(card).join(''); }
})();
