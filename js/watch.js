import { supabase, $, esc, card, lazyVideos, layout, randomVideos, SITE } from './app.js';
import { initPreroll } from './ads.js';
import { EMBED_ALLOW } from './config.js';
layout();
const id = (location.pathname.match(/[0-9a-f-]{36}$/i) || [])[0] || new URLSearchParams(location.search).get('id');
const box = $('#watch');

(async () => {
  const { data: v } = id ? await supabase.from('site_videos').select('id,title,description,video_url,source_type,thumbnail_url,aspect,views,site_categories(name,slug)').eq('id', id).eq('status', 'published').maybeSingle() : {};
  if (!v) { box.innerHTML = '<div class="empty"><h3>Video tidak tersedia</h3><p>Video ini mungkin sudah dihapus.</p><a class="btn primary" href="/">Ke beranda</a></div>'; return; }
  document.title = `${v.title} - ${SITE}`;
  // Hanya https. Untuk embed, domain harus ada di EMBED_ALLOW (bila daftar diisi).
  const hostOk = u => { try { const h = new URL(u).hostname.toLowerCase(); return !EMBED_ALLOW.length || EMBED_ALLOW.some(d => h === d || h.endsWith('.' + d)); } catch { return false; } };
  const ok = /^https:\/\//i.test(v.video_url) && (v.source_type !== 'embed' || hostOk(v.video_url));
  const player = !ok ? '<div class="empty"><p>Sumber video tidak tersedia.</p></div>' : v.source_type === 'embed'
    ? `<iframe src="${esc(v.video_url)}" allow="autoplay; fullscreen" allowfullscreen sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox allow-forms" referrerpolicy="no-referrer" title="${esc(v.title)}"></iframe>`
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
    // Penghitungan tayangan lewat /api/view (dedupe + batas laju di server). Bila endpoint belum aktif (404/503), pakai RPC lama.
    const bump = () => { if (vSpan) vSpan.textContent = `${((v.views || 0) + 1).toLocaleString('id-ID')}x ditonton`; };
    fetch('/api/view', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ vid: v.id }), keepalive: true })
      .then(async r => {
        if (r.status === 404 || r.status === 503) { const { error } = await supabase.rpc('site_add_view', { vid: v.id }); if (!error) bump(); return; }
        if (r.ok && (await r.json()).counted) bump();
      }).catch(() => {});
  };
  if (vEl) { vEl.addEventListener('play', count, { once: true }); initPreroll(vEl); }
  else if (ok) setTimeout(() => { if (!document.hidden) count(); }, 5000);

  // Video lainnya: acak, berbeda setiap halaman dibuka (video yang sedang ditonton dikecualikan).
  const rel = await randomVideos({ n: 8, excludeId: v.id });
  if (rel?.length) { $('#related').hidden = false; $('#related-grid').innerHTML = rel.map(card).join(''); lazyVideos($('#related-grid')); }
})();
