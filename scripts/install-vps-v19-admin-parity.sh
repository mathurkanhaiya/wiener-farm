#!/usr/bin/env bash
set -euo pipefail

cd /opt/wiener-code
BACKEND=/opt/wiener-backend/server.mjs
DB=wiener_farm_final
STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP="/opt/wiener-backend/server.mjs.v19-${STAMP}.bak"

[[ -f "$BACKEND" ]] || { echo 'ERROR: backend server.mjs not found' >&2; exit 1; }
cp "$BACKEND" "$BACKUP"
rollback(){
  echo 'ERROR: V19 install failed; restoring backend backup.' >&2
  cp "$BACKUP" "$BACKEND"
  pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
}
trap rollback ERR

echo '=== PREPARE FULL BOT HANDLER ==='
python3 scripts/prepare-vps-v19-full-bot.py
python3 scripts/patch-vps-v18-full-bot-parity.py
python3 scripts/patch-vps-v18b-bot-parity-fixes.py
python3 scripts/patch-vps-v19-supabase-admin-parity.py

echo '=== REQUIRED RUNTIME PACKAGES ==='
cd /opt/wiener-backend
if ! node -e "Promise.all([import('@ton/ton'),import('@ton/crypto')]).then(()=>process.exit(0)).catch(()=>process.exit(1))"; then
  npm install --omit=dev @ton/ton@15.1.0 @ton/crypto@3.3.0
fi
cd /opt/wiener-code

echo '=== STATIC PARITY GATE ==='
for x in \
  'WIENER VPS FULL BOT PARITY V18' \
  'WIENER VPS FULL BOT PARITY V18B' \
  'WIENER VPS SUPABASE ADMIN PARITY V19' \
  "cmd==='admin'" "cmd==='user'" "cmd==='addbalance'" "cmd==='removebalance'" \
  "cmd==='ban'" "cmd==='unban'" "cmd==='broadcast'" "cmd==='addtask'" "cmd==='pay'" \
  "cmd==='deposit'" "wtre:" "wpay:" "wgpay:" "usr:" "adm:prep:" "adm:ov:" "bc:" "at:" \
  'wiener-bot-sync' 'wiener-bot-admin' 'wiener-bot-user-inspector' 'wiener-bot-broadcast' \
  'wiener-bot-pay' 'wiener-bot-pay-ton' 'wiener-bot-treasury' 'wiener-treasury-wallet'; do
  grep -Fq "$x" "$BACKEND" || { echo "ERROR: missing parity marker/handler: $x" >&2; exit 1; }
done

node --check "$BACKEND"

echo '=== LOCAL DATABASE CONTRACTS ==='
runuser -u postgres -- psql -d "$DB" -v ON_ERROR_STOP=1 -Atc "
select 'admins='||count(*) from public.admins where enabled=true;
select 'users='||count(*) from public.users;
select 'withdrawals='||count(*) from public.withdrawals;
select 'required_tables='||count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('admin_broadcast_sessions','admin_broadcasts','admin_broadcast_deliveries','task_advertiser_sessions','wiener_treasury_sessions','wiener_treasury_transfers','user_risk_profiles','user_security_events','bot_admin_audit');
"

echo '=== RESTART VPS BOT/API ==='
pm2 restart wiener-api --update-env
sleep 2
pm2 save

code=$(curl -sS -o /tmp/v19-webhook-smoke.txt -w '%{http_code}' -X POST -H 'content-type: application/json' --data '{}' http://127.0.0.1:3000/functions/v1/wiener-bot-webhook || true)
if [[ "$code" == "000" || "$code" == "404" || "$code" == "502" ]]; then
  cat /tmp/v19-webhook-smoke.txt 2>/dev/null || true
  echo "ERROR: webhook route unavailable: HTTP $code" >&2
  exit 1
fi

echo '=== SYNC TELEGRAM TO OLD COMMAND SET ==='
SECRET=$(runuser -u postgres -- psql -d "$DB" -Atc "select coalesce(telegram_webhook_secret,'') from public.app_settings where id=true limit 1")
[[ -n "$SECRET" ]] || { echo 'ERROR: telegram webhook secret missing in local PostgreSQL' >&2; exit 1; }
sync_code=$(curl -sS -o /tmp/v19-sync.json -w '%{http_code}' -X POST \
  -H 'content-type: application/json' \
  -H "x-wiener-internal-secret: $SECRET" \
  --data '{}' \
  http://127.0.0.1:3000/functions/v1/wiener-bot-sync || true)
unset SECRET
cat /tmp/v19-sync.json
printf '\n'
if [[ "$sync_code" != "200" ]]; then
  echo "ERROR: bot sync failed: HTTP $sync_code" >&2
  exit 1
fi

echo '=== SAFE PAYOUT/TREASURY ROUTE CHECKS ==='
for fn in wiener-payout wiener-ton-payout wiener-treasury-wallet; do
  c=$(curl -sS -o /dev/null -w '%{http_code}' -X POST -H 'content-type: application/json' --data '{}' "http://127.0.0.1:3000/functions/v1/$fn" || true)
  echo "$fn -> HTTP $c"
  [[ "$c" != "000" && "$c" != "404" && "$c" != "502" ]] || { echo "ERROR: $fn route unavailable" >&2; exit 1; }
done

echo '=== V19 FULL ADMIN PARITY INSTALLED ==='
echo 'Restored from old Supabase behavior:'
echo '/admin /user /addbalance /removebalance /notify /ban /unban /broadcast /pay /deposit /withdraw(admin treasury) /addtask /cancel'
echo 'Restored callback families: adm:* usr:* wpay:* wgpay:* wtre:* bc:* at:*'
echo 'Restored: Polygon + GRAM pay centers, payout settings/history/stats/secret-presence, treasury Polygon+TON deposit scan/alerts, one-click unban action, user inspector, risk controls, system toggles, broadcast sessions, sponsored-task wizard.'
echo 'No payout or treasury withdrawal was executed.'
trap - ERR
