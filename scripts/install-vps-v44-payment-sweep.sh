#!/usr/bin/env bash
set -Eeuo pipefail

CODE=/opt/wiener-code
SERVER=/opt/wiener-backend/server.mjs
[ -f "$SERVER" ] || SERVER=/opt/wiener-backend/server.js
export WIENER_BACKEND_FILE="$SERVER"

cd "$CODE"
git fetch origin main

if ! grep -q "WIENER SPONSORED PAYMENT VERIFICATION V42" "$SERVER"; then
  echo "ERROR: V42 payment verifier is not installed" >&2
  exit 1
fi

git show origin/main:scripts/patch-vps-v44-payment-sweep.py > /tmp/v44.py
python3 -m py_compile /tmp/v44.py

STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP="$SERVER.pre-v44-$STAMP"
cp "$SERVER" "$BACKUP"

rollback(){
  rc=$?
  cp -f "$BACKUP" "$SERVER" 2>/dev/null || true
  pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
  exit "$rc"
}
trap rollback ERR

python3 /tmp/v44.py
node --check "$SERVER"
grep -q "WIENER SPONSORED PAYMENT SWEEP V44" "$SERVER"

pm2 restart wiener-api --update-env
sleep 3

echo "=== PAYMENT RECONCILIATION AUDIT ==="
runuser -u postgres -- psql -d wiener_farm_final -P pager=off -c "
select
  d.metadata->>'memo' as memo,
  d.amount,
  d.created_at as deposit_at,
  o.id as order_id,
  o.status as order_status,
  o.payment_status,
  o.task_id
from public.wiener_treasury_transfers d
left join public.exclusive_task_orders o
  on o.payment_memo=d.metadata->>'memo'
where d.asset='TON'
  and d.network='TON'
  and coalesce(d.metadata->>'memo','') like 'WTASK-%'
order by d.created_at desc
limit 10;
"

echo "=== PENDING AGE ==="
runuser -u postgres -- psql -d wiener_farm_final -P pager=off -c "
select
  count(*) filter(where created_at>=now()-interval '6 hours') as recent_pending,
  count(*) filter(where created_at<now()-interval '6 hours') as old_pending
from public.exclusive_task_orders
where status='awaiting_payment';
"

pm2 save >/dev/null
trap - ERR

echo
echo "=== V44 READY ==="
echo "Payment verification stays automatic every 7 seconds for recent orders"
echo "Old abandoned orders no longer hammer the TON RPC"
echo "Old paid orders can still be recovered with CHECK PAYMENT"
