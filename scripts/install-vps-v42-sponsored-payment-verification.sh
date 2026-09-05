#!/usr/bin/env bash
set -Eeuo pipefail

CODE=/opt/wiener-code
SERVER=/opt/wiener-backend/server.mjs
[ -f "$SERVER" ] || SERVER=/opt/wiener-backend/server.js
export WIENER_BACKEND_FILE="$SERVER"

cd "$CODE"
git fetch origin main

V41_OK=$(runuser -u postgres -- psql -d wiener_farm_final -tA -c "select case when sponsored_min_reward=10 and sponsored_max_reward=10 then 'yes' else 'no' end from public.app_settings where id=true limit 1")
if [ "$V41_OK" != "yes" ]; then
  git show origin/main:scripts/install-vps-v41-sponsored-task-constraint-fix.sh > /tmp/v41.sh
  bash /tmp/v41.sh
fi

git show origin/main:scripts/patch-vps-v42-sponsored-payment-verification.py > /tmp/v42.py
python3 -m py_compile /tmp/v42.py

STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP="$SERVER.pre-v42-$STAMP"
cp "$SERVER" "$BACKUP"

rollback(){
  rc=$?
  cp -f "$BACKUP" "$SERVER" 2>/dev/null || true
  pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
  exit "$rc"
}
trap rollback ERR

echo "=== PAYMENT LOOKUP INDEXES ==="
runuser -u postgres -- psql -d wiener_farm_final -v ON_ERROR_STOP=1 <<'SQL'
create index if not exists idx_wiener_treasury_ton_payment_lookup
  on public.wiener_treasury_transfers(to_address,((metadata->>'memo')),created_at desc)
  where direction='deposit' and asset='TON' and network='TON';

create index if not exists idx_task_deposits_tx_hash_lookup
  on public.task_deposits(tx_hash);

create index if not exists idx_sponsored_pending_payment
  on public.exclusive_task_orders(status,created_at)
  where status='awaiting_payment';

create index if not exists idx_sponsored_topup_pending_payment
  on public.sponsored_task_topups(status,created_at)
  where status in ('awaiting_payment','payment_pending');
SQL

python3 /tmp/v42.py
node --check "$SERVER"
grep -q "WIENER SPONSORED PAYMENT VERIFICATION V42" "$SERVER"

pm2 restart wiener-api --update-env
sleep 3

if ! ss -ltn | grep -q ':3000'; then
  echo "ERROR: wiener-api is not listening on port 3000" >&2
  exit 1
fi

echo "=== CURRENT PAYMENT STATE ==="
runuser -u postgres -- psql -d wiener_farm_final -P pager=off -c "select status,count(*) from public.exclusive_task_orders group by status order by status;"
runuser -u postgres -- psql -d wiener_farm_final -P pager=off -c "select status,count(*) from public.sponsored_task_topups group by status order by status;"
runuser -u postgres -- psql -d wiener_farm_final -P pager=off -c "select asset,network,state,amount,metadata->>'memo' memo,created_at from public.wiener_treasury_transfers where asset='TON' order by created_at desc limit 5;"

pm2 save >/dev/null
trap - ERR

echo
echo "=== V42 READY ==="
echo "Sponsored TON payment verification hardened"
echo "Automatic settlement: every 7 seconds while pending payments exist"
echo "Exact memo + treasury address + minimum amount are still required"
