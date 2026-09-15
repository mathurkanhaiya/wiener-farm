#!/usr/bin/env bash
set -euo pipefail

cd /opt/wiener-code
git fetch origin main

git show origin/main:scripts/patch-vps-v76c-user-bot-ui.py > /tmp/v76c.py
python3 -m py_compile /tmp/v76c.py

BACKEND=/opt/wiener-backend/server.mjs
if [[ ! -f "$BACKEND" && -f /opt/wiener-backend/server.js ]]; then BACKEND=/opt/wiener-backend/server.js; fi
[[ -f "$BACKEND" ]] || { echo 'ERROR: backend server file missing' >&2; exit 1; }

STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP="${BACKEND}.pre-v76c-user-ui-${STAMP}.bak"
cp "$BACKEND" "$BACKUP"

rollback(){
  cp "$BACKUP" "$BACKEND"
  pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
}
trap rollback ERR

python3 /tmp/v76c.py
node --check "$BACKEND"
grep -q 'WIENER USER BOT UI V76' "$BACKEND"
grep -q 'WIENER USER COMMAND SYNC OVERRIDE V76C' "$BACKEND"
grep -q "command:'rewards'" "$BACKEND"
grep -q "command:'network'" "$BACKEND"
grep -q "command:'progress'" "$BACKEND"

pm2 restart wiener-api --update-env
sleep 2
pm2 save >/dev/null

code=$(curl -sS -o /tmp/v76c-smoke.json -w '%{http_code}' -X POST \
  -H 'content-type: application/json' \
  --data '{}' \
  http://127.0.0.1:3000/functions/v1/wiener-bot-webhook || true)
if [[ "$code" == "000" || "$code" == "404" || "$code" == "502" ]]; then
  cat /tmp/v76c-smoke.json 2>/dev/null || true
  echo "ERROR: webhook smoke failed: HTTP $code" >&2
  exit 1
fi

trap - ERR

echo '=== V76C USER BOT UI READY ==='
echo "Protected webhook smoke: HTTP $code"
echo 'Run /syncbot once as admin to refresh Telegram visible user commands.'
