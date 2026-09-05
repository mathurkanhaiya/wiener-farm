#!/usr/bin/env bash
set -Eeuo pipefail

echo "=== FIX SPONSORED MINI APP TASK KIND ==="

runuser -u postgres -- psql -d wiener_farm_final -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;

ALTER TABLE public.exclusive_task_orders
  DROP CONSTRAINT IF EXISTS exclusive_task_orders_task_kind_check;

UPDATE public.exclusive_task_orders
SET task_kind='mini_app'
WHERE task_kind='miniapp';

ALTER TABLE public.exclusive_task_orders
  ADD CONSTRAINT exclusive_task_orders_task_kind_check
  CHECK (task_kind = ANY (ARRAY['channel'::text,'group'::text,'mini_app'::text]));

COMMIT;
SQL

echo "=== VERIFY TASK KIND CONSTRAINT ==="
runuser -u postgres -- psql -d wiener_farm_final -P pager=off -c "select conname,pg_get_constraintdef(oid) from pg_constraint where conrelid='public.exclusive_task_orders'::regclass and conname='exclusive_task_orders_task_kind_check';"

pm2 restart wiener-api --update-env
sleep 2
pm2 save >/dev/null

echo
echo "=== V43 READY ==="
echo "Channel + Group + Mini App sponsored orders are accepted"
echo "Both Mini App and bot /addtask use task_kind=mini_app"
