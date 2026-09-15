#!/usr/bin/env bash
set -euo pipefail

cd /opt/wiener-code
git fetch origin main

BACKEND=/opt/wiener-backend/server.mjs
BACKUP=/opt/wiener-backend/server.mjs.pre-v38-fixed-reward
V35=/tmp/v35b-addtask.py
V36=/tmp/v36-sponsored.py
V37=/tmp/v37-sponsored-mini-app.py
V38=/tmp/v38-fixed-reward.py

git show origin/main:scripts/patch-vps-v35b-addtask-fix.py > "$V35"
git show origin/main:scripts/patch-vps-v36-sponsored-insights.py > "$V36"
git show origin/main:scripts/patch-vps-v37-sponsored-mini-app.py > "$V37"
git show origin/main:scripts/patch-vps-v38-fixed-sponsored-reward.py > "$V38"

python3 -m py_compile "$V35"
python3 -m py_compile "$V36"
python3 -m py_compile "$V37"
python3 -m py_compile "$V38"

cp "$BACKEND" "$BACKUP"

rollback() {
  cp "$BACKUP" "$BACKEND"
  pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
}
trap rollback ERR

if ! grep -q "WIENER ADDTASK V35B" "$BACKEND"; then
  python3 "$V35"
fi

if ! grep -q "WIENER SPONSORED INSIGHTS V36" "$BACKEND"; then
  python3 "$V36"
fi

if ! grep -q "WIENER SPONSORED MINI APP V37" "$BACKEND"; then
  python3 "$V37"
fi

python3 "$V38"

node --check "$BACKEND"
grep -q "WIENER SPONSORED FIXED REWARD V38" "$BACKEND"

runuser -u postgres -- psql -d wiener_farm_final -v ON_ERROR_STOP=1 -c "UPDATE public.app_settings SET sponsored_min_reward=10, sponsored_max_reward=10, updated_at=now() WHERE id=true;"

pm2 restart wiener-api --update-env
sleep 2
pm2 save >/dev/null

trap - ERR

echo "=== V38 READY ==="
echo "/addtask reward fixed at 10 WIENER · other WIENER reward prices removed"
