// Menyisipkan title, description, canonical, dan JSON-LD VideoObject ke halaman video agar bisa diindeks Google.
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const html = (body, status = 200) => new Response(body, { status, headers: { 'content-type': 'text/html;charset=utf-8', 'cache-control': 'public, max-age=300' } });

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const page = await (await env.ASSETS.fetch(new URL('/watch', url))).text();
  const id = url.pathname.slice(-36);
  const notFound = () => html(page.replace('<!--SEO-->', '<meta name="robots" content="noindex">'), 404);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return notFound();

  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/site_videos?id=eq.${id}&status=eq.published&select=title,description,thumbnail_url,created_at`,
    { headers: { apikey: env.SUPABASE_KEY, Authorization: `Bearer ${env.SUPABASE_KEY}` } });
  const v = r.ok ? (await r.json())[0] : null;
  if (!v) return notFound();

  const site = env.SITE_NAME || 'Vidora', canon = url.origin + url.pathname;
  const desc = (v.description || `Tonton ${v.title} di ${site}. Konten dewasa 18+.`).slice(0, 160);
  const ld = JSON.stringify({ '@context': 'https://schema.org', '@type': 'VideoObject', name: v.title, description: desc,
    thumbnailUrl: v.thumbnail_url ? [v.thumbnail_url] : undefined, uploadDate: v.created_at, isFamilyFriendly: false }).replace(/</g, '\\u003c');
  const head = `<title>${esc(v.title)} - ${esc(site)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${esc(canon)}">` +
    `<meta property="og:title" content="${esc(v.title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:type" content="video.other">` +
    (v.thumbnail_url ? `<meta property="og:image" content="${esc(v.thumbnail_url)}">` : '') + `<script type="application/ld+json">${ld}</script>`;
  return html(page.replace('<title>Tonton Video</title>', '').replace('<!--SEO-->', head));
}
