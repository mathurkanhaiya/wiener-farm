#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=/opt/wiener-code
DB=wiener_farm_final
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKEND=/opt/wiener-backend/server.js
if [[ ! -f "$BACKEND" ]]; then
  PM2_BACKEND="$(pm2 jlist 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{try{const a=JSON.parse(s);const p=a.find(x=>x.name==='wiener-api');process.stdout.write(p?.pm2_env?.pm_exec_path||'')}catch{}})" || true)"
  if [[ -n "$PM2_BACKEND" && -f "$PM2_BACKEND" ]]; then BACKEND="$PM2_BACKEND"; fi
fi
if [[ ! -f "$BACKEND" && -f /opt/wiener-backend/server.mjs ]]; then BACKEND=/opt/wiener-backend/server.mjs; fi
export WIENER_BACKEND_FILE="$BACKEND"
BACKUP="${BACKEND}.v25-backup-${STAMP}"

echo '=== V25 BOT ALERT CENTER PRECHECK ==='
echo "backend_file=$BACKEND"
[[ -f "$BACKEND" ]] || { echo 'ERROR: live backend file not found'; exit 1; }
[[ -f "$ROOT/scripts/patch-vps-v25-bot-alert-center.py" ]] || { echo 'ERROR: V25 patcher missing'; exit 1; }
python3 -m py_compile "$ROOT/scripts/patch-vps-v25-bot-alert-center.py"
node --check "$BACKEND"
grep -q 'handleAdminParityV19' "$BACKEND" || { echo 'ERROR: V19 admin/bot parity is not installed'; exit 1; }
echo 'precheck=PASS'

echo '=== DRY-RUN PATCH ON TEMP COPY ==='
DRYRUN="/tmp/wiener-v25-dryrun-$STAMP.js"
cp -a "$BACKEND" "$DRYRUN"
WIENER_BACKEND_FILE="$DRYRUN" python3 "$ROOT/scripts/patch-vps-v25-bot-alert-center.py"
node --check "$DRYRUN"
rm -f "$DRYRUN"
echo 'dry_run=PASS'

echo '=== INSTALL ALERT PREFERENCES + STATE ==='
runuser -u postgres -- psql -d "$DB" -v ON_ERROR_STOP=1 <<'SQL'
create table if not exists public.wiener_alert_preferences(
  telegram_id bigint primary key,
  user_farm_ready boolean not null default true,
  user_daily_reminder boolean not null default true,
  user_referral_rewards boolean not null default true,
  user_new_tasks boolean not null default true,
  user_promotions boolean not null default false,
  admin_withdrawals boolean not null default true,
  admin_fraud boolean not null default true,
  admin_treasury boolean not null default true,
  admin_ads boolean not null default true,
  admin_tasks boolean not null default true,
  admin_ambassador boolean not null default true,
  admin_system boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wiener_alert_state(
  state_key text primary key,
  state_value text,
  updated_at timestamptz not null default now()
);

insert into public.wiener_alert_state(state_key,state_value)
values('installed_at',now()::text)
on conflict(state_key) do nothing;

create index if not exists idx_wiener_alert_preferences_updated
  on public.wiener_alert_preferences(updated_at);
SQL

NOTIF="$(runuser -u postgres -- psql -d "$DB" -Atqc "select to_regclass('public.notification_log')")"
[[ "$NOTIF" == "notification_log" ]] || { echo 'ERROR: notification_log table is missing'; exit 1; }

cp -a "$BACKEND" "$BACKUP"
rollback(){
  echo 'ERROR: V25 install failed; restoring backend backup.'
  cp -a "$BACKUP" "$BACKEND" || true
  node --check "$BACKEND" || true
  pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
}
trap rollback ERR

echo '=== PATCH BOT + CRON ALERT ENGINE ==='
python3 "$ROOT/scripts/patch-vps-v25-bot-alert-center.py"
node --check "$BACKEND"

echo '=== RESTART API ==='
pm2 restart wiener-api --update-env
pm2 save >/dev/null
sleep 2

echo '=== VERIFY ==='
node --check "$BACKEND"
grep -q 'WIENER BOT ALERT CENTER V25' "$BACKEND"
runuser -u postgres -- psql -d "$DB" -P pager=off -c "
select
  to_regclass('public.wiener_alert_preferences') as preferences,
  to_regclass('public.wiener_alert_state') as alert_state,
  (select state_value from public.wiener_alert_state where state_key='installed_at') as installed_at;
"

WEBHOOK="$(curl -sS -o /tmp/wiener-v25-webhook.txt -w '%{http_code}' -X POST http://127.0.0.1:3000/functions/v1/wiener-bot-webhook -H 'content-type: application/json' -d '{}' || true)"
echo "webhook_without_secret_http=$WEBHOOK"
if [[ "$WEBHOOK" == "000" || "$WEBHOOK" == "404" || "$WEBHOOK" == "502" ]]; then
  echo 'ERROR: webhook route is not healthy after V25.'
  exit 1
fi

trap - ERR
echo '=== V25 BOT ALERT CENTER INSTALLED ==='
echo 'User optional alerts: farm, daily, referrals, tasks, promotions.'
echo 'User transactional alerts remain mandatory.'
echo 'Admin alerts: withdrawals, fraud, payout failures, treasury, AdsGram, tasks, ambassador, TON scanner.'
echo 'Existing farm/daily/referral/task reminder scheduler is preserved.'
echo 'Critical payout/security alerts cannot be muted.'
echo 'No balances, withdrawals, payout settings, wallet secrets, or reward amounts were modified.'
