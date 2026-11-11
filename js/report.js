import { supabase, $, layout } from './app.js';
import { TURNSTILE_SITE_KEY } from './config.js';
layout();
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const pre = new URLSearchParams(location.search).get('v');
if (pre && UUID.test(pre)) $('#ref').value = location.origin + '/v/' + pre;

// Captcha Turnstile (opsional)
let token = '';
if (TURNSTILE_SITE_KEY) {
  const s = document.createElement('script'); s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; s.async = true;
  s.onload = () => window.turnstile.render('#ts', { sitekey: TURNSTILE_SITE_KEY, callback: t => { token = t; }, 'expired-callback': () => { token = ''; } });
  document.head.append(s);
}

$('#form').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = $('#send'), msg = $('#msg'); msg.textContent = '';
  if (TURNSTILE_SITE_KEY && !token) { msg.textContent = 'Selesaikan verifikasi dulu.'; return; }
  btn.disabled = true;
  const refText = $('#ref').value.trim().slice(0, 500);
  const vid = (refText.match(UUID) || [])[0] || null;
  const body = { video_id: vid, reason: $('#reason').value, details: $('#details').value.slice(0, 1800), contact: $('#contact').value.slice(0, 200), ref: refText, token };
  let ok = false, status = 0;
  try {
    const r = await fetch('/api/report', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    ok = r.ok; status = r.status;
  } catch { status = 0; }
  // Cadangan masa transisi: bila /api/report belum aktif (404/503), pakai jalur lama. Setelah 02_lockdown.sql jalur ini otomatis ditolak.
  if (!ok && (status === 404 || status === 503 || status === 0)) {
    const { error } = await supabase.from('site_reports').insert({ video_id: vid, reason: body.reason, details: (body.details + (vid ? '' : `\nTautan: ${refText}`)).slice(0, 2000), contact: body.contact || null });
    ok = !error;
  }
  if (!ok) { btn.disabled = false; msg.textContent = status === 429 ? 'Terlalu banyak laporan dari perangkat ini. Coba lagi nanti atau kirim email.' : 'Gagal mengirim. Coba lagi atau kirim email.'; if (window.turnstile) { window.turnstile.reset(); token = ''; } return; }
  $('#form').hidden = true; $('#ok').hidden = false;
});
