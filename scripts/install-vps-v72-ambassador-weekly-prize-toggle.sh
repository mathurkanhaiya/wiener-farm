#!/usr/bin/env bash
set -Eeuo pipefail

CODE=/opt/wiener-code
BACKEND=/opt/wiener-backend
SERVER="$BACKEND/server.mjs"
[ -f "$SERVER" ] || SERVER="$BACKEND/server.js"
export WIENER_BACKEND_FILE="$SERVER"
STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP="$SERVER.v72-amb-weekly-toggle-$STAMP.bak"
OLD_APP=$(readlink -f /opt/wiener-app/current 2>/dev/null || true)
NEW_RELEASE=''

[ -f "$SERVER" ] || { echo 'ERROR: live Wiener backend not found'; exit 1; }
[ -d "$CODE/.git" ] || { echo 'ERROR: /opt/wiener-code is not a git checkout'; exit 1; }

rollback(){
  rc=$?
  echo 'V72 failed; restoring backend/app.' >&2
  cp -f "$BACKUP" "$SERVER" 2>/dev/null || true
  pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
  if [[ -n "$OLD_APP" && -e "$OLD_APP" ]]; then ln -sfn "$OLD_APP" /opt/wiener-app/current || true; fi
  exit "$rc"
}
trap rollback ERR

cd "$CODE"
git pull --ff-only
cp "$SERVER" "$BACKUP"

echo '=== DATABASE ==='
runuser -u postgres -- psql -d wiener_farm_final -v ON_ERROR_STOP=1 <<'SQL'
alter table public.ambassador_settings
  add column if not exists weekly_prizes_enabled boolean not null default true;
SQL

echo '=== PATCH BACKEND + MINI APP ==='
python3 -m py_compile scripts/patch-vps-v72-ambassador-weekly-prize-toggle.py
python3 scripts/patch-vps-v72-ambassador-weekly-prize-toggle.py
node --check "$SERVER"
grep -q 'WIENER AMBASSADOR WEEKLY PRIZE TOGGLE V72' "$SERVER"
grep -q 'weekly_prizes_enabled' "$SERVER"
grep -q 'TURN WEEKLY PRIZES OFF' src/Ambassador.tsx

echo '=== BUILD MINI APP ==='
npm run build
[[ -f dist/index.html ]]
NEW_RELEASE="/opt/wiener-app/releases/$(date +%Y%m%d-%H%M%S)-v72-amb-weekly-toggle"
mkdir -p "$NEW_RELEASE"
cp -a dist/. "$NEW_RELEASE/"

echo '=== RESTART + SWITCH ==='
pm2 restart wiener-api --update-env
sleep 2
pm2 save >/dev/null
ln -sfn "$NEW_RELEASE" /opt/wiener-app/current

echo '=== VERIFY ==='
runuser -u postgres -- psql -d wiener_farm_final -P pager=off -Atc "select 'weekly_prizes_enabled='||weekly_prizes_enabled from public.ambassador_settings where id=true;"
code=$(curl -sS -o /tmp/wiener-v72-board.json -w '%{http_code}' -X POST -H 'content-type: application/json' --data '{}' http://127.0.0.1:3000/functions/v1/wiener-ambassador-board || true)
if [[ "$code" == "000" || "$code" == "404" || "$code" == "502" ]]; then
  cat /tmp/wiener-v72-board.json 2>/dev/null || true
  echo "Ambassador board smoke failed: HTTP $code" >&2
  exit 1
fi
echo "Ambassador board protected smoke: HTTP $code"
echo 'V72 installed successfully.'
echo 'Admin can now toggle Weekly League prizes ON/OFF. Leaderboard, ranks and valid-claim tracking remain active.'

trap - ERR
