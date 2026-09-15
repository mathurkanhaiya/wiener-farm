#!/usr/bin/env bash
set -Eeuo pipefail

CODE=/opt/wiener-code
SERVER=/opt/wiener-backend/server.mjs
[ -f "$SERVER" ] || SERVER=/opt/wiener-backend/server.js
export WIENER_BACKEND_FILE="$SERVER"

cd "$CODE"
git fetch origin main
git show origin/main:scripts/patch-vps-v46-admin-settings-safe-update.py > /tmp/v46.py
python3 -m py_compile /tmp/v46.py

STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP="$SERVER.pre-v46-$STAMP"
cp "$SERVER" "$BACKUP"

rollback(){
  rc=$?
  cp -f "$BACKUP" "$SERVER" 2>/dev/null || true
  pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
  exit "$rc"
}
trap rollback ERR

python3 /tmp/v46.py
node --check "$SERVER"
grep -q "WIENER ADMIN SETTINGS SAFE UPDATE V46" "$SERVER"

pm2 restart wiener-api --update-env
sleep 2

echo "=== ADMIN SETTINGS SANITY CHECK ==="
runuser -u postgres -- psql -d wiener_farm_final -P pager=off -c "
select
  app_name,
  maintenance_enabled,
  withdrawals_enabled,
  ads_enabled,
  tasks_enabled,
  promo_enabled,
  referrals_enabled,
  farm_claim_reward,
  ad_reward,
  daily_ad_limit,
  sponsored_min_reward,
  sponsored_max_reward,
  updated_at
from public.app_settings
where id=true;
"

pm2 save >/dev/null
trap - ERR

echo
echo "=== V46 READY ==="
echo "Admin settings update fixed"
echo "No duplicate column assignments"
echo "id / updated_at / secrets are ignored"
echo "Sponsored reward min/max stay protected at 10"
