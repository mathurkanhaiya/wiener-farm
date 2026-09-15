#!/usr/bin/env bash
set -Eeuo pipefail

CODE=/opt/wiener-code
BACKEND=/opt/wiener-backend
SERVER="$BACKEND/server.mjs"
[ -f "$SERVER" ] || SERVER="$BACKEND/server.js"
export WIENER_BACKEND_FILE="$SERVER"
STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP="$SERVER.v73-spin-$STAMP.bak"
FRONT_BACKUP="/tmp/SpinEarn.tsx.v73-$STAMP.bak"
OLD_APP=$(readlink -f /opt/wiener-app/current 2>/dev/null || true)
NEW_RELEASE=''

[ -f "$SERVER" ] || { echo 'ERROR: live Wiener backend not found'; exit 1; }
[ -d "$CODE/.git" ] || { echo 'ERROR: /opt/wiener-code is not a git checkout'; exit 1; }

rollback(){
  rc=$?
  echo 'V73 failed; restoring backend/frontend/app.' >&2
  cp -f "$BACKUP" "$SERVER" 2>/dev/null || true
  cp -f "$FRONT_BACKUP" "$CODE/src/SpinEarn.tsx" 2>/dev/null || true
  pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
  if [[ -n "$OLD_APP" && -e "$OLD_APP" ]]; then ln -sfn "$OLD_APP" /opt/wiener-app/current || true; fi
  exit "$rc"
}
trap rollback ERR

cd "$CODE"
git pull --ff-only
cp "$SERVER" "$BACKUP"
cp src/SpinEarn.tsx "$FRONT_BACKUP"

echo '=== PATCH SPIN BACKEND + FRONTEND ==='
python3 -m py_compile scripts/patch-vps-v73-spin-rewards-20-max.py
python3 scripts/patch-vps-v73-spin-rewards-20-max.py
node --check "$SERVER"

grep -q "amount:20,index:8,weight:4000" "$SERVER"
! grep -q "amount:30,index:6" "$SERVER"
! grep -q "amount:50,index:8" "$SERVER"
grep -q "15 WIENER" src/SpinEarn.tsx
grep -q "20 WIENER" src/SpinEarn.tsx
! grep -q "30 WIENER" src/SpinEarn.tsx
! grep -q "50 WIENER" src/SpinEarn.tsx
! grep -q "YOU WON" src/SpinEarn.tsx

echo '=== BUILD MINI APP ==='
npm run build
[[ -f dist/index.html ]]
NEW_RELEASE="/opt/wiener-app/releases/$(date +%Y%m%d-%H%M%S)-v73-spin-20-max"
mkdir -p "$NEW_RELEASE"
cp -a dist/. "$NEW_RELEASE/"

echo '=== RESTART + SWITCH ==='
pm2 restart wiener-api --update-env
sleep 2
pm2 save >/dev/null
ln -sfn "$NEW_RELEASE" /opt/wiener-app/current

echo '=== VERIFY ==='
code=$(curl -sS -o /tmp/wiener-v73-spin.json -w '%{http_code}' -X POST -H 'content-type: application/json' --data '{}' http://127.0.0.1:3000/functions/v1/wiener-spin || true)
if [[ "$code" == "000" || "$code" == "404" || "$code" == "502" ]]; then
  cat /tmp/wiener-v73-spin.json 2>/dev/null || true
  echo "Spin smoke failed: HTTP $code" >&2
  exit 1
fi
echo "Spin protected smoke: HTTP $code"
echo 'V73 installed successfully.'
echo 'WIENER wheel max is 20. Duplicate YOU WON banner removed. TON and spin rewards remain enabled.'

trap - ERR
