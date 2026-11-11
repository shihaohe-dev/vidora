#!/usr/bin/env bash
# Membuat salinan lokal supabase-js (menghilangkan ketergantungan ke esm.sh). Jalankan dari folder utama proyek:
#   bash tools/vendor-supabase.sh
# Butuh Node.js 18+ dan internet. Hasil: js/vendor/supabase.js (commit file ini).
set -euo pipefail
ROOT="$(pwd)"; TMP="$(mktemp -d)"
cd "$TMP"
npm init -y >/dev/null
npm i @supabase/supabase-js@2.38.0 esbuild >/dev/null
echo "export { createClient } from '@supabase/supabase-js';" > entry.js
npx esbuild entry.js --bundle --format=esm --minify --outfile="$ROOT/js/vendor/supabase.js" --mkdir 2>/dev/null || { mkdir -p "$ROOT/js/vendor"; npx esbuild entry.js --bundle --format=esm --minify --outfile="$ROOT/js/vendor/supabase.js"; }
echo "OK: js/vendor/supabase.js dibuat. Setelah deploy, hapus 'https://esm.sh' dari CSP di _headers."
