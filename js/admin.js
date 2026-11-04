import { supabase, $, esc, slugify, videoPath, SITE } from './app.js';
const app = $('#app');
const toast = m => { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 3500); };
let cats = [], tab = 'video', editing = null, q = '';

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
  $('#pane').innerHTML = `<form class="box" id="vf"><h2>${editing ? 'Edit video' : 'Tambah video (lewat URL)'}</h2>` +
    `<label>Judul<input id="t" required maxlength="150" value="${esc(e.title)}"></label>` +
    `<label>URL video <small>(link mp4/webm langsung, link embed, atau link Google Drive)</small><input id="u" type="url" required placeholder="https://…" value="${esc(e.video_url)}"></label>` +
    `<label>Jenis URL<select id="st"><option value="auto">Otomatis</option><option value="direct"${e.source_type === 'direct' ? ' selected' : ''}>Link file langsung (mp4/webm)</option><option value="embed"${e.source_type === 'embed' ? ' selected' : ''}>Embed / iframe</option></select></label>` +
    `<label>URL thumbnail<input id="th" type="url" placeholder="https://…" value="${esc(e.thumbnail_url)}"></label>` +
    `<label>Kategori<select id="c"><option value="">— tanpa kategori —</option>${cats.map(c => `<option value="${c.id}"${e.category_id === c.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>` +
    `<label>Tag <small>(pisahkan dengan koma)</small><input id="tg" value="${esc((e.tags || []).join(', '))}"></label>` +
    `<label>Deskripsi<textarea id="d" rows="3" maxlength="1000">${esc(e.description)}</textarea></label>` +
    `<label>Asal / lisensi konten <small>(wajib: mis. “produksi sendiri”, “lisensi studio X”)</small><input id="src" required value="${esc(e.content_source)}"></label>` +
    `<label class="check"><input type="checkbox" id="cf" ${e.consent_confirmed ? 'checked' : ''} required> Saya memastikan semua orang dalam video berusia 18+ dan memberi persetujuan untuk direkam dan ditayangkan, serta saya berhak menayangkannya.</label>` +
    `<label>Status<select id="s"><option value="published">Tayang</option><option value="hidden"${e.status === 'hidden' ? ' selected' : ''}>Sembunyikan</option></select></label>` +
    `<div class="row"><button class="btn primary">${editing ? 'Simpan perubahan' : 'Tambah video'}</button>${editing ? '<button type="button" class="btn" id="cancel">Batal</button>' : ''}</div></form>` +
    `<div class="box"><div class="row"><h2>Daftar video</h2><input id="sq" type="search" placeholder="Cari judul…" value="${esc(q)}"></div><div id="vl">Memuat…</div></div>`;
  $('#cancel')?.addEventListener('click', () => { editing = null; videoTab(); });
  $('#sq').onchange = ev => { q = ev.target.value.trim(); videoTab(); };
  $('#vf').onsubmit = async ev => {
    ev.preventDefault();
    const d = detect($('#u').value);
    if (!/^https?:\/\//i.test(d.url)) return toast('URL harus diawali http(s)://');
    const row = { title: $('#t').value.trim(), video_url: d.url, source_type: $('#st').value === 'auto' ? d.type : $('#st').value, thumbnail_url: $('#th').value.trim(),
      category_id: $('#c').value || null, tags: $('#tg').value.split(',').map(s => s.trim()).filter(Boolean), description: $('#d').value.trim(),
      content_source: $('#src').value.trim(), consent_confirmed: $('#cf').checked, status: $('#s').value };
    const r = editing ? await supabase.from('site_videos').update(row).eq('id', editing.id) : await supabase.from('site_videos').insert(row);
    if (r.error) return toast('Gagal: ' + r.error.message);
    toast('Tersimpan ✓'); editing = null; videoTab();
  };
  let s = supabase.from('site_videos').select('*,site_categories(name)').order('created_at', { ascending: false }).limit(100);
  if (q) s = s.ilike('title', `%${q.replace(/[%,()*\\]/g, ' ')}%`);
  const { data = [] } = await s; const rows = data || [];
  $('#vl').innerHTML = rows.length ? rows.map(v => `<div class="item"><img src="${esc(v.thumbnail_url || '')}" alt="" onerror="this.style.visibility='hidden'">` +
    `<div class="grow"><strong>${esc(v.title)}</strong><small>${esc(v.site_categories?.name || 'Tanpa kategori')} · ${v.views}x · ${v.status === 'published' ? 'Tayang' : 'Disembunyikan'}</small></div>` +
    `<a class="btn sm" href="${videoPath(v)}" target="_blank">Lihat</a><button class="btn sm" data-e="${v.id}">Edit</button>` +
    `<button class="btn sm" data-h="${v.id}" data-s="${v.status}">${v.status === 'published' ? 'Sembunyikan' : 'Tayangkan'}</button><button class="btn sm danger" data-x="${v.id}">Hapus</button></div>`).join('') : '<p>Belum ada video.</p>';
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
