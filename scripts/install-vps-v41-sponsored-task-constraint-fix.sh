#!/usr/bin/env bash
set -Eeuo pipefail

CODE=/opt/wiener-code
SERVER=/opt/wiener-backend/server.mjs
[ -f "$SERVER" ] || SERVER=/opt/wiener-backend/server.js

cd "$CODE"
git fetch origin main

if ! grep -q "WIENER SPONSORED FIXED REWARD V38" "$SERVER"; then
  git show origin/main:scripts/install-vps-v38-fixed-sponsored-reward.sh > /tmp/v38.sh
  bash /tmp/v38.sh
fi

echo "=== FIX SPONSORED TASK REWARD CONSTRAINT ==="

runuser -u postgres -- psql -d wiener_farm_final -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid=c.conrelid
    JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE n.nspname='public'
      AND t.relname='exclusive_task_orders'
      AND c.contype='c'
      AND pg_get_constraintdef(c.oid) ILIKE '%reward_per_completion%'
  LOOP
    EXECUTE format('ALTER TABLE public.exclusive_task_orders DROP CONSTRAINT %I',r.conname);
  END LOOP;
END $$;

ALTER TABLE public.exclusive_task_orders
  ALTER COLUMN reward_per_completion SET DEFAULT 10;

ALTER TABLE public.exclusive_task_orders
  ADD CONSTRAINT exclusive_task_orders_reward_per_completion_check
  CHECK (reward_per_completion >= 10);

UPDATE public.app_settings
SET sponsored_min_reward=10,
    sponsored_max_reward=10,
    updated_at=now()
WHERE id=true;

UPDATE public.tasks
SET category='official',
    user_created=true
WHERE sponsored_order_id IS NOT NULL
  AND (category IS DISTINCT FROM 'official' OR user_created IS DISTINCT FROM true);
SQL

node --check "$SERVER"
pm2 restart wiener-api --update-env
sleep 2

SECRET=$(runuser -u postgres -- psql -d wiener_farm_final -tA -c "select coalesce(telegram_webhook_secret,'') from public.app_settings where id=true limit 1")
if [ -n "$SECRET" ]; then
  curl -sS -X POST     -H "content-type: application/json"     -H "x-wiener-internal-secret: $SECRET"     --data '{}'     http://127.0.0.1:3000/functions/v1/wiener-bot-sync >/tmp/v41-sync.json || true
fi

echo "=== VERIFY ==="
runuser -u postgres -- psql -d wiener_farm_final -P pager=off -c "select sponsored_min_reward,sponsored_max_reward from public.app_settings where id=true;"
runuser -u postgres -- psql -d wiener_farm_final -P pager=off -c "select conname,pg_get_constraintdef(oid) from pg_constraint where conrelid='public.exclusive_task_orders'::regclass and pg_get_constraintdef(oid) ilike '%reward_per_completion%';"

pm2 save >/dev/null

echo
echo "=== V41 READY ==="
echo "App + bot create sponsored tasks with fixed 10 WIENER"
echo "Paid sponsored tasks appear in Official Tasks"
