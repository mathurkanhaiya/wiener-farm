#!/usr/bin/env bash
set -Eeuo pipefail

CODE=/opt/wiener-code
SERVER=/opt/wiener-backend/server.mjs
[ -f "$SERVER" ] || SERVER=/opt/wiener-backend/server.js
export WIENER_BACKEND_FILE="$SERVER"

cd "$CODE"
git fetch origin main
git show origin/main:scripts/patch-vps-v48-spin-earn.py > /tmp/v48.py
python3 -m py_compile /tmp/v48.py

STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP="$SERVER.pre-v48-$STAMP"
cp "$SERVER" "$BACKUP"

rollback(){
  rc=$?
  echo "V48 failed — restoring backend backup"
  cp -f "$BACKUP" "$SERVER" 2>/dev/null || true
  pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
  exit "$rc"
}
trap rollback ERR

python3 /tmp/v48.py
node --check "$SERVER"
grep -q "WIENER SPIN EARN V48" "$SERVER"

pm2 restart wiener-api --update-env
sleep 2
curl -fsS http://127.0.0.1:3000/health >/dev/null
pm2 save >/dev/null

trap - ERR
echo
echo "=== V48 SPIN & EARN READY ==="
echo "- 1 daily free spin"
echo "- Up to 3 rewarded-ad spins/day"
echo "- WIENER + TON + extra-spin prizes"
echo "- Separate per-user Spin TON balance"
echo "- TON withdrawal request minimum: 0.02 TON"
echo "- Server-side prize RNG + idempotent spin credits"
echo "Backup: $BACKUP"
