#!/usr/bin/env bash
set -Eeuo pipefail

CODE=/opt/wiener-code
BACKEND=/opt/wiener-backend
SERVER="$BACKEND/server.mjs"
[ -f "$SERVER" ] || SERVER="$BACKEND/server.js"
export WIENER_BACKEND_FILE="$SERVER"

STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP="$SERVER.v33b-$STAMP.bak"

rollback(){
  rc=$?
  echo "V33B failed; restoring backend." >&2
  cp -f "$BACKUP" "$SERVER" 2>/dev/null || true
  pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
  exit "$rc"
}
trap rollback ERR

cd "$CODE"
cp "$SERVER" "$BACKUP"

git fetch origin main
git show origin/main:scripts/patch-vps-v33b-games-balance-after.py > /tmp/wiener-v33b.py

python3 -m py_compile /tmp/wiener-v33b.py
python3 /tmp/wiener-v33b.py
node --check "$SERVER"

grep -q "WIENER GROUP GAMES V33B BALANCE AFTER" "$SERVER"
grep -q "balance_after,kind,description,metadata" "$SERVER"

pm2 restart wiener-api --update-env
sleep 3

if ! ss -ltn | grep -q ':3000'; then
  echo "Backend is not listening on port 3000." >&2
  exit 1
fi

pm2 save >/dev/null

echo
echo "=== V33B READY ==="
echo "The transactions.balance_after game error is fixed."
echo "Test /games and start a 20 WIENER match."
trap - ERR
