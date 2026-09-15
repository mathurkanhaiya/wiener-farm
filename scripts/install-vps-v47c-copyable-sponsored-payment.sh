#!/usr/bin/env bash
set -Eeuo pipefail

CODE=/opt/wiener-code
SERVER=/opt/wiener-backend/server.mjs
[ -f "$SERVER" ] || SERVER=/opt/wiener-backend/server.js
export WIENER_BACKEND_FILE="$SERVER"

cd "$CODE"
git fetch origin main
git show origin/main:scripts/patch-vps-v47c-copyable-sponsored-payment.py > /tmp/v47c.py
python3 -m py_compile /tmp/v47c.py

STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP="$SERVER.pre-v47c-$STAMP"
cp "$SERVER" "$BACKUP"

rollback(){
  rc=$?
  cp -f "$BACKUP" "$SERVER" 2>/dev/null || true
  pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
  exit "$rc"
}
trap rollback ERR

python3 /tmp/v47c.py
node --check "$SERVER"
grep -q "WIENER COPYABLE SPONSORED PAYMENT V47C" "$SERVER"

pm2 restart wiener-api --update-env
sleep 2
pm2 save >/dev/null

trap - ERR
echo
echo "=== V47C READY ==="
echo "Sponsored TON payment amount/address/memo are copyable"
echo "Initial payment + pending campaign + top-up payment updated"
