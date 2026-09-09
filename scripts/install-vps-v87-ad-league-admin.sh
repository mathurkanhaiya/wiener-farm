#!/usr/bin/env bash
set -Eeuo pipefail

CODE=/opt/wiener-code
SERVER=/opt/wiener-backend/server.mjs
[ -f "$SERVER" ] || SERVER=/opt/wiener-backend/server.js
[ -f "$SERVER" ] || { echo 'ERROR: backend file not found'; exit 1; }
cd "$CODE"
STAMP=$(date +%Y%m%d-%H%M%S)
cp -a "$SERVER" "$SERVER.before-v87-$STAMP"

echo '=== V87 PRECHECK ==='
if ! grep -q 'WIENER WEEKLY AD LEAGUE V86' "$SERVER"; then
  echo 'V86 backend missing; installing V86 first...'
  bash scripts/install-vps-v86-ad-league.sh
fi

echo '=== V87 DATABASE SETTINGS ==='
runuser -u postgres -- psql -d wiener_farm_final -v ON_ERROR_STOP=1 <<'SQL'
-- This launch starts late in the week, so use a 60% partial-week pool now.
-- Future Monday-created leagues remain 50,000 WIENER by V86 defaults.
update public.wiener_ad_leagues
set prize_pool=30000
where week_start=((now() at time zone 'utc')::date - (((extract(dow from now() at time zone 'utc')::int + 6) % 7)))
  and status='active'
  and finalized_at is null;
SQL

echo '=== V87 BACKEND ==='
WIENER_BACKEND_FILE="$SERVER" python3 scripts/patch-vps-v87-ad-league-admin.py
node --check "$SERVER"
pm2 restart wiener-api --update-env >/dev/null
pm2 save >/dev/null
sleep 2
curl -fsS http://127.0.0.1:3000/health; echo

echo '=== VERIFY V87 ==='
runuser -u postgres -- psql -d wiener_farm_final -P pager=off -c "select week_start,week_end,status,prize_pool,daily_target,daily_bonus,streak_bonus,enabled from public.wiener_ad_leagues order by week_start desc limit 3;"
echo 'Current partial week should show 30000. Next Monday-created week uses 50000.'
echo '=== V87 AD LEAGUE READY ==='
