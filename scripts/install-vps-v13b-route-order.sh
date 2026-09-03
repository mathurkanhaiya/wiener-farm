#!/usr/bin/env bash
set -euo pipefail
cd /opt/wiener-code
git pull --ff-only
python3 scripts/patch-vps-v13b-route-order.py
node --check /opt/wiener-backend/server.mjs
pm2 restart wiener-api
pm2 save
sleep 2
echo '=== HEALTH ==='
curl -fsS http://127.0.0.1:3000/health; echo
echo '=== SPECIAL TASK ADMIN AUTH SMOKE ==='
code=$(curl -s -o /tmp/wiener-v13b-special.txt -w '%{http_code}' -X POST http://127.0.0.1:3000/functions/v1/wiener-special-task-admin -H 'content-type: application/json' -d '{"action":"list"}')
echo "HTTP $code $(cat /tmp/wiener-v13b-special.txt)"
if [ "$code" = "404" ]; then echo 'ERROR: special-task route still shadowed'; exit 1; fi
echo '=== ADSGRAM CALLBACK AUTH SMOKE ==='
code=$(curl -s -o /tmp/wiener-v13b-adsgram.txt -w '%{http_code}' 'http://127.0.0.1:3000/functions/v1/wiener-adsgram-reward?userId=12345&secret=invalid')
echo "HTTP $code $(cat /tmp/wiener-v13b-adsgram.txt)"
if [ "$code" = "404" ]; then echo 'ERROR: adsgram callback route still shadowed'; exit 1; fi
echo '=== V13B ROUTE ORDER DONE ==='
