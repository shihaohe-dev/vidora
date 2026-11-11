// Iklan video pre-roll (format VAST, Hilltop) untuk pemutar video langsung.
// Aturan: iklan gagal / lambat / kosong / macet => video konten tetap diputar (iklan tidak pernah menahan konten).
import { AD_VAST_PRIMARY, AD_FREQ_CAP_MIN } from './config.js';

const text = el => (el?.textContent || '').trim();
const all = (root, tag) => [...root.getElementsByTagName(tag)];
// Semua URL dari XML pihak ketiga hanya boleh https.
const safeUrl = raw => { try { return new URL(String(raw).trim()).protocol === 'https:' ? String(raw).trim() : ''; } catch { return ''; } };
const hms = s => { s = Math.max(0, s || 0); const p = n => String(Math.floor(n)).padStart(2, '0'); return `${p(s / 3600)}:${p((s % 3600) / 60)}:${p(s % 60)}.${String(Math.floor((s % 1) * 1000)).padStart(3, '0')}`; };

const fire = (urls, code = 900, m = {}) => {
  const map = { CACHEBUSTING: Math.floor(Math.random() * 1e8), ERRORCODE: code, TIMESTAMP: encodeURIComponent(new Date().toISOString()),
    ASSETURI: encodeURIComponent(m.asset || ''), CONTENTPLAYHEAD: '-1', ADPLAYHEAD: hms(m.t) };
  for (const raw of urls || []) {
    if (!safeUrl(raw)) continue;
    const u = raw.replace(/(?:\[|%5B)([A-Za-z]+)(?:\]|%5D)/g, (all, k) => (k.toUpperCase() in map ? map[k.toUpperCase()] : all));
    try { new Image().src = u; } catch {}
  }
};
const fail = (code, msg) => Object.assign(new Error(msg), { code });
const newAcc = () => ({ imp: [], err: [], track: {}, click: [], through: '', skip: '', media: [] });

// Ambil dan baca VAST (mengikuti wrapper maksimal 3 tingkat). acc dibuat di luar agar URL Error tetap bisa dipicu saat gagal.
async function load(url, acc, depth = 0) {
  if (depth > 3) throw fail(302, 'wrapper terlalu dalam');
  if (!safeUrl(url)) throw fail(301, 'URL VAST tidak https');
  let r;
  try { r = await fetch(url, { signal: AbortSignal.timeout(5000) }); } catch { throw fail(301, 'VAST tidak dapat diambil (jaringan/CORS)'); }
  if (!r.ok) throw fail(301, 'HTTP ' + r.status);
  const doc = new DOMParser().parseFromString(await r.text(), 'text/xml');
  if (doc.getElementsByTagName('parsererror').length) throw fail(100, 'VAST tidak valid');
  const ad = doc.getElementsByTagName('Ad')[0];
  if (!ad) throw fail(303, 'tidak ada iklan tersedia');
  acc.imp.push(...all(ad, 'Impression').map(text).filter(Boolean));
  acc.err.push(...all(ad, 'Error').map(text).filter(Boolean));
  acc.click.push(...all(ad, 'ClickTracking').map(text).filter(Boolean));
  all(ad, 'Tracking').forEach(t => { const e = t.getAttribute('event'); if (e && text(t)) (acc.track[e] = acc.track[e] || []).push(text(t)); });
  const ct = text(all(ad, 'ClickThrough')[0]); if (ct && safeUrl(ct)) acc.through = ct;
  const lin = all(ad, 'Linear')[0]; if (lin && lin.getAttribute('skipoffset')) acc.skip = lin.getAttribute('skipoffset');
  all(ad, 'MediaFile').forEach(m => acc.media.push({ url: text(m), type: m.getAttribute('type') || '', w: +m.getAttribute('width') || 0 }));
  const next = text(all(ad, 'VASTAdTagURI')[0]);
  return next ? load(next, acc, depth + 1) : acc;
}

