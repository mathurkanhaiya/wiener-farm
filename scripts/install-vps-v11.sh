#!/bin/bash
set -euo pipefail

echo '=== WIENER VPS PARITY V11 ==='
cd /opt/wiener-code
git pull --ff-only

python3 scripts/patch-vps-v11a-router.py
python3 scripts/patch-vps-v11b-notifications.py

cd /opt/wiener-backend
node --check server.mjs
pm2 restart wiener-api --update-env
pm2 save
sleep 3

echo '=== HEALTH ==='
curl -fsS http://127.0.0.1:3000/health
echo

echo '=== BOT WEBHOOK AUTH TEST ==='
code=$(curl -s -o /tmp/w11bot.out -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' http://127.0.0.1:3000/functions/v1/wiener-bot-webhook || true)
echo "wiener-bot-webhook -> HTTP $code $(head -c 180 /tmp/w11bot.out 2>/dev/null || true)"

echo '=== CRON PARITY TEST ==='
timeout 100 /usr/local/bin/wiener-cron.sh || true
cat /var/log/wiener-cron.log 2>/dev/null || true
echo

echo '=== V11 DONE ==='
