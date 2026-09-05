#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=/opt/wiener-code
BACKEND=/opt/wiener-backend/server.js
DB=wiener_farm_final
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/opt/wiener-backend/server.js.v24-backup-$STAMP"

echo '=== V24 WITHDRAW AD UNLOCK PRECHECK ==='
test -f "$BACKEND"
test -f "$ROOT/scripts/patch-vps-v24-withdraw-ad-unlock.py"
node --check "$BACKEND"

echo '=== INSTALL DATABASE SESSION LEDGER ==='
runuser -u postgres -- psql -d "$DB" -v ON_ERROR_STOP=1 <<'SQL'
create extension if not exists pgcrypto;
create table if not exists public.withdraw_ad_sessions(
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null,
  day date not null default ((now() at time zone 'utc')::date),
  block_id text not null default 'int-44861',
  status text not null default 'started',
  counted boolean not null default false,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_withdraw_ad_sessions_user_day
  on public.withdraw_ad_sessions(telegram_id,day,counted);
create unique index if not exists uq_withdraw_ad_one_active
  on public.withdraw_ad_sessions(telegram_id)
  where status='started';
SQL

cp -a "$BACKEND" "$BACKUP"

rollback(){
  echo 'ERROR: V24 install failed; restoring backend backup.'
  cp -a "$BACKUP" "$BACKEND" || true
  node --check "$BACKEND" || true
  pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
}
trap rollback ERR

echo '=== PATCH TON WITHDRAW ROUTE ==='
python3 "$ROOT/scripts/patch-vps-v24-withdraw-ad-unlock.py"
node --check "$BACKEND"

echo '=== RESTART API ==='
pm2 restart wiener-api --update-env
pm2 save >/dev/null
sleep 2

echo '=== VERIFY DATABASE + ROUTE ==='
runuser -u postgres -- psql -d "$DB" -P pager=off -c "
select
  to_regclass('public.withdraw_ad_sessions') as session_table,
  count(*) filter (where counted=true and day=(now() at time zone 'utc')::date) as counted_today
from public.withdraw_ad_sessions;
"
STATUS="$(curl -sS -o /tmp/wiener-v24-smoke.txt -w '%{http_code}' -X POST http://127.0.0.1:3000/functions/v1/wiener-ton-wallet -H 'content-type: application/json' -d '{}' || true)"
echo "local_route_http=$STATUS"
if [[ "$STATUS" == "000" || "$STATUS" == "404" || "$STATUS" == "502" ]]; then
  echo 'Route smoke failed.'
  exit 1
fi

trap - ERR
echo '=== V24 WITHDRAW AD UNLOCK INSTALLED ==='
echo 'Requirement: 5 counted sponsor ads per UTC day.'
echo 'AdsGram block: int-44861'
echo 'Minimum elapsed view time before count: 15 seconds.'
echo 'Withdrawal endpoint enforces the requirement server-side.'
echo 'No balances, payout amounts, or existing withdrawals were modified.'
