#!/usr/bin/env bash
set -Eeuo pipefail

CODE=/opt/wiener-code
SERVER=/opt/wiener-backend/server.mjs
[ -f "$SERVER" ] || SERVER=/opt/wiener-backend/server.js
export WIENER_BACKEND_FILE="$SERVER"

cd "$CODE"
git fetch origin main
git show origin/main:scripts/patch-vps-v52-spin-day-duplicate-fix.py > /tmp/v52.py
python3 -m py_compile /tmp/v52.py

STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP="$SERVER.pre-v52-$STAMP"
cp "$SERVER" "$BACKUP"
rollback(){
  rc=$?
  echo "V52 failed — restoring backend backup"
  cp -f "$BACKUP" "$SERVER" 2>/dev/null || true
  pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
  exit "$rc"
}
trap rollback ERR

python3 /tmp/v52.py
node --check "$SERVER"
grep -q "WIENER SPIN DAY FIX V52" "$SERVER"
if grep -Fq "spin_day=current_date,free_used=case when spin_day=current_date then free_used else 0 end" "$SERVER"; then
  echo "ERROR: duplicate spin_day assignment still exists"
  exit 1
fi

pm2 restart wiener-api --update-env
sleep 2
curl -fsS http://127.0.0.1:3000/health >/dev/null
pm2 save >/dev/null

trap - ERR
echo
echo "=== V52 SPIN DAY DUPLICATE FIX READY ==="
echo "- Removed duplicate spin_day assignment from ad_complete"
echo "- Removed duplicate spin_day assignment from spin"
echo "- PostgreSQL multiple-assignment error fixed"
echo "Backup: $BACKUP"
