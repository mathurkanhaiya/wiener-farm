#!/usr/bin/env bash
set -euo pipefail

cd /opt/wiener-code
git fetch origin main

BACKEND=/opt/wiener-backend/server.mjs
BACKUP=/opt/wiener-backend/server.mjs.pre-v37-mini-app
PATCH=/tmp/v37-sponsored-mini-app.py

git show origin/main:scripts/patch-vps-v37-sponsored-mini-app.py > "$PATCH"
python3 -m py_compile "$PATCH"

cp "$BACKEND" "$BACKUP"

rollback() {
  cp "$BACKUP" "$BACKEND"
  pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
}
trap rollback ERR

python3 "$PATCH"
node --check "$BACKEND"
grep -q "WIENER SPONSORED MINI APP V37" "$BACKEND"

pm2 restart wiener-api --update-env
sleep 2
pm2 save >/dev/null

trap - ERR

echo "=== V37 READY ==="
echo "/addtask supports Channel + Group + Mini App (Launch Tracked)"
