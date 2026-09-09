#!/usr/bin/env bash
set -Eeuo pipefail

DB=wiener_farm_final
CODE=/opt/wiener-code
SERVER=/opt/wiener-backend/server.mjs
[ -f "$SERVER" ] || SERVER=/opt/wiener-backend/server.js
[ -f "$SERVER" ] || { echo 'ERROR: backend file not found'; exit 1; }

cd "$CODE"

echo '=== V84B MINI APP URL CONSTRAINT FIX ==='

echo 'Current constraint:'
runuser -u postgres -- psql -d "$DB" -P pager=off -c "select conname,pg_get_constraintdef(oid) from pg_constraint where conrelid='public.tasks'::regclass and conname='tasks_mini_app_url_check';"

echo 'Stuck order target values:'
runuser -u postgres -- psql -d "$DB" -P pager=off -x -c "select id,title,task_kind,target_url,target_ref,payment_memo,status,payment_status from public.exclusive_task_orders where payment_memo='WTASK-C21D3424';"

# PostgreSQL's regex engine rejects very large bounded repetitions such as {0,512}.
# Keep bounded parts small, use +/* for the payload, and enforce total URL length separately.
runuser -u postgres -- psql -d "$DB" -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_mini_app_url_check;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_mini_app_url_check
  CHECK (
    task_type IS DISTINCT FROM 'mini_app'
    OR (
      url IS NOT NULL
      AND length(url) <= 700
      AND (
        url ~ '^https://t[.]me/[A-Za-z0-9_]{5,32}/[A-Za-z0-9_]{1,64}([?]startapp=[A-Za-z0-9._~%+-]*)?$'
        OR url ~ '^https://t[.]me/[A-Za-z0-9_]{5,32}[?]startapp=[A-Za-z0-9._~%+-]+$'
      )
    )
  ) NOT VALID;
ALTER TABLE public.tasks VALIDATE CONSTRAINT tasks_mini_app_url_check;
COMMIT;
SQL

echo 'Updated constraint:'
runuser -u postgres -- psql -d "$DB" -P pager=off -c "select conname,pg_get_constraintdef(oid) from pg_constraint where conrelid='public.tasks'::regclass and conname='tasks_mini_app_url_check';"

pm2 restart wiener-api --update-env >/dev/null
pm2 save >/dev/null

echo 'Waiting for automatic reconciliation...'
sleep 10

echo '=== TARGET PAYMENT AFTER FIX ==='
runuser -u postgres -- psql -d "$DB" -P pager=off -x -c "
select o.id,o.telegram_id,o.title,o.task_kind,o.status,o.payment_status,o.payment_memo,o.package_ton,o.task_id,o.tx_hash,o.activated_at,
       t.id as listed_task_id,t.enabled as listed_enabled,t.task_type,t.verification,t.url,t.completed_count,t.max_completions
from public.exclusive_task_orders o
left join public.tasks t on t.sponsored_order_id=o.id
where o.payment_memo='WTASK-C21D3424';"

echo '=== CONFIRMED PAYMENTS STILL STUCK ==='
runuser -u postgres -- psql -d "$DB" -P pager=off -c "
select o.id,o.telegram_id,o.title,o.task_kind,o.payment_memo,o.package_ton,d.amount as received_ton,d.tx_hash
from public.exclusive_task_orders o
join public.wiener_treasury_transfers d
  on d.direction='deposit' and d.asset='TON' and d.network='TON' and d.state='confirmed'
 and coalesce(d.metadata->>'memo','')=o.payment_memo
 and d.to_address=o.payment_address
 and d.amount + 0.000001 >= o.package_ton
where o.status='awaiting_payment'
order by o.created_at asc;"

echo '=== LIVE/PAID ORDERS NOT LISTED ==='
runuser -u postgres -- psql -d "$DB" -P pager=off -c "
select o.id,o.telegram_id,o.title,o.task_kind,o.status,o.payment_memo,o.task_id,t.id as listed_task_id,t.enabled
from public.exclusive_task_orders o
left join public.tasks t on t.sponsored_order_id=o.id
where o.status='live' and (o.task_id is null or t.id is null or coalesce(t.enabled,false)=false)
order by o.activated_at asc nulls first;"

curl -fsS http://127.0.0.1:3000/health; echo

echo '=== V84B DONE ==='
