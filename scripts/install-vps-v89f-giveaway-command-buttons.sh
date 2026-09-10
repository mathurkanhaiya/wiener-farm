#!/usr/bin/env bash
set -Eeuo pipefail
CODE=/opt/wiener-code
SERVER=/opt/wiener-backend/server.mjs
[ -f "$SERVER" ] || SERVER=/opt/wiener-backend/server.js
[ -f "$SERVER" ] || { echo 'ERROR: backend file not found'; exit 1; }
cd "$CODE"

echo '=== V89F GIVEAWAY COMMAND BUTTON FIX ==='
grep -q 'WIENER GIVEAWAY STUDIO V89' "$SERVER" || { echo 'ERROR: Giveaway Studio V89 is not installed'; exit 1; }
STAMP=$(date +%Y%m%d-%H%M%S)
cp -a "$SERVER" "$SERVER.before-v89f-$STAMP"
python3 scripts/patch-vps-v89f-giveaway-command-buttons.py
node --check "$SERVER"
pm2 restart wiener-api --update-env >/dev/null
pm2 save >/dev/null
sleep 2
curl -fsS http://127.0.0.1:3000/health; echo

echo '=== VERIFY V89F ==='
grep -n 'V89F COMMAND BUTTON FIX' "$SERVER" | head -2
echo '=== V89F READY: /giveaway inline buttons fixed ==='
