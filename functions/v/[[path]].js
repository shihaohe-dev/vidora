// Menyisipkan title, description, canonical, dan JSON-LD ke halaman video agar bisa diindeks Google.
// Tahan galat: bila apa pun gagal, halaman tetap tampil (tanpa SEO tambahan) dan tidak pernah memicu Error 1101.
const SB_URL = 'https://opdiyrmyerpzavhyngal.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wZGl5cm15ZXJwemF2aHluZ2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM3Njg5NzksImV4cCI6MjEwOTM0NDk3OX0.1Er6QKx4MY36ftxU8yCT1BYs2g4FGLUfL0vt2gM7TDE';
const FALLBACK = '<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Tonton Video</title><!--SEO--><link rel="stylesheet" href="/css/style.css"></head><body><main class="wrap detail"><a class="back" href="/">‹ Kembali</a><div id="watch"></div><section id="related" hidden><h2 class="h2">Video lainnya</h2><div id="related-grid" class="grid"></div></section></main><script type="module" src="/js/watch.js"></script></body></html>';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const html = (body, status = 200, cache = 'no-store') => new Response(body, { status, headers: { 'content-type': 'text/html;charset=utf-8', 'cache-control': cache } });

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  let page = FALLBACK;
  try {
    const r = await env.ASSETS.fetch(new URL('/watch', url).toString());
    const t = r.ok ? await r.text() : '';
    if (t.includes('<!--SEO-->')) page = t;
  } catch {}

  try {
    const id = url.pathname.slice(-36);
    if (!/^[0-9a-f-]{36}$/i.test(id)) return html(page.replace('<!--SEO-->', '<meta name="robots" content="noindex">'), 404);

    const base = env.SUPABASE_URL || SB_URL, key = env.SUPABASE_KEY || SB_KEY;
    const r = await fetch(`${base}/rest/v1/site_videos?id=eq.${id}&status=eq.published&select=title,description,thumbnail_url,created_at`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(4000) });
    if (!r.ok) return html(page);                                   // database bermasalah: tampilkan halaman biasa
    const v = (await r.json())[0];
    if (!v) return html(page.replace('<!--SEO-->', '<meta name="robots" content="noindex">'), 404);

    const site = env.SITE_NAME || 'Vidora', canon = url.origin + url.pathname;
    const desc = (v.description || `Tonton ${v.title} di ${site}. Konten dewasa 18+.`).slice(0, 160);
    const ld = !v.thumbnail_url ? '' : JSON.stringify({ '@context': 'https://schema.org', '@type': 'VideoObject', name: v.title, description: desc,
      thumbnailUrl: [v.thumbnail_url], uploadDate: v.created_at, isFamilyFriendly: false }).replace(/</g, '\\u003c');
    const head = `<title>${esc(v.title)} - ${esc(site)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${esc(canon)}">` +
      `<meta property="og:title" content="${esc(v.title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:type" content="video.other">` +
      (v.thumbnail_url ? `<meta property="og:image" content="${esc(v.thumbnail_url)}">` : '') + (ld ? `<script type="application/ld+json">${ld}</script>` : '');
    return html(page.replace('<title>Tonton Video</title>', '').replace('<!--SEO-->', head), 200, 'public, max-age=300');
  } catch {
    return html(page);
  }
}
