#!/usr/bin/env bash
set -euo pipefail

echo '=== WIENER VPS V12B ==='
cd /opt/wiener-code
git pull --ff-only
python3 scripts/patch-vps-v12b-admin-ads.py
node --check /opt/wiener-backend/server.mjs
pm2 restart wiener-api
pm2 save
sleep 2

echo '=== HEALTH ==='
curl -fsS http://127.0.0.1:3000/health
echo

echo '=== ROUTE CHECKS ==='
for fn in wiener-ad-usage wiener-admin-api; do
  code=$(curl -s -o /tmp/${fn}.txt -w '%{http_code}' -X POST http://127.0.0.1:3000/functions/v1/$fn -H 'content-type: application/json' -d '{}')
  echo "$fn -> HTTP $code $(cat /tmp/${fn}.txt)"
done

echo '=== V12B DONE ==='
