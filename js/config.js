import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
export const SUPABASE_URL = "https://opdiyrmyerpzavhyngal.supabase.co";
export const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wZGl5cm15ZXJwemF2aHluZ2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM3Njg5NzksImV4cCI6MjEwOTM0NDk3OX0.1Er6QKx4MY36ftxU8yCT1BYs2g4FGLUfL0vt2gM7TDE";
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
export const SITE = "vidora-9ns";                    // ganti nama situs
export const CONTACT_EMAIL = "support.vidora@gmail.com"; // ganti: dipakai di halaman Syarat, Privasi, Laporan
export const PAGE_SIZE = 24;

// Iklan video VAST (pre-roll), satu iklan per video yang dibuka. Kosongkan "" untuk mematikan.
// UTAMA (Hilltop): tampil di SETIAP video yang baru dibuka, tanpa jeda.
export const AD_VAST_PRIMARY = "https://gregariousstretch.com/dxmLF.zddyG/Nkv/ZuG/Ug/FemmS9Yu/Z/U/ljk/PNT/cf2/M/D/YCxsOtDPU_tuNyz/Y-w/NOjVE/4qOOQs";

// Tautan sosial (tampil di footer semua halaman). Kosongkan "" / [] untuk menyembunyikan.
export const TELEGRAM_URL = "https://t.me/viral_lokalid";   // contoh: "https://t.me/namachannel"
export const X_ACCOUNTS = [       // contoh: { name: "@akun1", url: "https://x.com/akun1" }
   { name: "AyuMood", url: "https://x.com/AyuMoodvc5" },
  // { name: "@akun2", url: "https://x.com/akun2" },
];
