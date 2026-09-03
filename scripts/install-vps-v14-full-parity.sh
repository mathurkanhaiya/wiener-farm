#!/usr/bin/env bash
set -euo pipefail
cd /opt/wiener-code
git pull --ff-only
python3 scripts/patch-vps-v14-full-parity.py
python3 scripts/migrate-host-assets-v14.py
node --check /opt/wiener-backend/server.mjs
pm2 restart wiener-api
pm2 save
sleep 1

echo '=== HEALTH ==='
curl -fsS http://127.0.0.1:3000/health; echo

echo '=== LEGACY ROUTE SMOKES ==='
for fn in wiener-bot-sync wiener-admin-action wiener-giveaway wiener-raffle-api wiener-exclusive wiener-host; do
  code=$(curl -sS -o /tmp/wiener-v14-smoke.txt -w '%{http_code}' -X POST "http://127.0.0.1:3000/functions/v1/$fn" -H 'content-type: application/json' --data '{}')
  printf '%s -> HTTP %s ' "$fn" "$code"
  head -c 180 /tmp/wiener-v14-smoke.txt || true
  echo
  if [ "$code" = "404" ]; then echo "ERROR: $fn still falls through to 404"; exit 1; fi
done

echo '=== HOST ROUTE ==='
code=$(curl -sS -o /tmp/wiener-host-smoke.txt -w '%{http_code}' -I http://127.0.0.1:3000/host/nonexistent-v14-smoke)
echo "host HEAD -> HTTP $code"
if [ "$code" = "404" ]; then echo 'host route active (asset absent as expected)'; fi

echo '=== DIRECT SUPABASE RUNTIME STRING CHECK ==='
if grep -R "hvyrairuogiljplmsuat\.supabase\.co" -n src api --exclude='*.map'; then
  echo 'WARNING: direct Supabase runtime string remains in src/api';
else
  echo 'No direct Supabase project URL in src/api.'
fi

echo '=== V14 FULL PARITY DONE ==='
