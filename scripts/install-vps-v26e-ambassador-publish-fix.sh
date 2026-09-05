#!/usr/bin/env bash
set -Eeuo pipefail

CODE=/opt/wiener-code
BACKEND=/opt/wiener-backend
SERVER="$BACKEND/server.mjs"
[ -f "$SERVER" ] || SERVER="$BACKEND/server.js"
export WIENER_BACKEND_FILE="$SERVER"
STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP="$SERVER.v26e-$STAMP.bak"
OLD_APP=$(readlink -f /opt/wiener-app/current 2>/dev/null || true)

rollback(){
  rc=$?
  echo 'V26E failed; restoring backend.' >&2
  cp -f "$BACKUP" "$SERVER" 2>/dev/null || true
  pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
  if [[ -n "$OLD_APP" && -e "$OLD_APP" ]]; then ln -sfn "$OLD_APP" /opt/wiener-app/current || true; fi
  exit "$rc"
}
trap rollback ERR

cd "$CODE"
git pull --ff-only
cp "$SERVER" "$BACKUP"

echo '=== PATCH AMBASSADOR DIRECT TELEGRAM UPLOAD ==='
python3 -m py_compile scripts/patch-vps-v26e-ambassador-direct-upload.py
python3 scripts/patch-vps-v26e-ambassador-direct-upload.py
node --check "$SERVER"
grep -q 'WIENER AMBASSADOR DIRECT PHOTO UPLOAD V26E' "$SERVER"
grep -q 'sendAmbassadorPhotoV26E' "$SERVER"
grep -q '120000' src/lib.ts

echo '=== REBUILD MINI APP WITH LONGER PUBLISH TIMEOUT ==='
npm run build
[[ -f dist/index.html ]]
NEW_RELEASE="/opt/wiener-app/releases/$(date +%Y%m%d-%H%M%S)-v26e-amb-publish"
mkdir -p "$NEW_RELEASE"
cp -a dist/. "$NEW_RELEASE/"

echo '=== RESTART API + SWITCH APP ==='
pm2 restart wiener-api --update-env
sleep 3
pm2 save >/dev/null
ln -sfn "$NEW_RELEASE" /opt/wiener-app/current

echo '=== VERIFY ==='
node --check "$SERVER"
if ! ss -ltn | grep -q '127.0.0.1:3000'; then
  echo 'Backend is not listening on 127.0.0.1:3000' >&2
  exit 1
fi
code=$(curl -sS -o /tmp/wiener-v26e-route.json -w '%{http_code}' -X POST -H 'content-type: application/json' --data '{}' http://127.0.0.1:3000/functions/v1/wiener-ambassador-publish || true)
if [[ "$code" == "000" || "$code" == "404" || "$code" == "502" ]]; then
  cat /tmp/wiener-v26e-route.json 2>/dev/null || true
  echo "Ambassador publish route failed: HTTP $code" >&2
  exit 1
fi

echo '=== V26E READY ==='
echo 'Generated Ambassador banners are now uploaded directly from the VPS to Telegram; Telegram no longer fetches the banner URL.'
echo 'Mini App publish timeout is now 120 seconds.'
trap - ERR
