#!/usr/bin/env bash
set -euo pipefail

cd /opt/wiener-code
git fetch origin main

BACKEND=/opt/wiener-backend/server.mjs
BACKUP=/opt/wiener-backend/server.mjs.pre-v36-sponsored
V35=/tmp/v35b-addtask.py
V36=/tmp/v36-sponsored.py

git show origin/main:scripts/patch-vps-v35b-addtask-fix.py > "$V35"
git show origin/main:scripts/patch-vps-v36-sponsored-insights.py > "$V36"

python3 -m py_compile "$V35"
python3 -m py_compile "$V36"

cp "$BACKEND" "$BACKUP"

rollback() {
  cp "$BACKUP" "$BACKEND"
  pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
}
trap rollback ERR

if ! grep -q "WIENER ADDTASK V35B" "$BACKEND"; then
  python3 "$V35"
fi

python3 "$V36"

node --check "$BACKEND"
grep -q "WIENER SPONSORED INSIGHTS V36" "$BACKEND"

pm2 restart wiener-api --update-env
sleep 2
pm2 save >/dev/null

trap - ERR

echo "=== V36 READY ==="
echo "/addtask: analytics + history + duplicate + smart alerts + clean top-ups"
