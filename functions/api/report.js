// POST /api/report : menerima laporan konten dengan Turnstile (opsional), pembatas laju, dan auto-hide laporan kritis.
import { json, readJson, sameOrigin, visitorHash, rpc, turnstileOk, UUID_RE } from '../_lib/common.js';

const REASONS = { underage: 'Anak di bawah 18 tahun', non_consent: 'Tanpa persetujuan / bocoran', copyright: 'Hak cipta', self: 'Saya muncul di video', other: 'Lainnya' };
const str = (v, n) => (typeof v === 'string' ? v : '').slice(0, n);

async function notify(env, r, reason, title, ref) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  const text = `${r.critical ? '🚨 ' : ''}Laporan baru: ${REASONS[reason]}\nVideo: ${title || ref || '-'}${r.autohidden ? '\nStatus: otomatis DISEMBUNYIKAN' : ''}\nBuka /admin > Laporan.`;
  try {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: text.slice(0, 500) }), signal: AbortSignal.timeout(5000),
    });
  } catch {}
}

export async function onRequestPost(ctx) {
  const { request, env } = ctx;
  try {
    if (!sameOrigin(request)) return json({ ok: false, error: 'origin' }, 403);
    const b = await readJson(request);
    const reason = str(b.reason, 30);
    if (!REASONS[reason]) return json({ ok: false, error: 'alasan' }, 400);
    const vid = typeof b.video_id === 'string' && UUID_RE.test(b.video_id) ? b.video_id : null;
    if (!(await turnstileOk(env, b.token, request))) return json({ ok: false, error: 'captcha' }, 403);

    const visitor = await visitorHash(request, env);
    // maks 5 laporan/jam/pengunjung dan 40/jam untuk seluruh situs
    const [a, g] = [await rpc(env, 'site_rl_hit', { p_scope: 'report', p_key: visitor, p_max: 5, p_window: 3600 }),
                    await rpc(env, 'site_rl_hit', { p_scope: 'report-all', p_key: 'all', p_max: 40, p_window: 3600 })];
    if (!a || !g) return json({ ok: false, error: 'rate' }, 429);

    const res = await rpc(env, 'site_submit_report', {
      p_video: vid, p_reason: reason, p_details: str(b.details, 2000), p_contact: str(b.contact, 200),
      p_ref: str(b.ref, 500), p_visitor: visitor, p_threshold: Math.max(1, parseInt(env.AUTOHIDE_THRESHOLD) || 2),
    });
    if (!res.duplicate) ctx.waitUntil(notify(env, res, reason, res.title, str(b.ref, 200)));
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: 'server' }, e.status || 500);
  }
}
export const onRequest = () => json({ ok: false, error: 'method' }, 405);
