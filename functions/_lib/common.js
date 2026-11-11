// Utilitas bersama untuk Cloudflare Pages Functions.
// Catatan: file _headers TIDAK berlaku untuk respons Function, jadi header keamanan dipasang di sini.
export const SB_URL_DEFAULT = 'https://opdiyrmyerpzavhyngal.supabase.co';
// Kunci anon bersifat publik (aman ada di kode). JANGAN pernah menaruh service_role di sini.
export const SB_ANON_DEFAULT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wZGl5cm15ZXJwemF2aHluZ2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM3Njg5NzksImV4cCI6MjEwOTM0NDk3OX0.1Er6QKx4MY36ftxU8yCT1BYs2g4FGLUfL0vt2gM7TDE';

export const sbUrl = env => env.SUPABASE_URL || SB_URL_DEFAULT;
export const sbAnon = env => env.SUPABASE_ANON_KEY || env.SUPABASE_KEY || SB_ANON_DEFAULT;

export const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'DENY',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  'strict-transport-security': 'max-age=31536000',
};

// CSP untuk halaman HTML dari Function (/v/*). Harus sama dengan di _headers. Mode Report-Only: ganti nama header ke 'content-security-policy' saat siap enforce.
export const CSP = "default-src 'self'; script-src 'self' https://esm.sh https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; media-src 'self' blob: https:; frame-src https:; connect-src 'self' https: wss://opdiyrmyerpzavhyngal.supabase.co; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";
export const withSec = (headers = {}) => ({ ...SECURITY_HEADERS, ...headers });

export const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status, headers: withSec({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }),
});

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Hash IP + garam agar IP mentah tidak pernah disimpan.
export async function visitorHash(request, env) {
  if (typeof env.HASH_SALT !== 'string' || env.HASH_SALT.length < 32) {
    throw Object.assign(new Error('HASH_SALT belum dikonfigurasi dengan benar'), { status: 503 });
  }

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const data = new TextEncoder().encode(env.HASH_SALT + '|' + ip);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 40);
}

// Permintaan tulis hanya diterima dari origin situs sendiri (menyaring penyalahgunaan dari situs lain).
export function sameOrigin(request) {
  const o = request.headers.get('Origin');
  if (!o) return false;
  try { return new URL(o).origin === new URL(request.url).origin; } catch { return false; }
}

export async function readJson(request, maxBytes = 8192) {
  const txt = await request.text();
  if (txt.length > maxBytes) throw Object.assign(new Error('terlalu besar'), { status: 413 });
  try { return JSON.parse(txt); } catch { throw Object.assign(new Error('JSON tidak valid'), { status: 400 }); }
}

// Panggil fungsi Postgres (RPC) dengan service_role. Kunci ini RAHASIA: hanya dari env Cloudflare.
export async function rpc(env, name, args) {
  const key = env.SUPABASE_SERVICE_KEY;
  if (!key) throw Object.assign(new Error('SUPABASE_SERVICE_KEY belum diisi'), { status: 503 });
  const r = await fetch(`${sbUrl(env)}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(6000),
  });
  if (!r.ok) throw Object.assign(new Error(`rpc ${name} gagal: ${r.status}`), { status: 502 });
  return r.json();
}

// Cloudflare Turnstile (opsional): bila TURNSTILE_SECRET kosong, pemeriksaan dilewati.
export async function turnstileOk(env, token, request) {
  if (!env.TURNSTILE_SECRET) return true;
  if (!token || typeof token !== 'string') return false;
  const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token });
  const ip = request.headers.get('CF-Connecting-IP'); if (ip) body.set('remoteip', ip);
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body, signal: AbortSignal.timeout(5000) });
    return !!(await r.json()).success;
  } catch { return false; }
}
