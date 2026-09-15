#!/usr/bin/env bash
set -Eeuo pipefail

CODE=/opt/wiener-code
SERVER=/opt/wiener-backend/server.mjs
[ -f "$SERVER" ] || SERVER=/opt/wiener-backend/server.js
export WIENER_BACKEND_FILE="$SERVER"

cd "$CODE"
git fetch origin main
git show origin/main:scripts/patch-vps-v47b-copyable-sponsored-payment.py > /tmp/v47b.py
python3 -m py_compile /tmp/v47b.py

STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP="$SERVER.pre-v47b-$STAMP"
cp "$SERVER" "$BACKUP"

rollback(){
  rc=$?
  cp -f "$BACKUP" "$SERVER" 2>/dev/null || true
  pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
  exit "$rc"
}
trap rollback ERR

python3 /tmp/v47b.py
node --check "$SERVER"
grep -q "WIENER COPYABLE SPONSORED PAYMENT V47B" "$SERVER"

pm2 restart wiener-api --update-env
sleep 2
pm2 save >/dev/null

trap - ERR
echo
echo "=== V47B READY ==="
echo "Sponsored TON payment fields are copyable"
echo "Initial payment + pending campaign + top-up updated"
