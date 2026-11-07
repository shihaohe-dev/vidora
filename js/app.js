import { supabase, SITE, CONTACT_EMAIL, PAGE_SIZE } from './config.js';
export { supabase, SITE, PAGE_SIZE };
export const $ = (s, r = document) => r.querySelector(s);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const slugify = t => String(t).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 70) || 'video';
export const videoPath = v => `/v/${slugify(v.title)}-${v.id}`;
export const PH = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 9'%3E%3Crect width='16' height='9' fill='%2320232e'/%3E%3C/svg%3E";

const isDirect = v => v.source_type === 'direct' && /^https?:\/\//i.test(v.video_url || '');
// Gambar thumbnail: URL manual bila ada; kalau tidak, frame langsung dari video (tanpa menyimpan gambar apa pun).
export function thumbMedia(v) {
  if (v.thumbnail_url || !isDirect(v)) return `<img src="${esc(v.thumbnail_url || PH)}" alt="${esc(v.title)}" loading="lazy">`;
  const t = v.thumb_time > 0 ? v.thumb_time : 1;
  return `<video data-src="${esc(v.video_url)}#t=${t}" preload="metadata" muted playsinline tabindex="-1" aria-label="${esc(v.title)}" style="width:100%;height:100%;object-fit:cover;pointer-events:none"></video>`;
}
// Video baru dimuat saat mendekati layar, supaya halaman dengan banyak kartu tetap ringan.
export function lazyVideos(root = document) {
  const vs = root.querySelectorAll('video[data-src]'); if (!vs.length) return;
  const load = v => { v.src = v.dataset.src; v.removeAttribute('data-src'); };
  if (!('IntersectionObserver' in window)) return vs.forEach(load);
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { io.unobserve(e.target); load(e.target); } }), { rootMargin: '200px' });
  vs.forEach(v => io.observe(v));
}

// Kolom yang dipakai kartu video.
export const CARD_COLS = 'id,title,thumbnail_url,video_url,source_type,thumb_time,views,created_at,site_categories(name,slug)';
const MAX_IDS = 1000; // batas baris per permintaan Supabase
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
// Video acak (berbeda tiap dimuat). Ambil daftar id ringan -> acak di browser -> ambil detail n video terpilih.
// Bila video > 1000, jendela id diambil dari posisi acak supaya seluruh koleksi tetap berpeluang muncul.
export async function randomVideos({ n = 8, catId = '', q = '', excludeId = '' } = {}) {
  const build = () => {
    let x = supabase.from('site_videos').select('id', { count: 'exact' }).eq('status', 'published');
    if (catId) x = x.eq('category_id', catId);
    if (q) x = x.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
    if (excludeId) x = x.neq('id', excludeId);
    return x.order('created_at', { ascending: false });
  };
  const r = await build().range(0, MAX_IDS - 1);
  if (r.error) { console.error('randomVideos gagal:', r.error.message); return []; }
  let ids = (r.data || []).map(x => x.id);
  const total = r.count || 0;
  if (total > MAX_IDS) {
    const start = Math.floor(Math.random() * (total - MAX_IDS + 1));
    const r2 = await build().range(start, start + MAX_IDS - 1);
    if (!r2.error && r2.data?.length) ids = r2.data.map(x => x.id);
  }
  const pick = shuffle(ids).slice(0, n);
  if (!pick.length) return [];
  const { data, error } = await supabase.from('site_videos').select(CARD_COLS).in('id', pick);
  if (error) { console.error('randomVideos gagal:', error.message); return []; }
  return shuffle(data || []);
}

export function card(v) {
  const c = v.site_categories;
  return `<a class="card" href="${videoPath(v)}"><div class="thumb">${thumbMedia(v)}</div>` +
    `<h3>${esc(v.title)}</h3><p>${c ? esc(c.name) + ' · ' : ''}${(v.views || 0).toLocaleString('id-ID')}x ditonton</p></a>`;
}

export function layout() {
  document.addEventListener('error', e => {
    if (e.target.tagName === 'IMG' && !e.target.dataset.f) { e.target.dataset.f = 1; e.target.src = PH; }
  }, true);
  const q = new URLSearchParams(location.search).get('q') || '';
  document.body.insertAdjacentHTML('afterbegin',
    `<header class="site-header"><div class="wrap header-row"><a class="logo" href="/">${esc(SITE)}<b>18+</b></a>` +
    `<form class="search" action="/" role="search"><input type="search" name="q" maxlength="80" placeholder="Cari video…" aria-label="Cari video" value="${esc(q)}">` +
    `<button type="submit">Cari</button></form></div></header>`);
  document.body.insertAdjacentHTML('beforeend',
    `<footer class="site-footer"><div class="wrap"><nav><a href="/terms">Syarat &amp; Kebijakan Konten</a><a href="/privacy">Privasi</a><a href="/report">Laporkan Konten</a></nav>` +
    `<p>Situs ini hanya untuk pengguna berusia 18 tahun ke atas. Kami tidak menyimpan video di server kami; video ditautkan dari sumber luar. ` +
    `Laporan konten ke <span data-email></span>.</p><p>© ${new Date().getFullYear()} ${esc(SITE)}</p></div></footer>`);
  document.querySelectorAll('[data-email]').forEach(el => el.innerHTML = `<a href="mailto:${esc(CONTACT_EMAIL)}">${esc(CONTACT_EMAIL)}</a>`);
  gate();
}

function gate() {
  try { if (localStorage.getItem('age18') === '1') return; } catch {}
  const d = document.createElement('div');
  d.className = 'gate'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true');
  d.innerHTML = `<div class="gate-box"><div class="gate-badge">18+</div><h2>Konten Dewasa</h2>` +
    `<p>Situs ini berisi video dewasa. Lanjutkan hanya jika Anda berusia minimal 18 tahun dan konten semacam ini boleh diakses di tempat Anda.</p>` +
    `<button class="btn primary" id="g-yes">Saya 18+ — Masuk</button><a class="btn" href="https://www.google.com">Keluar</a>` +
    `<p class="small">Dengan masuk Anda menyetujui <a href="/terms">Syarat</a> dan <a href="/privacy">Privasi</a>.</p></div>`;
  document.body.append(d); document.body.style.overflow = 'hidden';
  d.querySelector('#g-yes').onclick = () => {
    try { localStorage.setItem('age18', '1'); } catch {}
    d.remove(); document.body.style.overflow = '';
  };
}
