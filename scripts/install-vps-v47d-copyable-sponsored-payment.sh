#!/usr/bin/env bash
set -Eeuo pipefail

CODE=/opt/wiener-code
SERVER=/opt/wiener-backend/server.mjs
[ -f "$SERVER" ] || SERVER=/opt/wiener-backend/server.js
export WIENER_BACKEND_FILE="$SERVER"

cd "$CODE"
git fetch origin main
git show origin/main:scripts/patch-vps-v47d-copyable-sponsored-payment.py > /tmp/v47d.py
python3 -m py_compile /tmp/v47d.py

STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP="$SERVER.pre-v47d-$STAMP"
cp "$SERVER" "$BACKUP"

rollback(){
  rc=$?
  cp -f "$BACKUP" "$SERVER" 2>/dev/null || true
  pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
  exit "$rc"
}
trap rollback ERR

python3 /tmp/v47d.py
node --check "$SERVER"
grep -q "WIENER COPYABLE SPONSORED PAYMENT V47D" "$SERVER"

pm2 restart wiener-api --update-env
sleep 2
pm2 save >/dev/null

trap - ERR
echo
echo "=== V47D READY ==="
echo "Sponsored TON amount/address/memo are copyable"
echo "Initial + pending campaign + top-up payment cards updated"
