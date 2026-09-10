#!/usr/bin/env bash
set -Eeuo pipefail
CODE=/opt/wiener-code
SERVER=/opt/wiener-backend/server.mjs
[ -f "$SERVER" ] || SERVER=/opt/wiener-backend/server.js
[ -f "$SERVER" ] || { echo 'ERROR: backend file not found'; exit 1; }
cd "$CODE"

echo '=== V89E GIVEAWAY BUTTON FIX ==='
grep -q 'WIENER GIVEAWAY STUDIO V89' "$SERVER" || { echo 'ERROR: V89 Giveaway Studio is not installed'; exit 1; }
STAMP=$(date +%Y%m%d-%H%M%S)
cp -a "$SERVER" "$SERVER.before-v89e-$STAMP"
python3 scripts/patch-vps-v89e-giveaway-reply-markup.py
node --check "$SERVER"
pm2 restart wiener-api --update-env >/dev/null
pm2 save >/dev/null
sleep 2
curl -fsS http://127.0.0.1:3000/health; echo

echo '=== VERIFY V89E ==='
grep -n 'WIENER GIVEAWAY STUDIO V89E REPLY MARKUP FIX' "$SERVER" | head -1
echo '=== V89E READY: Giveaway Studio buttons restored ==='
