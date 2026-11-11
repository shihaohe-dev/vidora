import { supabase, SITE, CONTACT_EMAIL, PAGE_SIZE, TELEGRAM_URL, X_ACCOUNTS, OPERATOR_NAME } from './config.js';
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
export async function randomVideos({ n = 8, catId = '', q = '', excludeId = '', exclude = [] } = {}) {
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
  if (exclude.length) { const skip = new Set(exclude); ids = ids.filter(i => !skip.has(i)); }
  const pick = shuffle(ids).slice(0, n);
  const more = ids.length - pick.length; // sisa video yang belum pernah ditampilkan
  if (!pick.length) return Object.assign([], { more: 0 });
  const { data, error } = await supabase.from('site_videos').select(CARD_COLS).in('id', pick);
  if (error) { console.error('randomVideos gagal:', error.message); return []; }
  return Object.assign(shuffle(data || []), { more });
}

export function card(v) {
  const c = v.site_categories;
  return `<a class="card" href="${videoPath(v)}"><div class="thumb">${thumbMedia(v)}</div>` +
    `<h3>${esc(v.title)}</h3><p>${c ? esc(c.name) + ' · ' : ''}${(v.views || 0).toLocaleString('id-ID')}x ditonton</p></a>`;
}

const ICON_TG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M21.9 4.1 2.7 11.5c-1.3.5-1.3 1.3-.2 1.6l4.9 1.5 1.9 5.8c.2.6.1.8.7.8.5 0 .7-.2 1-.5l2.4-2.3 4.9 3.6c.9.5 1.5.2 1.7-.8L23 5.4c.3-1.3-.5-1.9-1.1-1.3zM8.6 13.6l9.7-6.1c.5-.3.9-.1.5.2l-8.1 7.3-.3 3.4z"/></svg>';
const ICON_X = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M18.2 2.3h3.4l-7.4 8.5 8.7 11.5h-6.8l-5.3-7-6.1 7H1.3l7.9-9.1L.9 2.3h7l4.8 6.4zm-1.2 18h1.9L7 4.2H5z"/></svg>';
const isUrl = u => /^https?:\/\//i.test(u || '');
function socials() {
  const L = 'target="_blank" rel="noopener noreferrer nofollow"';
  const a = [];
  if (isUrl(TELEGRAM_URL)) a.push(`<a class="soc tg" href="${esc(TELEGRAM_URL)}" ${L}>${ICON_TG}<span>Channel Telegram</span></a>`);
  (X_ACCOUNTS || []).filter(x => isUrl(x.url)).forEach(x => a.push(`<a class="soc" href="${esc(x.url)}" ${L}>${ICON_X}<span>${esc(x.name || 'X')}</span></a>`));
  return a.length ? `<div class="social"><b>Ikuti kami:</b>${a.join('')}</div>` : '';
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
    `<footer class="site-footer"><div class="wrap">${socials()}<nav><a href="/terms">Syarat &amp; Kebijakan Konten</a><a href="/privacy">Privasi</a><a href="/report">Laporkan Konten</a></nav>` +
    `<p>Situs ini hanya untuk pengguna berusia 18 tahun ke atas. Kami tidak menyimpan video di server kami; video ditautkan dari sumber luar. ` +
    `Laporan konten ke <span data-email></span>.</p><p>© ${new Date().getFullYear()} ${esc(SITE)}</p></div></footer>`);
  document.querySelectorAll('[data-email]').forEach(el => el.innerHTML = `<a href="mailto:${esc(CONTACT_EMAIL)}">${esc(CONTACT_EMAIL)}</a>`);
  document.querySelectorAll('[data-operator]').forEach(el => el.textContent = OPERATOR_NAME);
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
