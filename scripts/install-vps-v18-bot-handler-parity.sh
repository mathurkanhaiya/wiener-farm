#!/usr/bin/env bash
set -euo pipefail

cd /opt/wiener-code
BACKEND=/opt/wiener-backend/server.mjs
STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP="/opt/wiener-backend/server.mjs.v18-${STAMP}.bak"

cp "$BACKEND" "$BACKUP"
python3 scripts/patch-vps-v18-bot-handler-parity.py

if ! node --check "$BACKEND" >/tmp/wiener-v18-nodecheck.txt 2>&1; then
  cat /tmp/wiener-v18-nodecheck.txt
  cp "$BACKUP" "$BACKEND"
  echo 'ERROR: JS syntax check failed; backend restored.' >&2
  exit 1
fi

pm2 restart wiener-api --update-env
sleep 2
pm2 save

code=$(curl -sS -o /tmp/v18-smoke.json -w '%{http_code}' -X POST \
  -H 'content-type: application/json' \
  --data '{}' \
  http://127.0.0.1:3000/functions/v1/wiener-bot-webhook || true)
if [[ "$code" == "000" || "$code" == "404" || "$code" == "502" ]]; then
  cat /tmp/v18-smoke.json 2>/dev/null || true
  echo "ERROR: webhook route smoke failed: HTTP $code" >&2
  exit 1
fi

echo '=== V18 BOT HANDLER PARITY INSTALLED ==='
echo "Webhook protected smoke: HTTP $code"
echo 'Restored: user menu commands/callbacks, leaderboard, admin dashboard/callbacks, user lookup, balance admin actions, ban/unban, guided broadcast, bot command/menu sync.'
echo 'Existing VPS payout handler remains authoritative; no payout was executed.'
echo 'Run /syncbot once in Telegram as admin, then test /menu /admin /user <UID> /pay /broadcast.'
