#!/usr/bin/env bash
set -euo pipefail
cd /opt/wiener-code
BACKEND=/opt/wiener-backend/server.mjs
STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP="${BACKEND}.v21b-${STAMP}.bak"
cp -a "$BACKEND" "$BACKUP"
rollback(){
  rc=$?
  if [ "$rc" -ne 0 ]; then
    echo 'ERROR: V21B install failed; restoring working backend backup.' >&2
    cp -a "$BACKUP" "$BACKEND"
    node --check "$BACKEND" >/dev/null 2>&1 || true
    pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
  fi
  exit "$rc"
}
trap rollback EXIT

echo '=== VERIFY CURRENT WORKING V20 BASE ==='
grep -Fq 'WIENER VPS TON TREASURY CONFIG V20' "$BACKEND" || { echo 'ERROR: V20 TON config is not installed on the live backend' >&2; exit 1; }
node --check "$BACKEND"

echo '=== ENSURE V21 DATABASE STATE ==='
runuser -u postgres -- psql -d wiener_farm_final -v ON_ERROR_STOP=1 <<'SQL'
alter table public.app_settings add column if not exists ton_treasury_next_scan_at timestamptz;
alter table public.app_settings add column if not exists ton_treasury_scan_failures integer not null default 0;
alter table public.app_settings add column if not exists ton_treasury_scan_cursor_lt text not null default '0';
alter table public.app_settings add column if not exists ton_treasury_last_success_at timestamptz;
alter table public.app_settings add column if not exists ton_treasury_last_scan_count integer not null default 0;
update public.app_settings set ton_treasury_autopay_enabled=false where id=true;
SQL

echo '=== APPLY CORRECTED V21 RELIABILITY PATCH ==='
python3 scripts/patch-vps-v21-ton-reliability.py

echo '=== PRE-RESTART SAFETY GATE ==='
node --check "$BACKEND"
grep -Fq 'WIENER VPS TON RELIABILITY V21' "$BACKEND"
grep -Fq 'pg_try_advisory_lock' "$BACKEND"
grep -Fq 'ton_treasury_scan_cursor_lt' "$BACKEND"
grep -Fq 'cfg21:health' "$BACKEND"
auto=$(runuser -u postgres -- psql -d wiener_farm_final -Atqc "select coalesce(ton_treasury_autopay_enabled,false) from public.app_settings where id=true")
[[ "$auto" == "f" ]] || { echo 'ERROR: refusing restart because TON autopay is enabled' >&2; exit 1; }

echo '=== RESTART VPS API/BOT ONCE ==='
pm2 restart wiener-api --update-env
pm2 save
sleep 2
pm2 describe wiener-api | grep -E 'status|uptime' | head -n 4 || true

code=$(curl -sS -o /tmp/v21b-webhook.out -w '%{http_code}' -X POST -H 'content-type: application/json' -d '{}' http://127.0.0.1:3000/functions/v1/wiener-bot-webhook || true)
echo "wiener-bot-webhook -> HTTP $code"
[[ "$code" != "000" && "$code" != "404" && "$code" != "502" ]] || { echo 'ERROR: webhook smoke failed' >&2; exit 1; }

echo '=== V21B SAFETY STATE ==='
runuser -u postgres -- psql -d wiener_farm_final -Atqc "select 'auto_scan='||coalesce(ton_treasury_scan_enabled,false)||' autopay='||coalesce(ton_treasury_autopay_enabled,false)||' failures='||coalesce(ton_treasury_scan_failures,0)||' cursor='||coalesce(ton_treasury_scan_cursor_lt,'0') from public.app_settings where id=true"

echo '=== V21B TON RELIABILITY INSTALLED ==='
echo 'TON scanner serialized with shared manual/cron lock.'
echo 'Cursor + provider cooldown/backoff installed.'
echo 'System Health control installed in /config.'
echo 'TON autopay remains OFF. No payout or treasury withdrawal was executed.'
trap - EXIT
