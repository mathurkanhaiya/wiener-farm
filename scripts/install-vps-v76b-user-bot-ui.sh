#!/usr/bin/env bash
set -euo pipefail

cd /opt/wiener-code
git fetch origin main

BACKEND=/opt/wiener-backend/server.mjs
if [[ ! -f "$BACKEND" && -f /opt/wiener-backend/server.js ]]; then BACKEND=/opt/wiener-backend/server.js; fi
[[ -f "$BACKEND" ]] || { echo 'ERROR: backend server file missing' >&2; exit 1; }

STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP="${BACKEND}.pre-v76b-user-ui-${STAMP}.bak"
PRE=/tmp/wiener-v76b-anchor.py
PATCH=/tmp/wiener-v76-user-ui.py

cp "$BACKEND" "$BACKUP"
git show origin/main:scripts/patch-vps-v76b-user-command-anchor.py > "$PRE"
git show origin/main:scripts/patch-vps-v76-user-bot-ui.py > "$PATCH"
python3 -m py_compile "$PRE" "$PATCH"

rollback(){
  cp "$BACKUP" "$BACKEND"
  pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
}
trap rollback ERR

python3 "$PRE"
python3 "$PATCH"

node --check "$BACKEND"
grep -q 'WIENER USER BOT UI V76' "$BACKEND"
grep -q "command:'rewards'" "$BACKEND"
grep -q "command:'network'" "$BACKEND"
grep -q "command:'progress'" "$BACKEND"
grep -q "command:'profile',description:'VIP profile card'" "$BACKEND"

pm2 restart wiener-api --update-env
sleep 2
pm2 save >/dev/null

code=$(curl -sS -o /tmp/v76b-smoke.json -w '%{http_code}' -X POST \
  -H 'content-type: application/json' \
  --data '{}' \
  http://127.0.0.1:3000/functions/v1/wiener-bot-webhook || true)
if [[ "$code" == "000" || "$code" == "404" || "$code" == "502" ]]; then
  cat /tmp/v76b-smoke.json 2>/dev/null || true
  echo "ERROR: webhook smoke failed: HTTP $code" >&2
  exit 1
fi

trap - ERR

echo '=== V76B USER BOT UI READY ==='
echo "Protected webhook smoke: HTTP $code"
echo 'Visible user commands: /start /wallet /rewards /network /progress /activity /status /profile /help'
echo 'VIP profile/card/stats handlers remain in backend; admin and legacy handlers unchanged.'
echo 'Run /syncbot once as admin to refresh Telegram command menu.'
