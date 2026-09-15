#!/usr/bin/env bash
set -Eeuo pipefail

CODE=/opt/wiener-code
DB=wiener_farm_final
SERVER=/opt/wiener-backend/server.mjs
[ -f "$SERVER" ] || SERVER=/opt/wiener-backend/server.js
[ -f "$SERVER" ] || { echo 'ERROR: backend file not found'; exit 1; }

cd "$CODE"
STAMP=$(date +%Y%m%d-%H%M%S)
cp -a "$SERVER" "$SERVER.before-v82-$STAMP"

echo '=== INSTALL V82 SPONSORED PAYMENT DB-FIRST FIX ==='
python3 scripts/patch-vps-v82-sponsored-payment-db-first.py
node --check "$SERVER"
pm2 restart wiener-api --update-env >/dev/null
pm2 save >/dev/null

echo 'Waiting for automatic reconciliation...'
sleep 10
curl -fsS http://127.0.0.1:3000/health
echo

echo '=== REFERENCE WTASK-C21D3424 ==='
runuser -u postgres -- psql -d "$DB" -P pager=off -x -c "
select o.id,o.telegram_id,o.title,o.task_kind,o.status,o.payment_status,o.payment_memo,o.package_ton,o.task_id,o.tx_hash,o.activated_at,
       t.id as listed_task_id,t.enabled as listed_enabled,t.completed_count,t.max_completions
from public.exclusive_task_orders o
left join public.tasks t on t.sponsored_order_id=o.id
where o.payment_memo='WTASK-C21D3424';"

echo '=== CONFIRMED TON DEPOSITS STILL WAITING ==='
runuser -u postgres -- psql -d "$DB" -P pager=off -c "
select o.id,o.telegram_id,o.title,o.task_kind,o.payment_memo,o.package_ton,d.amount as received_ton,d.tx_hash
from public.exclusive_task_orders o
join public.wiener_treasury_transfers d
  on d.direction='deposit'
 and d.asset='TON'
 and d.network='TON'
 and d.state='confirmed'
 and coalesce(d.metadata->>'memo','')=o.payment_memo
 and d.to_address=o.payment_address
 and d.amount + 0.000001 >= o.package_ton
where o.status='awaiting_payment'
order by o.created_at asc;"

echo '=== PAID/LIVE ORDERS NOT LISTED CORRECTLY ==='
runuser -u postgres -- psql -d "$DB" -P pager=off -c "
select o.id,o.telegram_id,o.title,o.task_kind,o.status,o.payment_memo,o.task_id,
       t.id as listed_task_id,t.enabled,t.completed_count,t.max_completions
from public.exclusive_task_orders o
left join public.tasks t on t.sponsored_order_id=o.id
where o.status='live'
  and (o.task_id is null or t.id is null or coalesce(t.enabled,false)=false)
order by o.activated_at asc nulls first;"

echo '=== ALL ORDERS STILL AWAITING PAYMENT ==='
runuser -u postgres -- psql -d "$DB" -P pager=off -c "
select id,telegram_id,title,task_kind,payment_memo,package_ton,created_at
from public.exclusive_task_orders
where status='awaiting_payment'
order by created_at asc;"

echo
if runuser -u postgres -- psql -d "$DB" -tA -c "select count(*) from public.exclusive_task_orders o join public.wiener_treasury_transfers d on d.direction='deposit' and d.asset='TON' and d.network='TON' and d.state='confirmed' and coalesce(d.metadata->>'memo','')=o.payment_memo and d.to_address=o.payment_address and d.amount + 0.000001 >= o.package_ton where o.status='awaiting_payment'" | grep -qx '0'; then
  echo '✅ No confirmed sponsored TON payment is stuck awaiting activation.'
else
  echo '⚠️ One or more confirmed sponsored payments are still waiting. Send the output above.'
fi

echo '=== V82 DONE ==='
