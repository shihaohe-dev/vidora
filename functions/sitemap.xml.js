const SB_URL = 'https://opdiyrmyerpzavhyngal.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wZGl5cm15ZXJwemF2aHluZ2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM3Njg5NzksImV4cCI6MjEwOTM0NDk3OX0.1Er6QKx4MY36ftxU8yCT1BYs2g4FGLUfL0vt2gM7TDE';
const slugify = t => String(t).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 70) || 'video';
const xe = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
export async function onRequestGet({ request, env }) {
  const o = new URL(request.url).origin, base = env.SUPABASE_URL || SB_URL, key = env.SUPABASE_KEY || SB_KEY;
  const get = async p => { try { const r = await fetch(`${base}/rest/v1/${p}`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(5000) }); return r.ok ? r.json() : []; } catch { return []; } };
  const [vs, cs] = await Promise.all([get('site_videos?status=eq.published&select=id,title,created_at&order=created_at.desc&limit=5000'), get('site_categories?select=slug')]);
  const u = (loc, last) => `<url><loc>${xe(loc)}</loc>${last ? `<lastmod>${last.slice(0, 10)}</lastmod>` : ''}</url>`;
  const xml = '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    u(o + '/') + cs.map(c => u(`${o}/?c=${c.slug}`)).join('') + u(o + '/terms') + u(o + '/privacy') + u(o + '/report') +
    vs.map(v => u(`${o}/v/${slugify(v.title)}-${v.id}`, v.created_at)).join('') + '</urlset>';
  return new Response(xml, { headers: { 'content-type': 'application/xml', 'cache-control': 'public, max-age=3600' } });
}
