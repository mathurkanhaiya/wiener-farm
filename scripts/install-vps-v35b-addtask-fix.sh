#!/usr/bin/env bash
set -euo pipefail

cd /opt/wiener-code
git fetch origin main
git show origin/main:scripts/patch-vps-v35b-addtask-fix.py > /tmp/v35b-addtask.py
python3 -m py_compile /tmp/v35b-addtask.py

BACKEND=/opt/wiener-backend/server.mjs
BACKUP=/opt/wiener-backend/server.mjs.pre-v35b-addtask
cp "$BACKEND" "$BACKUP"

rollback() {
  cp "$BACKUP" "$BACKEND"
  pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
}
trap rollback ERR

python3 /tmp/v35b-addtask.py
node --check "$BACKEND"
grep -q "WIENER ADDTASK V35B" "$BACKEND"

pm2 restart wiener-api --update-env
sleep 2
pm2 save >/dev/null

trap - ERR
echo "=== V35B READY ==="
echo "/addtask Task Studio fixed"
