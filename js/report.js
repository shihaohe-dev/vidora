import { supabase, $, layout } from './app.js';
layout();
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const pre = new URLSearchParams(location.search).get('v');
if (pre) $('#ref').value = location.origin + '/v/' + pre;
$('#form').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = $('#send'); btn.disabled = true;
  const vid = ($('#ref').value.match(UUID) || [])[0] || null;
  const details = ($('#details').value + (vid ? '' : `\nTautan: ${$('#ref').value}`)).slice(0, 2000);
  const { error } = await supabase.from('site_reports').insert({ video_id: vid, reason: $('#reason').value, details, contact: $('#contact').value.slice(0, 200) || null });
  if (error) { btn.disabled = false; $('#msg').textContent = 'Gagal mengirim. Coba lagi atau kirim email.'; return; }
  $('#form').hidden = true; $('#ok').hidden = false;
});
