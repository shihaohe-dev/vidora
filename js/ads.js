// Iklan video pre-roll (format VAST, mis. ExoClick) untuk pemutar video langsung.
// Aturan: iklan gagal / lambat / kosong => video konten langsung diputar tanpa iklan.
import { AD_VAST_URL, AD_COOLDOWN_MIN } from './config.js';

const text = el => (el?.textContent || '').trim();
const all = (root, tag) => [...root.getElementsByTagName(tag)];
const fire = (urls, code = 900) => {
  for (const raw of urls || []) {
    const u = raw.replace(/\[CACHEBUSTING\]/g, Math.floor(Math.random() * 1e8)).replace(/\[ERRORCODE\]/g, code)
      .replace(/\[TIMESTAMP\]/g, encodeURIComponent(new Date().toISOString()));
    try { new Image().src = u; } catch {}
  }
};

// Ambil dan baca VAST (mengikuti wrapper maksimal 3 tingkat).
async function load(url, acc = { imp: [], err: [], track: {}, click: [], through: '', skip: '', media: [] }, depth = 0) {
  if (depth > 3) throw new Error('wrapper terlalu dalam');
  const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const doc = new DOMParser().parseFromString(await r.text(), 'text/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('VAST tidak valid');
  const ad = doc.getElementsByTagName('Ad')[0];
  if (!ad) throw new Error('tidak ada iklan tersedia');
  acc.imp.push(...all(ad, 'Impression').map(text).filter(Boolean));
  acc.err.push(...all(ad, 'Error').map(text).filter(Boolean));
  acc.click.push(...all(ad, 'ClickTracking').map(text).filter(Boolean));
  all(ad, 'Tracking').forEach(t => { const e = t.getAttribute('event'); if (e && text(t)) (acc.track[e] = acc.track[e] || []).push(text(t)); });
  const ct = text(all(ad, 'ClickThrough')[0]); if (ct) acc.through = ct;
  const lin = all(ad, 'Linear')[0]; if (lin && lin.getAttribute('skipoffset')) acc.skip = lin.getAttribute('skipoffset');
  all(ad, 'MediaFile').forEach(m => acc.media.push({ url: text(m), type: m.getAttribute('type') || '', w: +m.getAttribute('width') || 0 }));
  const next = text(all(ad, 'VASTAdTagURI')[0]);
  return next ? load(next, acc, depth + 1) : acc;
}

const pickMedia = list => list.filter(m => m.url && !/javascript|flash/i.test(m.type) && /mp4|webm|video\//i.test(m.type || m.url))
  .sort((a, b) => Math.abs(a.w - 640) - Math.abs(b.w - 640))[0];
const skipAt = (v, dur) => {
  if (v.endsWith('%')) return dur * parseFloat(v) / 100;
  const p = v.split(':').map(parseFloat); return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : 0;
};

function playAd(vEl, vast) {
  return new Promise(resolve => {
    const media = pickMedia(vast.media); if (!media) return resolve(false);
    const box = vEl.parentElement; box.style.position = 'relative';
    const layer = document.createElement('div'); layer.style.cssText = 'position:absolute;inset:0;background:#000;z-index:5';
    const av = document.createElement('video'); av.playsInline = true; av.setAttribute('playsinline', ''); av.preload = 'auto';
    av.style.cssText = 'width:100%;height:100%;object-fit:contain'; av.src = media.url;
    const tag = document.createElement('span'); tag.textContent = 'Iklan';
    tag.style.cssText = 'position:absolute;left:10px;top:10px;background:rgba(0,0,0,.65);color:#fff;font:600 12px system-ui;padding:4px 8px;border-radius:6px';
    const skip = document.createElement('button'); skip.hidden = !vast.skip;
    skip.style.cssText = 'position:absolute;right:10px;bottom:10px;background:rgba(0,0,0,.75);color:#fff;border:1px solid #666;border-radius:8px;padding:10px 14px;font:600 14px system-ui';
    layer.append(av, tag, skip); box.append(layer);

    let done = false, started = false; const sent = {};
    const ev = n => { if (!sent[n]) { sent[n] = 1; fire(vast.track[n]); } };
    const guard = setTimeout(() => { if (!started) { fire(vast.err, 900); finish(false); } }, 8000);
    const finish = ok => { if (done) return; done = true; clearTimeout(guard); av.pause(); layer.remove(); resolve(ok); };

    av.onerror = () => { fire(vast.err, 405); finish(false); };
    av.onplaying = () => { if (started) return; started = true; clearTimeout(guard); fire(vast.imp); ev('creativeView'); ev('start'); };
    av.ontimeupdate = () => {
      const d = av.duration, t = av.currentTime; if (!d) return;
      const p = t / d; if (p >= .25) ev('firstQuartile'); if (p >= .5) ev('midpoint'); if (p >= .75) ev('thirdQuartile');
      if (vast.skip) { const left = Math.ceil(skipAt(vast.skip, d) - t); skip.disabled = left > 0; skip.textContent = left > 0 ? `Lewati dalam ${left}` : 'Lewati iklan ›'; }
    };
    av.onended = () => { ev('complete'); finish(true); };
    av.onclick = () => { if (vast.through) { fire(vast.click); window.open(vast.through, '_blank', 'noopener'); } };
    skip.onclick = () => { if (!skip.disabled) { ev('skip'); finish(true); } };
    av.play().catch(() => { fire(vast.err, 400); finish(false); });
  });
}

// Dipasang pada <video> konten: iklan tampil sekali sebelum video mulai, dengan jeda minimal antar iklan.
export function initPreroll(vEl) {
  if (!AD_VAST_URL) return;
  try { if (Date.now() - (+localStorage.getItem('adLast') || 0) < AD_COOLDOWN_MIN * 60000) return; } catch {}
  const pending = load(AD_VAST_URL).catch(e => { console.warn('VAST dilewati:', e.message); return null; });
  vEl.addEventListener('play', async () => {
    vEl.pause();
    const vast = await Promise.race([pending, new Promise(r => setTimeout(() => r(null), 3000))]);
    if (vast && await playAd(vEl, vast)) { try { localStorage.setItem('adLast', Date.now()); } catch {} }
    vEl.play().catch(() => {});
  }, { once: true });
}
