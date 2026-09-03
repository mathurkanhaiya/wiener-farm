#!/usr/bin/env bash
set -euo pipefail
cd /opt/wiener-code
BACKEND=/opt/wiener-backend/server.mjs

echo '=== V19C PREPARE + SYNTAX REPAIR ==='
python3 scripts/prepare-vps-v19-full-bot.py
python3 scripts/patch-vps-v18-full-bot-parity.py
python3 scripts/patch-vps-v18b-bot-parity-fixes.py
python3 scripts/patch-vps-v19-supabase-admin-parity.py
python3 scripts/patch-vps-v19b-admin-alerts.py
python3 scripts/repair-vps-v19c-await-defaults.py

echo '=== PRE-RESTART NODE SYNTAX GATE ==='
node --check "$BACKEND"

echo '=== RECOVER BOT/API PROCESS FIRST ==='
pm2 restart wiener-api --update-env
sleep 2
code=$(curl -sS -o /tmp/v19c-recovery-smoke.txt -w '%{http_code}' -X POST -H 'content-type: application/json' --data '{}' http://127.0.0.1:3000/functions/v1/wiener-bot-webhook || true)
echo "wiener-bot-webhook -> HTTP $code"
if [[ "$code" == "000" || "$code" == "404" || "$code" == "502" ]]; then
  cat /tmp/v19c-recovery-smoke.txt 2>/dev/null || true
  echo 'ERROR: repaired backend did not recover; stopping before further changes.' >&2
  exit 1
fi
pm2 save

echo '=== CONTINUE FULL V19 INSTALLER ==='
bash scripts/install-vps-v19-admin-parity.sh
