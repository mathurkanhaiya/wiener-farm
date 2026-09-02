#!/bin/bash
set -euo pipefail

echo '=== WIENER VPS BULK MIGRATION V10 ==='
cd /opt/wiener-code
git pull --ff-only

echo '=== APPLY COMPATIBILITY PATCHES ==='
python3 scripts/patch-vps-v9.py
python3 scripts/patch-vps-v10-all.py

echo '=== INSTALL PAYOUT RUNTIME DEPENDENCIES ==='
cd /opt/wiener-backend
npm install --no-audit --no-fund viem @ton/core@0.59.1 @ton/ton@15.1.0 @ton/crypto@3.3.0

echo '=== SYNTAX CHECK ==='
node --check server.mjs

echo '=== RESTART ==='
pm2 restart wiener-api --update-env
pm2 save
sleep 3

echo '=== HEALTH ==='
curl -fsS http://127.0.0.1:3000/health
echo

echo '=== ROUTE SMOKE TESTS ==='
# Empty unauthenticated calls must be rejected by auth, not 404.
for fn in wiener-referral-status wiener-withdraw-internal wiener-payout wiener-ton-payout wiener-notify wiener-broadcast-run wiener-notification-worker; do
  code=$(curl -s -o /tmp/wiener-v10-test.out -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' "http://127.0.0.1:3000/functions/v1/$fn" || true)
  body=$(head -c 180 /tmp/wiener-v10-test.out 2>/dev/null || true)
  echo "$fn -> HTTP $code $body"
done

echo '=== CRON ==='
timeout 100 /usr/local/bin/wiener-cron.sh || true
cat /var/log/wiener-cron.log 2>/dev/null || true
echo

echo '=== DONE ==='
echo 'V10 installed. Keep payout settings disabled until status/preflight checks are verified.'
