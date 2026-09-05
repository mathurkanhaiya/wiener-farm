#!/usr/bin/env bash
set -Eeuo pipefail

CODE=/opt/wiener-code
BACKEND=/opt/wiener-backend
SERVER="$BACKEND/server.mjs"
[ -f "$SERVER" ] || SERVER="$BACKEND/server.js"
export WIENER_BACKEND_FILE="$SERVER"
STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP="$SERVER.v30-$STAMP.bak"
SRC_BACKUP="/tmp/wiener-v30-src-$STAMP"
OLD_APP=$(readlink -f /opt/wiener-app/current 2>/dev/null || true)

rollback(){
  rc=$?
  echo 'V30 failed; restoring backend and source.' >&2
  cp -f "$BACKUP" "$SERVER" 2>/dev/null || true
  if [[ -d "$SRC_BACKUP" ]]; then
    rm -rf "$CODE/src"
    cp -a "$SRC_BACKUP" "$CODE/src"
  fi
  if [[ -n "$OLD_APP" && -e "$OLD_APP" ]]; then ln -sfn "$OLD_APP" /opt/wiener-app/current || true; fi
  pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
  exit "$rc"
}
trap rollback ERR

cd "$CODE"
cp "$SERVER" "$BACKUP"
cp -a src "$SRC_BACKUP"

git fetch origin main
git show origin/main:scripts/patch-vps-v30-sponsored-task-manager.py > /tmp/wiener-v30.py
git show origin/main:src/SponsoredTaskManager.tsx > /tmp/SponsoredTaskManager.tsx
git show origin/main:src/SponsoredTaskEntry.tsx > /tmp/SponsoredTaskEntry.tsx

echo '=== DATABASE: SPONSORED TASK TOP-UPS ==='
runuser -u postgres -- psql -d wiener_farm_final -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
CREATE TABLE IF NOT EXISTS public.sponsored_task_topups(
  id text PRIMARY KEY,
  order_id text NOT NULL,
  telegram_id bigint NOT NULL,
  task_id text,
  added_completions integer NOT NULL CHECK(added_completions>0),
  price_usd numeric(18,6) NOT NULL CHECK(price_usd>=0),
  worker_pool_wiener numeric(20,6) NOT NULL DEFAULT 0,
  worker_pool_usdt numeric(18,8) NOT NULL DEFAULT 0,
  platform_profit_usdt numeric(18,8) NOT NULL DEFAULT 0,
  package_ton numeric(20,9) NOT NULL CHECK(package_ton>0),
  payment_address text NOT NULL,
  payment_memo text NOT NULL,
  quote_ton_usd numeric(18,8),
  status text NOT NULL DEFAULT 'awaiting_payment',
  payment_status text NOT NULL DEFAULT 'awaiting',
  tx_hash text,
  from_address text,
  explorer_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  detected_at timestamptz,
  activated_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sponsored_task_topups_memo_uq ON public.sponsored_task_topups(payment_memo);
CREATE UNIQUE INDEX IF NOT EXISTS sponsored_task_topups_tx_uq ON public.sponsored_task_topups(tx_hash) WHERE tx_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS sponsored_task_topups_user_status_idx ON public.sponsored_task_topups(telegram_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS sponsored_task_topups_order_idx ON public.sponsored_task_topups(order_id,created_at DESC);
COMMIT;
SQL

echo '=== ENSURE PAYMENT RECONCILIATION FIX ==='
if ! grep -q 'WIENER SPONSORED TON PAYMENT FIX V29' "$SERVER"; then
  git show origin/main:scripts/patch-vps-v29-sponsored-ton-payment-fix.py > /tmp/wiener-v29.py
  python3 -m py_compile /tmp/wiener-v29.py
  python3 /tmp/wiener-v29.py
fi

echo '=== PATCH ADVANCED TASK MANAGER BACKEND ==='
python3 -m py_compile /tmp/wiener-v30.py
python3 /tmp/wiener-v30.py
node --check "$SERVER"
grep -q 'WIENER SPONSORED TASK MANAGER V30' "$SERVER"
grep -q 'wiener-sponsored-task-manager' "$SERVER"

echo '=== INSTALL TASK MANAGER UI ==='
cp /tmp/SponsoredTaskManager.tsx src/SponsoredTaskManager.tsx
cp /tmp/SponsoredTaskEntry.tsx src/SponsoredTaskEntry.tsx

echo '=== BUILD MINI APP ==='
npm run build
test -f dist/index.html
NEW_RELEASE="/opt/wiener-app/releases/$(date +%Y%m%d-%H%M%S)-v30-sponsored-task-manager"
mkdir -p "$NEW_RELEASE"
cp -a dist/. "$NEW_RELEASE/"

# Restore every unrelated local source change after prebuild, then retain only V30 task UI files.
rm -rf src
cp -a "$SRC_BACKUP" src
cp /tmp/SponsoredTaskManager.tsx src/SponsoredTaskManager.tsx
cp /tmp/SponsoredTaskEntry.tsx src/SponsoredTaskEntry.tsx

echo '=== RESTART API + SWITCH RELEASE ==='
pm2 restart wiener-api --update-env
sleep 3
if ! ss -ltn | grep -q '127.0.0.1:3000'; then
  echo 'Backend is not listening on 127.0.0.1:3000' >&2
  exit 1
fi
code=$(curl -sS -o /tmp/v30-route.json -w '%{http_code}' -X POST -H 'content-type: application/json' --data '{}' http://127.0.0.1:3000/functions/v1/wiener-sponsored-task-manager || true)
if [[ "$code" == "000" || "$code" == "404" || "$code" == "502" ]]; then
  cat /tmp/v30-route.json 2>/dev/null || true
  echo "Sponsored task manager route failed: HTTP $code" >&2
  exit 1
fi
ln -sfn "$NEW_RELEASE" /opt/wiener-app/current
pm2 save >/dev/null

echo '=== V30 READY ==='
echo 'Create Task + Manage Tasks buttons are active.'
echo 'Pending payments, live tasks, completed tasks and progress are managed in one place.'
echo 'Live tasks can be paused/resumed.'
echo 'Extra completions can be purchased with TON using +100/+250/+500/+1000 or custom amounts.'
echo 'Top-up payments are idempotent and auto-detected while pending.'
echo 'Bot /addtask now opens the Sponsored Task Center.'
trap - ERR
