#!/usr/bin/env bash
set -Eeuo pipefail
CODE=/opt/wiener-code
SERVER=/opt/wiener-backend/server.mjs
[ -f "$SERVER" ] || SERVER=/opt/wiener-backend/server.js
[ -f "$SERVER" ] || { echo 'ERROR: backend file not found'; exit 1; }
cd "$CODE"
STAMP=$(date +%Y%m%d-%H%M%S)
cp -a "$SERVER" "$SERVER.before-v91-$STAMP"

echo '=== V91 AMBASSADOR PROMO REWARD ==='

runuser -u postgres -- psql -d wiener_farm_final -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;

UPDATE public.ambassador_settings
SET promo_reward_wiener=20
WHERE id=true;

-- Safely upgrade only still-unclaimed Ambassador promo codes that were created at 10 WIENER.
-- Codes already claimed by anyone keep their original economics for accounting consistency.
UPDATE public.ambassador_promos ap
SET reward_wiener=20
FROM public.promo_codes pc
WHERE pc.code=ap.code
  AND ap.status='active'
  AND ap.reward_wiener=10
  AND pc.reward=10
  AND coalesce(pc.claims_count,0)=0;

UPDATE public.promo_codes
SET reward=20
WHERE reward_type='wiener'
  AND reward=10
  AND coalesce(claims_count,0)=0
  AND note LIKE 'ambassador:%';

COMMIT;
SQL

WIENER_BACKEND_FILE="$SERVER" python3 scripts/patch-vps-v91-ambassador-promo-reward.py
node --check "$SERVER"
pm2 restart wiener-api --update-env >/dev/null
pm2 save >/dev/null
sleep 2
curl -fsS http://127.0.0.1:3000/health; echo

echo '=== VERIFY ==='
runuser -u postgres -- psql -d wiener_farm_final -P pager=off -c "select promo_reward_wiener from public.ambassador_settings where id=true;"
runuser -u postgres -- psql -d wiener_farm_final -P pager=off -c "select reward_wiener,status,count(*) from public.ambassador_promos group by reward_wiener,status order by status,reward_wiener;"
grep -n 'WIENER AMBASSADOR PROMO REWARD V91' "$SERVER" | head

echo '=== V91 READY: Ambassador promo = 20 WIENER (0.001$) ==='
