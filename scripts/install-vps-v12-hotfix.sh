#!/usr/bin/env bash
set -euo pipefail

echo '=== WIENER VPS V12 HOTFIX ==='
cd /opt/wiener-code
git pull --ff-only
python3 scripts/patch-vps-v12-hotfix.py
node --check /opt/wiener-backend/server.mjs
pm2 restart wiener-api
pm2 save
sleep 2

echo '=== HEALTH ==='
curl -fsS http://127.0.0.1:3000/health
echo

echo '=== AD USAGE ROUTE SMOKE ==='
code=$(curl -s -o /tmp/wiener-ad-usage-smoke.txt -w '%{http_code}' -X POST http://127.0.0.1:3000/functions/v1/wiener-ad-usage -H 'content-type: application/json' -d '{}')
echo "wiener-ad-usage -> HTTP $code $(cat /tmp/wiener-ad-usage-smoke.txt)"

echo '=== V12 HOTFIX DONE ==='
