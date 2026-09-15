#!/usr/bin/env bash
set -Eeuo pipefail

CODE=/opt/wiener-code
DB=wiener_farm_final
SERVER=/opt/wiener-backend/server.mjs
[ -f "$SERVER" ] || SERVER=/opt/wiener-backend/server.js
[ -f "$SERVER" ] || { echo 'ERROR: backend file not found'; exit 1; }

cd "$CODE"
STAMP=$(date +%Y%m%d-%H%M%S)
cp -a "$SERVER" "$SERVER.before-v83-$STAMP"

echo '=== INSTALL V83 SPONSORED RECONCILE REPAIR ==='
python3 scripts/patch-vps-v83-sponsored-reconcile-repair.py
node --check "$SERVER"
pm2 restart wiener-api --update-env >/dev/null
pm2 save >/dev/null

echo 'Waiting for repair sweep...'
sleep 8
curl -fsS http://127.0.0.1:3000/health
echo

echo '=== TARGET PAYMENT ==='
runuser -u postgres -- psql -d "$DB" -P pager=off -x -c "
select o.id,o.telegram_id,o.title,o.task_kind,o.status,o.payment_status,o.payment_memo,
       o.package_ton,o.task_id,o.tx_hash,o.activated_at,
       t.id as listed_task_id,t.enabled as listed_enabled,t.task_type,t.verification,
       t.completed_count,t.max_completions
from public.exclusive_task_orders o
left join public.tasks t on t.sponsored_order_id=o.id
where o.payment_memo='WTASK-C21D3424';"

echo '=== CONFIRMED PAYMENTS STILL STUCK ==='
runuser -u postgres -- psql -d "$DB" -P pager=off -c "
select o.id,o.telegram_id,o.title,o.task_kind,o.payment_memo,o.package_ton,
       d.amount as received_ton,d.tx_hash
from public.exclusive_task_orders o
join public.wiener_treasury_transfers d
  on d.direction='deposit' and d.asset='TON' and d.network='TON' and d.state='confirmed'
 and coalesce(d.metadata->>'memo','')=o.payment_memo
 and d.to_address=o.payment_address
 and d.amount + 0.000001 >= o.package_ton
where o.status='awaiting_payment'
order by o.created_at asc;"

echo '=== LIVE/PAID ORDERS STILL NOT LISTED ==='
runuser -u postgres -- psql -d "$DB" -P pager=off -c "
select o.id,o.telegram_id,o.title,o.task_kind,o.status,o.payment_memo,o.task_id,
       t.id as listed_task_id,t.enabled,t.completed_count,t.max_completions
from public.exclusive_task_orders o
left join public.tasks t on t.sponsored_order_id=o.id
where o.status='live'
  and (o.task_id is null or t.id is null or coalesce(t.enabled,false)=false)
order by o.activated_at asc nulls first;"

echo '=== ORDERS STILL AWAITING PAYMENT ==='
runuser -u postgres -- psql -d "$DB" -P pager=off -c "
select id,telegram_id,title,task_kind,payment_memo,package_ton,created_at
from public.exclusive_task_orders
where status='awaiting_payment'
order by created_at asc;"

echo '=== RECENT SPONSORED TASKS LISTED ==='
runuser -u postgres -- psql -d "$DB" -P pager=off -c "
select t.id,t.title,t.task_type,t.enabled,t.completed_count,t.max_completions,o.payment_memo,o.telegram_id
from public.tasks t
join public.exclusive_task_orders o on o.id=t.sponsored_order_id
order by o.activated_at desc nulls last
limit 20;"

echo
STUCK=$(runuser -u postgres -- psql -d "$DB" -tA -c "select count(*) from public.exclusive_task_orders o join public.wiener_treasury_transfers d on d.direction='deposit' and d.asset='TON' and d.network='TON' and d.state='confirmed' and coalesce(d.metadata->>'memo','')=o.payment_memo and d.to_address=o.payment_address and d.amount + 0.000001 >= o.package_ton where o.status='awaiting_payment'")
BROKEN=$(runuser -u postgres -- psql -d "$DB" -tA -c "select count(*) from public.exclusive_task_orders o left join public.tasks t on t.sponsored_order_id=o.id where o.status='live' and (o.task_id is null or t.id is null or coalesce(t.enabled,false)=false)")
if [ "$STUCK" = "0" ] && [ "$BROKEN" = "0" ]; then
  echo '✅ Sponsored payment settlement and task listing are healthy.'
else
  echo "⚠️ Remaining confirmed-payment issues: $STUCK | live listing issues: $BROKEN"
  echo 'Check PM2 logs below for exact repair error:'
  pm2 logs wiener-api --lines 80 --nostream | grep -E 'v82_db_order_reconcile|v83_live_task_repair|error|ERROR' || true
fi

echo '=== V83 DONE ==='
