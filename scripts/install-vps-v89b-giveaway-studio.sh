#!/usr/bin/env bash
set -Eeuo pipefail
CODE=/opt/wiener-code
SERVER=/opt/wiener-backend/server.mjs
[ -f "$SERVER" ] || SERVER=/opt/wiener-backend/server.js
[ -f "$SERVER" ] || { echo 'ERROR: backend file not found'; exit 1; }
cd "$CODE"

if ! grep -q 'WIENER GIVEAWAY STUDIO V89' "$SERVER"; then
  bash scripts/install-vps-v89-giveaway-studio.sh
fi

STAMP=$(date +%Y%m%d-%H%M%S)
cp -a "$SERVER" "$SERVER.before-v89b-$STAMP"
python3 scripts/patch-vps-v89b-giveaway-hardening.py
node --check "$SERVER"
pm2 restart wiener-api --update-env >/dev/null
pm2 save >/dev/null
sleep 2
curl -fsS http://127.0.0.1:3000/health; echo

echo '=== VERIFY GIVEAWAY STUDIO ==='
grep -n 'WIENER GIVEAWAY STUDIO V89' "$SERVER" | head -3
runuser -u postgres -- psql -d wiener_farm_final -P pager=off -c "select table_name from information_schema.tables where table_schema='public' and table_name in ('giveaway_campaigns','giveaway_entries','giveaway_rewards','giveaway_admin_sessions','giveaway_audit') order by table_name;"
echo '=== READY: /giveaway Giveaway Studio ==='
