import { sbUrl, sbAnon, withSec } from './_lib/common.js';
const slugify = t => String(t).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 70) || 'video';
const xe = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export async function onRequest({ request, env }) {   // melayani GET dan HEAD
  const o = new URL(request.url).origin, base = sbUrl(env), key = sbAnon(env);
  const get = async p => { try { const r = await fetch(`${base}/rest/v1/${p}`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(5000) }); return r.ok ? r.json() : null; } catch { return null; } };
  const [vs, cs] = await Promise.all([get('site_videos?status=eq.published&select=id,title,created_at&order=created_at.desc&limit=5000'), get('site_categories?select=slug')]);
  // Database gagal dijawab: beri 503 agar Google mencoba lagi, bukan menyimpan sitemap kosong.
  if (vs === null) return new Response('Sitemap sementara tidak tersedia', { status: 503, headers: withSec({ 'retry-after': '300', 'cache-control': 'no-store' }) });
  const u = (loc, last) => `<url><loc>${xe(loc)}</loc>${last ? `<lastmod>${last.slice(0, 10)}</lastmod>` : ''}</url>`;
  const xml = '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    u(o + '/') + (cs || []).map(c => u(`${o}/?c=${c.slug}`)).join('') + u(o + '/terms') + u(o + '/privacy') + u(o + '/report') +
    vs.map(v => u(`${o}/v/${slugify(v.title)}-${v.id}`, v.created_at)).join('') + '</urlset>';
  return new Response(xml, { headers: withSec({ 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=900' }) });
}
