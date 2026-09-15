#!/usr/bin/env bash
set -Eeuo pipefail
CODE=/opt/wiener-code
SERVER=/opt/wiener-backend/server.mjs
[ -f "$SERVER" ] || SERVER=/opt/wiener-backend/server.js
[ -f "$SERVER" ] || { echo 'ERROR: backend file not found'; exit 1; }
cd "$CODE"

if ! grep -q 'WIENER GIVEAWAY STUDIO V89' "$SERVER"; then
  echo 'Giveaway Studio missing; installing compatibility build first...'
  bash scripts/install-vps-v89c-giveaway-compat.sh
fi

STAMP=$(date +%Y%m%d-%H%M%S)
cp -a "$SERVER" "$SERVER.before-v89d-$STAMP"
python3 scripts/patch-vps-v89d-giveaway-button.py
node --check "$SERVER"
pm2 restart wiener-api --update-env >/dev/null
pm2 save >/dev/null
sleep 2
curl -fsS http://127.0.0.1:3000/health; echo

echo '=== VERIFY V89D ==='
grep -n "GIVEAWAY STUDIO','gw89:home\|command:'giveaway'" "$SERVER" | head -10 || true
echo '=== V89D READY: Giveaway Studio button + /giveaway command ==='
echo 'If Telegram command menu was already cached, run /syncbot once or reopen the bot chat.'
