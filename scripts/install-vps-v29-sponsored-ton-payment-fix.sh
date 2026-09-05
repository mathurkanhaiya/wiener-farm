#!/usr/bin/env bash
set -Eeuo pipefail

CODE=/opt/wiener-code
BACKEND=/opt/wiener-backend
SERVER="$BACKEND/server.mjs"
[ -f "$SERVER" ] || SERVER="$BACKEND/server.js"
export WIENER_BACKEND_FILE="$SERVER"
STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP="$SERVER.v29-$STAMP.bak"

rollback(){
  rc=$?
  echo 'V29 failed; restoring backend.' >&2
  cp -f "$BACKUP" "$SERVER" 2>/dev/null || true
  pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
  exit "$rc"
}
trap rollback ERR

cd "$CODE"
cp "$SERVER" "$BACKUP"

if ! git rev-parse --verify origin/main >/dev/null 2>&1; then
  git fetch origin main
fi
git show origin/main:scripts/patch-vps-v29-sponsored-ton-payment-fix.py > /tmp/wiener-v29.py

echo '=== PATCH SPONSORED TON PAYMENT ==='
python3 -m py_compile /tmp/wiener-v29.py
python3 /tmp/wiener-v29.py
node --check "$SERVER"
grep -q 'WIENER SPONSORED TON PAYMENT FIX V29' "$SERVER"

echo '=== RESTART API ==='
pm2 restart wiener-api --update-env
sleep 3
if ! ss -ltn | grep -q '127.0.0.1:3000'; then
  echo 'Backend is not listening on port 3000' >&2
  exit 1
fi

echo '=== RECOVER ALREADY-PAID TON TASK ORDERS ==='
OWNER=$(runuser -u postgres -- psql -d wiener_farm_final -At -c "select telegram_id from public.admins where enabled=true and role in ('owner','admin') order by case when role='owner' then 0 else 1 end limit 1")
SECRET=$(runuser -u postgres -- psql -d wiener_farm_final -At -c "select telegram_webhook_secret from public.app_settings where id=true limit 1")
if [[ -n "$OWNER" && -n "$SECRET" ]]; then
  curl -sS -X POST \
    -H 'content-type: application/json' \
    -H "x-wiener-internal-secret: $SECRET" \
    --data "{\"admin_id\":$OWNER}" \
    http://127.0.0.1:3000/functions/v1/wiener-ton-deposit-backfill \
    -o /tmp/v29-backfill.json || true
  cat /tmp/v29-backfill.json 2>/dev/null || true
  echo
  curl -sS -X POST \
    -H 'content-type: application/json' \
    -H "x-wiener-internal-secret: $SECRET" \
    --data "{\"action\":\"reconcile_all\",\"telegram_id\":$OWNER}" \
    http://127.0.0.1:3000/functions/v1/wiener-sponsored-task \
    -o /tmp/v29-reconcile.json || true
  cat /tmp/v29-reconcile.json 2>/dev/null || true
  echo
else
  echo 'Skipped automatic recovery: owner or internal secret not available.'
fi

echo '=== V29 READY ==='
echo 'Sponsored TON payments no longer use ON CONFLICT(tx_hash).'
echo 'Already-paid task orders were backfilled and reconciliation was attempted.'
echo 'Refresh /addtask payment status now.'
trap - ERR
