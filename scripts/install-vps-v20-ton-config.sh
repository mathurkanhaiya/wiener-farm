#!/usr/bin/env bash
set -euo pipefail
cd /opt/wiener-code
BACKEND=/opt/wiener-backend/server.mjs
DB=wiener_farm_final
STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP="/opt/wiener-backend/server.mjs.v20-${STAMP}.bak"

[[ -f "$BACKEND" ]] || { echo 'ERROR: backend server.mjs not found' >&2; exit 1; }

echo '=== ENSURE V19C BOT/ADMIN PARITY IS HEALTHY ==='
bash scripts/install-vps-v19c-admin-parity.sh
node --check "$BACKEND"

cp "$BACKEND" "$BACKUP"
rollback(){
  echo 'ERROR: V20 install failed; restoring syntax-valid backend backup.' >&2
  cp "$BACKUP" "$BACKEND"
  if node --check "$BACKEND" >/dev/null 2>&1; then
    pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
  fi
}
trap rollback ERR

echo '=== TON TREASURY CONFIG DATABASE ==='
runuser -u postgres -- psql -d "$DB" -v ON_ERROR_STOP=1 <<'SQL'
alter table public.app_settings add column if not exists ton_treasury_scan_enabled boolean not null default true;
alter table public.app_settings add column if not exists ton_treasury_scan_interval_minutes integer not null default 2;
alter table public.app_settings add column if not exists ton_treasury_last_scan_at timestamptz;
alter table public.app_settings add column if not exists ton_treasury_last_scan_error text;
alter table public.app_settings add column if not exists ton_treasury_autopay_enabled boolean not null default false;
alter table public.app_settings add column if not exists ton_treasury_autopay_max_ton numeric(18,9) not null default 0.100000000;
alter table public.app_settings add column if not exists ton_treasury_autopay_daily_cap_ton numeric(18,9) not null default 1.000000000;
alter table public.app_settings add column if not exists ton_treasury_autopay_risk_max integer not null default 20;
alter table public.app_settings add column if not exists ton_treasury_last_autopay_at timestamptz;
alter table public.app_settings add column if not exists ton_treasury_last_autopay_error text;

create table if not exists public.ton_treasury_autopay_guard(
  withdrawal_id text primary key,
  telegram_id bigint,
  amount_ton numeric(18,9),
  status text not null default 'processing',
  attempted_at timestamptz not null default now(),
  finished_at timestamptz,
  error text
);
create index if not exists ton_treasury_autopay_guard_attempted_idx on public.ton_treasury_autopay_guard(attempted_at desc);

-- Never arm automatic transfers just because a migration ran.
update public.app_settings
set ton_treasury_autopay_enabled=false
where id=true and ton_treasury_last_autopay_at is null;
SQL

echo '=== INSTALL /CONFIG + TON AUTO SCAN/AUTOPAY ==='
python3 scripts/patch-vps-v20-ton-config.py

echo '=== PRE-RESTART SYNTAX + STATIC SAFETY GATE ==='
node --check "$BACKEND"
for x in \
  'WIENER VPS TON TREASURY CONFIG V20' \
  'handleTonConfigV20' \
  "cmd" \
  'cfg20:autopay_confirm' \
  'runTonTreasuryAuto20' \
  'ton_treasury_autopay_guard' \
  'no_auto_retry' \
  'treasuryTonScan19' \
  "payout_emergency_paused=true,ton_treasury_autopay_enabled=false"; do
  grep -Fq "$x" "$BACKEND" || { echo "ERROR: V20 safety marker missing: $x" >&2; exit 1; }
done

cols=$(runuser -u postgres -- psql -d "$DB" -Atqc "select count(*) from information_schema.columns where table_schema='public' and table_name='app_settings' and column_name in ('ton_treasury_scan_enabled','ton_treasury_scan_interval_minutes','ton_treasury_last_scan_at','ton_treasury_last_scan_error','ton_treasury_autopay_enabled','ton_treasury_autopay_max_ton','ton_treasury_autopay_daily_cap_ton','ton_treasury_autopay_risk_max','ton_treasury_last_autopay_at','ton_treasury_last_autopay_error')")
[[ "$cols" == "10" ]] || { echo "ERROR: TON config columns incomplete: $cols/10" >&2; exit 1; }

auto=$(runuser -u postgres -- psql -d "$DB" -Atqc "select coalesce(ton_treasury_autopay_enabled,false) from public.app_settings where id=true")
echo "ton_autopay_initial=$auto"
[[ "$auto" == "f" ]] || { echo 'ERROR: installer refuses to start with TON autopay armed' >&2; exit 1; }

echo '=== RESTART VPS API/BOT ==='
pm2 restart wiener-api --update-env
sleep 2
code=$(curl -sS -o /tmp/v20-webhook.txt -w '%{http_code}' -X POST -H 'content-type: application/json' --data '{}' http://127.0.0.1:3000/functions/v1/wiener-bot-webhook || true)
echo "wiener-bot-webhook -> HTTP $code"
[[ "$code" != "000" && "$code" != "404" && "$code" != "502" ]] || { cat /tmp/v20-webhook.txt 2>/dev/null || true; echo 'ERROR: bot webhook unavailable after V20' >&2; exit 1; }

cron_code=$(curl -sS -o /dev/null -w '%{http_code}' -X POST -H 'content-type: application/json' --data '{}' http://127.0.0.1:3000/internal/cron || true)
echo "internal cron protected smoke -> HTTP $cron_code"
[[ "$cron_code" == "403" ]] || echo "WARNING: expected protected cron HTTP 403, got $cron_code"

pm2 save

echo '=== V20 TON TREASURY CONFIG INSTALLED ==='
echo '/config is admin-only.'
echo 'Auto deposit scan: available; default ON, 2-minute interval.'
echo 'TON autopay: default OFF and requires explicit Telegram confirmation.'
echo 'Autopay safety: signer check, TON/global payout toggles, emergency pause, <=20 risk, normal enforcement, >=5 ads, >=1h account age, per-payment cap, daily cap, one candidate per cron, one guarded attempt, no automatic retry.'
echo 'Mnemonic/RPC/API secret values are never displayed or editable in Telegram.'
echo 'No payout or treasury withdrawal was executed by this installer.'
trap - ERR
