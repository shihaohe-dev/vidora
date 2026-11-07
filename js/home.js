import { supabase, $, esc, card, lazyVideos, layout, randomVideos, SITE, PAGE_SIZE } from './app.js';
layout();
const P = new URLSearchParams(location.search);
const S = { q: (P.get('q') || '').trim().slice(0, 80), c: P.get('c') || '', s: ['latest', 'popular'].includes(P.get('s')) ? P.get('s') : 'rec', p: Math.max(1, parseInt(P.get('p')) || 1) };
const href = (o = {}) => {
  const n = { ...S, ...o }, u = new URLSearchParams();
  if (n.q) u.set('q', n.q); if (n.c) u.set('c', n.c); if (n.s !== 'rec') u.set('s', n.s); if (n.p > 1) u.set('p', n.p);
  const t = u.toString(); return '/' + (t ? '?' + t : '');
};

try { if (localStorage.getItem('welcome') === '1') $('#welcome').remove(); } catch {}
$('#welcome-x')?.addEventListener('click', () => { try { localStorage.setItem('welcome', '1'); } catch {} $('#welcome').remove(); });

(async () => {
  const { data } = await supabase.from('site_categories').select('id,slug,name').order('sort').order('name');
  const cats = data || [];
  $('#chips').innerHTML = `<a class="chip${!S.c ? ' on' : ''}" href="${href({ c: '', p: 1 })}">Semua</a>` +
    cats.map(c => `<a class="chip${S.c === c.slug ? ' on' : ''}" href="${href({ c: c.slug, p: 1 })}">${esc(c.name)}</a>`).join('');
  $('#sort').innerHTML = [['rec', 'Rekomendasi'], ['latest', 'Terbaru'], ['popular', 'Terpopuler']]
    .map(([k, l]) => `<a class="seg-btn${S.s === k ? ' on' : ''}" href="${href({ s: k, p: 1 })}">${l}</a>`).join('');

  const cat = cats.find(c => c.slug === S.c);
  if (cat) document.title = `Video ${cat.name} - ${SITE}`;
  if (S.q || S.p > 1 || (S.c && !cat)) document.head.insertAdjacentHTML('beforeend', '<meta name="robots" content="noindex,follow">');

  let rows = [], total = 0;
  const t = S.q.replace(/[%,()*\\]/g, ' ').trim();
  if (S.s === 'rec') {
    // Rekomendasi: acak baru setiap halaman dibuka/di-refresh, tanpa pagination.
    if (!S.c || cat) { rows = await randomVideos({ n: PAGE_SIZE, catId: cat?.id, q: t }); total = rows.length; }
  } else if (!S.c || cat) {
    let q = supabase.from('site_videos').select('id,title,thumbnail_url,video_url,source_type,thumb_time,views,created_at,site_categories(name,slug)', { count: 'exact' }).eq('status', 'published');
    if (cat) q = q.eq('category_id', cat.id);
    if (t) q = q.or(`title.ilike.%${t}%,description.ilike.%${t}%`);
    q = q.order(S.s === 'popular' ? 'views' : 'created_at', { ascending: false }).range((S.p - 1) * PAGE_SIZE, S.p * PAGE_SIZE - 1);
    const r = await q; rows = r.data || []; total = r.count || 0;
  }

  $('#summary').textContent = S.s === 'rec' ? (total ? 'Pilihan acak untuk Anda — muat ulang halaman untuk video lain' + (cat ? ` di kategori “${cat.name}”` : '') + (S.q ? ` untuk “${S.q}”` : '') : '') : total ? `${total.toLocaleString('id-ID')} video` + (cat ? ` di kategori “${cat.name}”` : '') + (S.q ? ` untuk “${S.q}”` : '') : '';
  $('#grid').innerHTML = rows.length ? rows.map(card).join('') :
    `<div class="empty"><h3>Video tidak ditemukan</h3><p>Coba kata kunci yang lebih singkat atau pilih kategori lain.</p><a class="btn primary" href="/">Lihat semua video</a></div>`;

  lazyVideos($('#grid'));

  const pages = Math.ceil(total / PAGE_SIZE);
  if (pages > 1) {
    const set = [...new Set([1, pages, S.p - 1, S.p, S.p + 1])].filter(n => n >= 1 && n <= pages).sort((a, b) => a - b);
    let h = `<a class="btn${S.p <= 1 ? ' off' : ''}" href="${href({ p: S.p - 1 })}">‹ Sebelumnya</a>`, last = 0;
    for (const n of set) { if (n - last > 1) h += '<span class="gap">…</span>'; h += `<a class="num${n === S.p ? ' on' : ''}" href="${href({ p: n })}">${n}</a>`; last = n; }
    $('#pager').innerHTML = h + `<a class="btn${S.p >= pages ? ' off' : ''}" href="${href({ p: S.p + 1 })}">Berikutnya ›</a>`;
  }
})();
