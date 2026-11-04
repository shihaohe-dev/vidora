const slugify = t => String(t).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 70) || 'video';
export async function onRequestGet({ request, env }) {
  const o = new URL(request.url).origin, h = { apikey: env.SUPABASE_KEY, Authorization: `Bearer ${env.SUPABASE_KEY}` };
  const get = async p => { const r = await fetch(`${env.SUPABASE_URL}/rest/v1/${p}`, { headers: h }); return r.ok ? r.json() : []; };
  const [vs, cs] = await Promise.all([get('site_videos?status=eq.published&select=id,title,created_at&order=created_at.desc&limit=5000'), get('site_categories?select=slug')]);
  const u = (loc, last) => `<url><loc>${loc}</loc>${last ? `<lastmod>${last.slice(0, 10)}</lastmod>` : ''}</url>`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.w3.org/2000/schema/sitemap/0.9">`.replace('http://www.w3.org/2000/schema/sitemap/0.9', 'http://www.sitemaps.org/schemas/sitemap/0.9') +
    u(o + '/') + cs.map(c => u(`${o}/?c=${c.slug}`)).join('') + u(o + '/terms') + u(o + '/privacy') + u(o + '/report') +
    vs.map(v => u(`${o}/v/${slugify(v.title)}-${v.id}`, v.created_at)).join('') + '</urlset>';
  return new Response(xml, { headers: { 'content-type': 'application/xml', 'cache-control': 'public, max-age=3600' } });
}
