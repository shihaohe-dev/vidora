import { supabase, $, esc, card, lazyVideos, layout, SITE } from './app.js';
import { initPreroll } from './ads.js';
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
  const [aw, ah] = String(v.aspect || '16:9').split(':').map(Number);
  const arStyle = aw > 0 && ah > 0 ? `--ar:${aw}/${ah};--arn:${(aw / ah).toFixed(4)}` : '';
  box.innerHTML = `<div class="player" style="${arStyle}">${player}</div><h1>${esc(v.title)}</h1>` +
    `<div class="meta">${c ? `<a class="chip" href="/?c=${esc(c.slug)}">${esc(c.name)}</a>` : ''}<span>${(v.views || 0).toLocaleString('id-ID')}x ditonton</span></div>` +
    (v.description ? `<p class="desc">${esc(v.description)}</p>` : '') +
    `<div class="actions"><button class="btn" id="share">Bagikan</button><a class="btn" href="/report?v=${v.id}">Laporkan video ini</a></div>`;
  $('#share').onclick = async () => {
    try { navigator.share ? await navigator.share({ title: v.title, url: location.href }) : (await navigator.clipboard.writeText(location.href), $('#share').textContent = 'Link disalin ✓'); } catch {}
  };
  // 1 tayangan per video per 24 jam per perangkat. Video langsung: dihitung saat mulai diputar. Embed: setelah 5 detik di halaman.
  const vEl = box.querySelector('video'), vSpan = box.querySelector('.meta span');
  let counted = false;
  const count = () => {
    if (counted) return; counted = true;
    try { const k = 'v:' + v.id; if (Date.now() - (+localStorage.getItem(k) || 0) < 864e5) return; localStorage.setItem(k, Date.now()); } catch {}
    // .then() wajib: pemanggilan Supabase baru dikirim saat di-await/.then (tanpa itu request tidak pernah berjalan)
    supabase.rpc('site_add_view', { vid: v.id }).then(({ error }) => {
      if (error) console.error('site_add_view gagal:', error.message);
      else if (vSpan) vSpan.textContent = `${((v.views || 0) + 1).toLocaleString('id-ID')}x ditonton`;
    });
  };
  if (vEl) { vEl.addEventListener('play', count, { once: true }); initPreroll(vEl); }
  else if (ok) setTimeout(() => { if (!document.hidden) count(); }, 5000);

  let q = supabase.from('site_videos').select('id,title,thumbnail_url,video_url,source_type,thumb_time,views,site_categories(name,slug)').eq('status', 'published').neq('id', v.id).order('created_at', { ascending: false }).limit(8);
  if (v.category_id) q = q.eq('category_id', v.category_id);
  const { data: rel } = await q;
  if (rel?.length) { $('#related').hidden = false; $('#related-grid').innerHTML = rel.map(card).join(''); lazyVideos($('#related-grid')); }
})();
