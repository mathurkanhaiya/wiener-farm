#!/usr/bin/env bash
set -Eeuo pipefail

CODE=/opt/wiener-code
SERVER=/opt/wiener-backend/server.mjs
[ -f "$SERVER" ] || SERVER=/opt/wiener-backend/server.js
[ -f "$SERVER" ] || { echo 'ERROR: backend file not found'; exit 1; }

cd "$CODE"
STAMP=$(date +%Y%m%d-%H%M%S)
cp -a "$SERVER" "$SERVER.before-v85-$STAMP"

echo '=== INSTALL V85 TOTAL LEADERBOARDS ==='
WIENER_BACKEND_FILE="$SERVER" python3 scripts/patch-vps-v85-total-leaderboards.py
node --check "$SERVER"
pm2 restart wiener-api --update-env >/dev/null
pm2 save >/dev/null
sleep 2
curl -fsS http://127.0.0.1:3000/health; echo

echo '=== VERIFY LEADERBOARD SOURCE COLUMNS ==='
runuser -u postgres -- psql -d wiener_farm_final -P pager=off -c "
select telegram_id,username,referrals_count,total_earned
from public.users
where coalesce(is_banned,false)=false
order by referrals_count desc nulls last
limit 5;"

echo
runuser -u postgres -- psql -d wiener_farm_final -P pager=off -c "
select telegram_id,username,referrals_count,total_earned
from public.users
where coalesce(is_banned,false)=false
order by total_earned desc nulls last
limit 5;"

echo '=== V85 DONE ==='
