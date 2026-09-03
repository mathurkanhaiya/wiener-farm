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

echo '=== CONTINUE FULL V19 INSTALLER ==='
bash scripts/install-vps-v19-admin-parity.sh
