#!/usr/bin/env bash
set -euo pipefail
cd /opt/wiener-code
git pull --ff-only
python3 scripts/patch-vps-v13-app-parity.py
node --check /opt/wiener-backend/server.mjs
pm2 restart wiener-api
pm2 save
sleep 2
echo '=== HEALTH ==='
curl -fsS http://127.0.0.1:3000/health
echo
echo '=== SPECIAL TASK ADMIN AUTH SMOKE ==='
code=$(curl -sS -o /tmp/v13-special.out -w '%{http_code}' -X POST http://127.0.0.1:3000/functions/v1/wiener-special-task-admin -H 'content-type: application/json' -d '{}')
echo "HTTP $code $(cat /tmp/v13-special.out)"
echo '=== ADSGRAM CALLBACK AUTH SMOKE ==='
code=$(curl -sS -o /tmp/v13-ads.out -w '%{http_code}' 'http://127.0.0.1:3000/functions/v1/wiener-adsgram-reward?userId=1&secret=bad')
echo "HTTP $code $(cat /tmp/v13-ads.out)"
echo '=== V13 APP PARITY DONE ==='
