import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
export const SUPABASE_URL = "https://opdiyrmyerpzavhyngal.supabase.co";
export const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wZGl5cm15ZXJwemF2aHluZ2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM3Njg5NzksImV4cCI6MjEwOTM0NDk3OX0.1Er6QKx4MY36ftxU8yCT1BYs2g4FGLUfL0vt2gM7TDE";
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
export const SITE = "vidora-9ns";                    // ganti nama situs
export const CONTACT_EMAIL = "support.vidora@gmail.com"; // ganti: dipakai di halaman Syarat, Privasi, Laporan
export const PAGE_SIZE = 24;
