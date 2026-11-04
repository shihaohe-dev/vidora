import { supabase, $, esc, slugify, videoPath, thumbMedia, lazyVideos, SITE } from './app.js';
const app = $('#app');
const toast = m => { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 3500); };
let cats = [], tab = 'video', editing = null, q = '', thumbTime = null;
// ---- Thumbnail langsung dari video: yang disimpan hanya detik frame-nya (thumb_time), bukan gambar ----
const once = (el, ev, ms) => new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('waktu habis memuat video')), ms);
  el.addEventListener(ev, () => { clearTimeout(t); res(); }, { once: true });
  el.addEventListener('error', () => { clearTimeout(t); rej(new Error('video gagal dimuat')); }, { once: true });
});
// Analisis 6 frame (butuh CORS dari server video) dan kembalikan detik frame terbaik: tidak gelap/terang berlebihan, kontras tinggi.
async function bestTime(url) {
  const v = document.createElement('video');
  v.crossOrigin = 'anonymous'; v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
  try {
    await once(v, 'loadedmetadata', 20000);
    const d = v.duration;
    if (!isFinite(d) || d <= 0 || !v.videoWidth) throw new Error('durasi tidak terbaca');
    const W = 160, H = Math.max(1, Math.round(W * v.videoHeight / v.videoWidth));
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true });
    let best = null;
    for (const p of [.1, .22, .35, .5, .65, .8]) {
      const t = Math.min(d - .1, d * p);
      v.currentTime = t; await once(v, 'seeked', 20000);
      g.drawImage(v, 0, 0, W, H);
      let px; try { px = g.getImageData(0, 0, W, H).data; } catch { throw new Error('CORS'); }
      let n = 0, sum = 0, sq = 0;
      for (let i = 0; i < px.length; i += 16) { const l = .299 * px[i] + .587 * px[i + 1] + .114 * px[i + 2]; n++; sum += l; sq += l * l; }
      const mean = sum / n, sd = Math.sqrt(Math.max(0, sq / n - mean * mean));
      const score = sd * (mean > 40 && mean < 215 ? 1 : .3);
      if (!best || score > best.score) best = { score, t };
    }
    return +best.t.toFixed(1);
  } finally { v.removeAttribute('src'); v.load(); }
}
async function duration(url) {
  const v = document.createElement('video'); v.preload = 'metadata'; v.muted = true; v.src = url;
  try { await once(v, 'loadedmetadata', 15000); return v.duration; } finally { v.removeAttribute('src'); v.load(); }
}
// Hasil: { t, smart }. smart=false berarti analisis tidak bisa (CORS), dipakai titik 15% durasi.
async function autoTime(url) {
  try { return { t: await bestTime(url), smart: true }; }
  catch { const d = await duration(url).catch(() => 0); return { t: d > 0 ? +(d * .15).toFixed(1) : 1, smart: false }; }
}
const driveThumb = u => { const m = u.match(/drive\.google\.com\/file\/d\/([\w-]+)/); return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w640` : ''; };

const AR = { '16:9': 16 / 9, '4:3': 4 / 3, '1:1': 1, '3:4': 3 / 4, '9:16': 9 / 16 };
const nearestAR = r => Object.keys(AR).reduce((a, b) => Math.abs(AR[b] - r) < Math.abs(AR[a] - r) ? b : a);
// Deteksi rasio: file langsung dari metadata video; Google Drive dari gambar thumbnail-nya. Lainnya: null (pilih manual).
async function detectAspect(url, type) {
  try {
    const dt = driveThumb(url);
    if (dt) return await new Promise((res, rej) => { const i = new Image(); const t = setTimeout(rej, 10000); i.onload = () => { clearTimeout(t); res(nearestAR(i.naturalWidth / i.naturalHeight)); }; i.onerror = rej; i.src = dt; });
    if (type === 'direct') {
      const v = document.createElement('video'); v.preload = 'metadata'; v.muted = true; v.src = url;
      try { await once(v, 'loadedmetadata', 15000); return nearestAR(v.videoWidth / v.videoHeight); } finally { v.removeAttribute('src'); v.load(); }
    }
  } catch {}
  return null;
}

// Pemilih frame manual: geser/putar video, lalu "Pakai frame ini". Pratinjau tidak butuh CORS.
function setupPicker() {
  const pv = $('#pv'), ts = $('#ts'), lab = $('#tl');
  const show = () => { lab.textContent = thumbTime == null ? 'Belum dipilih (otomatis saat disimpan)' : `Frame terpilih: ${thumbTime.toFixed(1)} dtk`; };
  const cur = () => { const d = detect($('#u').value), st = $('#st').value; return { d, direct: /^https?:\/\//i.test(d.url) && (st === 'auto' ? d.type : st) === 'direct' }; };
  const load = () => { const { d, direct } = cur(); $('#picker').hidden = !direct; if (direct && pv.dataset.u !== d.url) { pv.dataset.u = d.url; pv.src = d.url; } };
  pv.onloadedmetadata = () => { ts.max = pv.duration; if (thumbTime != null) { ts.value = thumbTime; pv.currentTime = thumbTime; } };
  pv.ontimeupdate = () => { if (!pv.paused) ts.value = pv.currentTime; };
  ts.oninput = () => { pv.pause(); pv.currentTime = +ts.value; };
  $('#use').onclick = () => { thumbTime = +pv.currentTime.toFixed(1); show(); toast('Frame dipilih ✓'); };
  $('#auto').onclick = async () => {
    const b = $('#auto'); b.disabled = true; b.textContent = 'Menganalisis…';
    try {
      const r = await autoTime(cur().d.url); thumbTime = r.t; pv.currentTime = r.t; ts.value = r.t; show();
      toast(r.smart ? 'Frame terbaik dipilih otomatis ✓' : 'Server video belum mengizinkan CORS: dipakai titik 15% durasi. Geser manual bila perlu.');
    } catch (err) { toast('Gagal: ' + err.message); }
    b.disabled = false; b.textContent = 'Pilih otomatis';
  };
  const autoAspect = async () => { const { d, direct } = cur(); const a = await detectAspect(d.url, direct ? 'direct' : 'embed'); if (a) { $('#ar').value = a; toast('Rasio terdeteksi: ' + a); } };
  $('#u').addEventListener('change', () => { load(); autoAspect(); }); $('#st').addEventListener('change', load);
  load(); show();
}

async function init() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return login();
  const { data, error } = await supabase.rpc('site_is_admin');
  if (error || data !== true) return login(error ? 'Jalankan supabase-sql/schema.sql dulu.' : 'Akun ini belum terdaftar sebagai admin.');
  await loadCats(); shell();
}
function login(msg = '') {
  app.innerHTML = `<form class="box login" id="lf"><h1>Admin ${esc(SITE)}</h1><label>Email<input type="email" id="em" required autocomplete="username"></label>` +
    `<label>Password<input type="password" id="pw" required autocomplete="current-password"></label><p class="err">${esc(msg)}</p><button class="btn primary">Masuk</button></form>`;
  $('#lf').onsubmit = async e => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email: $('#em').value, password: $('#pw').value });
    error ? login('Email atau password salah.') : init();
  };
}
const loadCats = async () => { cats = (await supabase.from('site_categories').select('*').order('sort').order('name')).data || []; };

async function shell() {
  const { count } = await supabase.from('site_reports').select('id', { count: 'exact', head: true }).eq('status', 'open');
  app.innerHTML = `<div class="admin-bar"><strong>Admin ${esc(SITE)}</strong><nav>` +
    [['video', 'Video'], ['cats', 'Kategori'], ['reports', `Laporan${count ? ` (${count})` : ''}`]].map(([k, l]) => `<button class="tab${tab === k ? ' on' : ''}" data-tab="${k}">${l}</button>`).join('') +
    `<button class="tab" id="out">Keluar</button></nav></div><div id="pane"></div>`;
  app.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; editing = null; shell(); });
  $('#out').onclick = async () => { await supabase.auth.signOut(); init(); };
  ({ video: videoTab, cats: catsTab, reports: reportsTab })[tab]();
}

function detect(u) {
  u = u.trim();
  const m = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?.*?id=)([\w-]+)/);
  if (m) return { url: `https://drive.google.com/file/d/${m[1]}/preview`, type: 'embed' };
  return { url: u, type: /\.(mp4|webm|m4v|mov|ogv)(\?|#|$)/i.test(u) ? 'direct' : 'embed' };
}

async function videoTab() {
  const e = editing || {};
  thumbTime = e.thumb_time ?? null;
  $('#pane').innerHTML = `<form class="box" id="vf"><h2>${editing ? 'Edit video' : 'Tambah video (lewat URL)'}</h2>` +
    `<label>Judul<input id="t" required maxlength="150" value="${esc(e.title)}"></label>` +
    `<label>URL video <small>(link mp4/webm langsung, link embed, atau link Google Drive)</small><input id="u" type="url" required placeholder="https://…" value="${esc(e.video_url)}"></label>` +
    `<label>Jenis URL<select id="st"><option value="auto">Otomatis</option><option value="direct"${e.source_type === 'direct' ? ' selected' : ''}>Link file langsung (mp4/webm)</option><option value="embed"${e.source_type === 'embed' ? ' selected' : ''}>Embed / iframe</option></select></label>` +
    `<label>Rasio video <small>(otomatis terdeteksi; ubah bila salah, mis. video vertikal = 9:16)</small><select id="ar">${Object.keys(AR).map(a => `<option${(e.aspect || '16:9') === a ? ' selected' : ''}>${a}</option>`).join('')}</select></label>` +
    `<label>URL thumbnail <small>(opsional — kosongkan agar gambar diambil langsung dari video)</small><input id="th" type="url" placeholder="https://…" value="${esc(e.thumbnail_url)}"></label>` +
    `<div class="box" id="picker" hidden><strong>Pilih frame thumbnail dari video</strong><video id="pv" controls muted playsinline preload="metadata" style="width:100%;max-height:320px;background:#000;border-radius:8px"></video><input id="ts" type="range" min="0" max="0" step="0.1" value="0" aria-label="Geser untuk memilih frame"><div class="row"><button type="button" class="btn sm" id="use">Pakai frame ini</button><button type="button" class="btn sm" id="auto">Pilih otomatis</button><span id="tl"></span></div></div>` +
    `<label>Kategori<select id="c"><option value="">— tanpa kategori —</option>${cats.map(c => `<option value="${c.id}"${e.category_id === c.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>` +
    `<label>Tag <small>(pisahkan dengan koma)</small><input id="tg" value="${esc((e.tags || []).join(', '))}"></label>` +
    `<label>Deskripsi<textarea id="d" rows="3" maxlength="1000">${esc(e.description)}</textarea></label>` +
    `<label>Asal / lisensi konten <small>(wajib: mis. “produksi sendiri”, “lisensi studio X”)</small><input id="src" required value="${esc(e.content_source)}"></label>` +
    `<label class="check"><input type="checkbox" id="cf" ${e.consent_confirmed ? 'checked' : ''} required> Saya memastikan semua orang dalam video berusia 18+ dan memberi persetujuan untuk direkam dan ditayangkan, serta saya berhak menayangkannya.</label>` +
    `<label>Status<select id="s"><option value="published">Tayang</option><option value="hidden"${e.status === 'hidden' ? ' selected' : ''}>Sembunyikan</option></select></label>` +
    `<div class="row"><button class="btn primary">${editing ? 'Simpan perubahan' : 'Tambah video'}</button>${editing ? '<button type="button" class="btn" id="cancel">Batal</button>' : ''}</div></form>` +
    `<div class="box"><div class="row"><h2>Daftar video</h2><button type="button" class="btn sm" id="fill">Pilih frame otomatis untuk yang kosong</button><input id="sq" type="search" placeholder="Cari judul…" value="${esc(q)}"></div><div id="vl">Memuat…</div></div>`;
  $('#cancel')?.addEventListener('click', () => { editing = null; videoTab(); });
  $('#sq').onchange = ev => { q = ev.target.value.trim(); videoTab(); };
  setupPicker();
  $('#fill').onclick = async () => {
    const { data } = await supabase.from('site_videos').select('id,video_url').eq('source_type', 'direct').is('thumb_time', null).or('thumbnail_url.is.null,thumbnail_url.eq.').limit(40);
    const list = data || []; if (!list.length) return toast('Semua video sudah punya frame thumbnail');
    let ok = 0;
    for (const [i, v] of list.entries()) {
      toast(`Memproses ${i + 1}/${list.length}…`);
      try { const r = await autoTime(v.video_url); await supabase.from('site_videos').update({ thumb_time: r.t }).eq('id', v.id); ok++; } catch {}
    }
    toast(`Selesai: ${ok} dari ${list.length} video`); videoTab();
  };
  $('#vf').onsubmit = async ev => {
    ev.preventDefault();
    const d = detect($('#u').value);
    if (!/^https?:\/\//i.test(d.url)) return toast('URL harus diawali http(s)://');
    const row = { title: $('#t').value.trim(), video_url: d.url, source_type: $('#st').value === 'auto' ? d.type : $('#st').value, thumbnail_url: $('#th').value.trim(),
      category_id: $('#c').value || null, tags: $('#tg').value.split(',').map(s => s.trim()).filter(Boolean), description: $('#d').value.trim(),
      content_source: $('#src').value.trim(), consent_confirmed: $('#cf').checked, status: $('#s').value, aspect: $('#ar').value };
    let note = '';
    row.thumb_time = row.source_type === 'direct' ? thumbTime : null;
    if (!row.thumbnail_url) {
      if (driveThumb(d.url)) row.thumbnail_url = driveThumb(d.url);
      else if (row.source_type !== 'direct') note = 'link embed tidak punya frame video; isi URL thumbnail manual bila perlu';
      else if (row.thumb_time == null) {
        toast('Memilih frame otomatis…');
        const r = await autoTime(d.url); row.thumb_time = r.t;
        if (!r.smart) note = 'server video belum mengizinkan CORS, dipakai titik 15% durasi; pilih frame manual bila perlu';
      }
    }
    const r = editing ? await supabase.from('site_videos').update(row).eq('id', editing.id) : await supabase.from('site_videos').insert(row);
    if (r.error) return toast('Gagal: ' + r.error.message);
    toast('Tersimpan ✓' + (note ? ' — ' + note : '')); editing = null; videoTab();
  };
  let s = supabase.from('site_videos').select('*,site_categories(name)').order('created_at', { ascending: false }).limit(100);
  if (q) s = s.ilike('title', `%${q.replace(/[%,()*\\]/g, ' ')}%`);
  const { data = [] } = await s; const rows = data || [];
  $('#vl').innerHTML = rows.length ? rows.map(v => `<div class="item"><div style="width:84px;aspect-ratio:16/9;border-radius:6px;overflow:hidden;background:var(--panel2)">${thumbMedia(v)}</div>` +
    `<div class="grow"><strong>${esc(v.title)}</strong><small>${esc(v.site_categories?.name || 'Tanpa kategori')} · ${v.views}x · ${v.status === 'published' ? 'Tayang' : 'Disembunyikan'}</small></div>` +
    `<a class="btn sm" href="${videoPath(v)}" target="_blank">Lihat</a><button class="btn sm" data-e="${v.id}">Edit</button>` +
    `<button class="btn sm" data-h="${v.id}" data-s="${v.status}">${v.status === 'published' ? 'Sembunyikan' : 'Tayangkan'}</button><button class="btn sm danger" data-x="${v.id}">Hapus</button></div>`).join('') : '<p>Belum ada video.</p>';
  lazyVideos($('#vl'));
  $('#vl').onclick = async ev => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.e) { editing = rows.find(v => v.id === b.dataset.e); videoTab(); scrollTo(0, 0); }
    if (b.dataset.h) { await supabase.from('site_videos').update({ status: b.dataset.s === 'published' ? 'hidden' : 'published' }).eq('id', b.dataset.h); videoTab(); }
    if (b.dataset.x && confirm('Hapus video ini permanen?')) { await supabase.from('site_videos').delete().eq('id', b.dataset.x); videoTab(); }
  };
}

function catsTab() {
  $('#pane').innerHTML = `<form class="box" id="cf2"><h2>Kategori</h2><div class="row"><input id="cn" required maxlength="40" placeholder="Nama kategori baru"><button class="btn primary">Tambah</button></div></form>` +
    `<div class="box">${cats.map(c => `<div class="item"><div class="grow"><strong>${esc(c.name)}</strong><small>/?c=${esc(c.slug)}</small></div><button class="btn sm danger" data-x="${c.id}">Hapus</button></div>`).join('') || '<p>Belum ada kategori.</p>'}</div>`;
  $('#cf2').onsubmit = async e => {
    e.preventDefault(); const n = $('#cn').value.trim();
    const { error } = await supabase.from('site_categories').insert({ name: n, slug: slugify(n), sort: cats.length + 1 });
    if (error) return toast('Gagal: ' + error.message); await loadCats(); catsTab();
  };
  $('#pane').onclick = async e => {
    const b = e.target.closest('[data-x]');
    if (b && confirm('Hapus kategori? Video di dalamnya jadi tanpa kategori.')) { await supabase.from('site_categories').delete().eq('id', b.dataset.x); await loadCats(); catsTab(); }
  };
}

async function reportsTab() {
  const { data } = await supabase.from('site_reports').select('*,site_videos(id,title)').eq('status', 'open').order('created_at', { ascending: false });
  const rows = data || [];
  $('#pane').innerHTML = `<div class="box"><h2>Laporan terbuka</h2>${rows.map(r => `<div class="item col"><div><strong>${esc(r.reason)}</strong> <small>${new Date(r.created_at).toLocaleString('id-ID')}</small></div>` +
    `<div>${r.site_videos ? `<a href="${videoPath(r.site_videos)}" target="_blank">${esc(r.site_videos.title)}</a>` : '<em>Video tidak tercatat / sudah dihapus</em>'}</div>` +
    `<div>${esc(r.details || '')}</div><small>Kontak: ${esc(r.contact || '-')}</small>` +
    `<div class="row">${r.video_id ? `<button class="btn sm danger" data-hide="${r.id}" data-v="${r.video_id}">Sembunyikan video &amp; selesai</button>` : ''}<button class="btn sm" data-done="${r.id}">Tandai selesai</button></div></div>`).join('') || '<p>Tidak ada laporan baru.</p>'}</div>`;
  $('#pane').onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.hide) await supabase.from('site_videos').update({ status: 'hidden' }).eq('id', b.dataset.v);
    const id = b.dataset.hide || b.dataset.done; if (!id) return;
    await supabase.from('site_reports').update({ status: 'closed' }).eq('id', id); shell();
  };
}
init();