const pickMedia = list => list.filter(m => safeUrl(m.url) && !/javascript|flash/i.test(m.type) && /mp4|webm|video\//i.test(m.type || m.url))
  .sort((a, b) => Math.abs(a.w - 640) - Math.abs(b.w - 640))[0];
const skipAt = (v, dur) => {
  if (v.endsWith('%')) return dur * parseFloat(v) / 100;
  const p = v.split(':').map(parseFloat); return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : 0;
};

const MAX_AD_MS = 60000;      // iklan tidak boleh menahan konten lebih dari ini
const START_MS = 8000;        // batas menunggu iklan mulai diputar
const STALL_MS = 8000;        // batas macet (buffering) saat iklan berjalan

function playAd(vEl, vast) {
  return new Promise(resolve => {
    const media = pickMedia(vast.media); if (!media) return resolve(false);
    const box = vEl.parentElement; box.style.position = 'relative';
    const layer = document.createElement('div'); layer.style.cssText = 'position:absolute;inset:0;background:#000;z-index:5';
    const av = document.createElement('video'); av.playsInline = true; av.setAttribute('playsinline', ''); av.preload = 'auto';
    av.style.cssText = 'width:100%;height:100%;object-fit:contain'; av.src = media.url;
    const tag = document.createElement('span'); tag.textContent = 'Iklan';
    tag.style.cssText = 'position:absolute;left:10px;top:10px;background:rgba(0,0,0,.65);color:#fff;font:600 12px system-ui;padding:4px 8px;border-radius:6px';
    const btnCss = 'position:absolute;bottom:10px;background:rgba(0,0,0,.75);color:#fff;border:1px solid #666;border-radius:8px;padding:10px 14px;font:600 14px system-ui';
    const skip = document.createElement('button'); skip.hidden = true; skip.disabled = true; skip.style.cssText = btnCss + ';right:10px';
    layer.append(av, tag, skip);
    // Klik hanya lewat tombol eksplisit (bukan di mana saja pada video) agar tidak terjadi klik tidak sengaja.
    if (vast.through) {
      const cta = document.createElement('button'); cta.textContent = 'Pelajari lebih lanjut'; cta.style.cssText = btnCss + ';left:10px';
      cta.onclick = () => { ping(vast.click); window.open(vast.through, '_blank', 'noopener,noreferrer'); };
      layer.append(cta);
    }
    box.append(layer);

    let done = false, started = false, stall = 0; const sent = {};
    const ping = urls => fire(urls, 900, { asset: media.url, t: av.currentTime });
    const ev = n => { if (!sent[n]) { sent[n] = 1; ping(vast.track[n]); } };
    const guard = setTimeout(() => { if (!started) { fire(vast.err, 900); finish(false); } }, START_MS);
    let cap = 0;
    const finish = ok => { if (done) return; done = true; clearTimeout(guard); clearTimeout(cap); clearTimeout(stall); av.pause(); layer.remove(); resolve(ok); };

    av.onerror = () => { fire(vast.err, 405); finish(false); };
    av.onloadedmetadata = () => { if (av.duration > MAX_AD_MS / 1000 * 1.5 && !vast.skip) { fire(vast.err, 405); finish(false); } };
    const armStall = () => { clearTimeout(stall); stall = setTimeout(() => { fire(vast.err, 405); finish(started); }, STALL_MS); };
    av.onwaiting = () => { if (started) armStall(); };
    av.onplaying = () => {
      clearTimeout(stall);
      if (started) return;
      started = true; clearTimeout(guard); cap = setTimeout(() => finish(true), MAX_AD_MS);
      ping(vast.imp); ev('creativeView'); ev('start');
    };
    av.ontimeupdate = () => {
      clearTimeout(stall);
      const d = av.duration, t = av.currentTime; if (!d) return;
      const p = t / d; if (p >= .25) ev('firstQuartile'); if (p >= .5) ev('midpoint'); if (p >= .75) ev('thirdQuartile');
      if (vast.skip) { skip.hidden = false; const left = Math.ceil(skipAt(vast.skip, d) - t); skip.disabled = left > 0; skip.textContent = left > 0 ? `Lewati dalam ${left}` : 'Lewati iklan ›'; }
    };
    av.onended = () => { ev('complete'); finish(true); };
    skip.onclick = () => { if (!skip.disabled) { ev('skip'); finish(true); } };
    av.play().catch(() => { fire(vast.err, 400); finish(false); });
  });
}

const capped = () => { const m = +AD_FREQ_CAP_MIN || 0; if (!m) return false; try { return Date.now() - (+localStorage.getItem('adlast') || 0) < m * 60000; } catch { return false; } };
const markShown = () => { try { localStorage.setItem('adlast', Date.now()); } catch {} };

// Dipasang pada <video> konten: satu iklan pre-roll sebelum video mulai.
// Bila iklan kosong/gagal/lambat/macet, video konten tetap diputar.
export function initPreroll(vEl) {
  if (!safeUrl(AD_VAST_PRIMARY) || capped()) return;
  const acc = newAcc();
  let state = 'loading', vast = null;
  const pending = load(AD_VAST_PRIMARY, acc)
    .then(a => { state = 'ready'; vast = a; return a; })
    .catch(e => { state = 'failed'; fire(acc.err, e.code || 900); console.warn('VAST dilewati:', e.message); return null; });

  let locked = false;
  const relock = () => { if (locked) vEl.pause(); };   // pengguna menekan play lagi saat iklan/menunggu: tahan konten
  vEl.addEventListener('play', async () => {
    locked = true; vEl.pause(); vEl.addEventListener('play', relock);
    try {
      // Bila VAST sudah siap, iklan diputar langsung di dalam gestur pengguna (penting untuk iOS/Safari).
      const a = state === 'ready' ? vast : state === 'failed' ? null
        : await Promise.race([pending, new Promise(r => setTimeout(() => r(null), 4000))]);
      if (a) { markShown(); await playAd(vEl, a); }
    } catch (e) { console.warn('iklan dilewati:', e); }
    finally { locked = false; vEl.removeEventListener('play', relock); vEl.play().catch(() => {}); }
  }, { once: true });
}
