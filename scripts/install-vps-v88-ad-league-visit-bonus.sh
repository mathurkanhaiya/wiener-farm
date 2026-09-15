#!/usr/bin/env bash
set -Eeuo pipefail
CODE=/opt/wiener-code
SERVER=/opt/wiener-backend/server.mjs
[ -f "$SERVER" ] || SERVER=/opt/wiener-backend/server.js
[ -f "$SERVER" ] || { echo 'ERROR: backend file not found'; exit 1; }
cd "$CODE"
STAMP=$(date +%Y%m%d-%H%M%S)
cp -a "$SERVER" "$SERVER.before-v88-$STAMP"

echo '=== V88 PRECHECK ==='
if ! grep -q 'WIENER WEEKLY AD LEAGUE V87 ADMIN' "$SERVER"; then
  echo 'V87 missing; installing V87 first...'
  bash scripts/install-vps-v87-ad-league-admin.sh
fi

echo '=== V88 DATABASE ==='
runuser -u postgres -- psql -d wiener_farm_final -v ON_ERROR_STOP=1 <<'SQL'
alter table public.wiener_ad_league_events add column if not exists interaction_qualified boolean not null default false;
alter table public.wiener_ad_league_events add column if not exists bonus_points int not null default 0;
create index if not exists wiener_ad_league_events_visit_idx on public.wiener_ad_league_events(week_start,telegram_id,interaction_qualified);
-- Keep this late-start launch week reduced. Future Monday weeks are still created at 50,000.
update public.wiener_ad_leagues set prize_pool=30000
where week_start=((now() at time zone 'utc')::date - (((extract(dow from now() at time zone 'utc')::int + 6) % 7)))
  and status='active' and finalized_at is null;
SQL

echo '=== V88 BACKEND ==='
WIENER_BACKEND_FILE="$SERVER" python3 scripts/patch-vps-v88-ad-league-visit-bonus.py
node --check "$SERVER"
pm2 restart wiener-api --update-env >/dev/null
pm2 save >/dev/null
sleep 2
curl -fsS http://127.0.0.1:3000/health; echo

echo '=== VERIFY V88 ==='
runuser -u postgres -- psql -d wiener_farm_final -P pager=off -c "select week_start,week_end,status,prize_pool,enabled from public.wiener_ad_leagues order by week_start desc limit 3;"
runuser -u postgres -- psql -d wiener_farm_final -P pager=off -c "select column_name,data_type,column_default from information_schema.columns where table_schema='public' and table_name='wiener_ad_league_events' and column_name in ('interaction_qualified','bonus_points') order by column_name;"
echo '=== V88 READY: valid ad +1, qualified 5s visit +2 ==='
