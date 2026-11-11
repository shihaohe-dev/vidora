// POST /api/view : menghitung tayangan dengan dedupe di server (1 per video per pengunjung per hari) dan batas laju.
import { json, readJson, sameOrigin, visitorHash, rpc, UUID_RE } from '../_lib/common.js';

export async function onRequestPost({ request, env }) {
  try {
    if (!sameOrigin(request)) return json({ ok: false }, 403);
    const b = await readJson(request, 512);
    if (typeof b.vid !== 'string' || !UUID_RE.test(b.vid)) return json({ ok: false }, 400);
    const visitor = await visitorHash(request, env);
    if (!(await rpc(env, 'site_rl_hit', { p_scope: 'view', p_key: visitor, p_max: 120, p_window: 3600 }))) return json({ ok: false }, 429);
    const counted = await rpc(env, 'site_add_view_secure', { p_vid: b.vid, p_visitor: visitor });
    return json({ ok: true, counted: counted === true });
  } catch (e) {
    return json({ ok: false }, e.status || 500);
  }
}
export const onRequest = () => json({ ok: false }, 405);
