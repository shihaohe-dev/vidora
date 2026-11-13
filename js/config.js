// Klien Supabase: memakai salinan lokal js/vendor/supabase.js bila ada (disarankan, lihat PANDUAN_PEMASANGAN.md),
// jika belum ada akan memakai esm.sh (pihak ketiga) sebagai cadangan.
let createClient;
try { ({ createClient } = await import('./vendor/supabase.js')); }
catch { ({ createClient } = await import('https://esm.sh/@supabase/supabase-js@2.38.0')); }
export const SUPABASE_URL = "https://opdiyrmyerpzavhyngal.supabase.co";
export const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wZGl5cm15ZXJwemF2aHluZ2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM3Njg5NzksImV4cCI6MjEwOTM0NDk3OX0.1Er6QKx4MY36ftxU8yCT1BYs2g4FGLUfL0vt2gM7TDE";
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
export const SITE = "Vidora";                         // nama situs (logo, judul, footer)
export const CONTACT_EMAIL = "support.vidora@gmail.com"; // ganti: dipakai di halaman Syarat, Privasi, Laporan
export const PAGE_SIZE = 24;
export const OPERATOR_NAME = "Pengelola Vidora";   // ganti: nama pengelola situs (tampil di Syarat & Privasi)

// Cloudflare Turnstile (captcha untuk form laporan). Isi Site Key bila dipakai; kosong = tanpa captcha (batas laju tetap aktif).
export const TURNSTILE_SITE_KEY = "";

// Daftar domain yang boleh dipakai untuk video embed/iframe. Kosong [] = semua domain https boleh.
// Disarankan diisi, mis. ["drive.google.com", "streamtape.com"]. Daftar domain yang sedang dipakai: lihat PANDUAN_PEMASANGAN.md.
export const EMBED_ALLOW = [];

// Batas frekuensi iklan pre-roll: jeda minimal (menit) antar iklan per perangkat. 0 = iklan di setiap video (perilaku lama).
export const AD_FREQ_CAP_MIN = 0;

// Iklan video VAST (Hilltop, pre-roll), tampil di SETIAP video yang baru dibuka. Kosongkan "" untuk mematikan.
export const AD_VAST_PRIMARY = "https://gregariousstretch.com/dxmLF.zddyG/Nkv/ZuG/Ug/FemmS9Yu/Z/U/ljk/PNT/cf2/M/D/YCxsOtDPU_tuNyz/Y-w/NOjVE/4qOOQs";

// Iklan cadangan (ExoClick, format VAST). Dipakai otomatis bila VAST utama kosong/gagal dimuat. Isi dengan URL VAST dari panel ExoClick; kosongkan "" untuk mematikan.
export const AD_VAST_BACKUP = "";

// Tautan sosial (tampil di footer semua halaman). Kosongkan "" / [] untuk menyembunyikan.
export const TELEGRAM_URL = "https://t.me/viral_lokalid";   // contoh: "https://t.me/namachannel"
export const X_ACCOUNTS = [       // contoh: { name: "@akun1", url: "https://x.com/akun1" }
   { name: "AyuMood", url: "https://x.com/AyuMoodvc5" },
  // { name: "@akun2", url: "https://x.com/akun2" },
];
