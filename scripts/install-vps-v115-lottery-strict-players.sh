#!/usr/bin/env bash
set -euo pipefail
cd /opt/wiener-code
BACKEND=/opt/wiener-backend/server.mjs
[[ -f "$BACKEND" ]] || BACKEND=/opt/wiener-backend/server.js
cp -a "$BACKEND" "${BACKEND}.before-v115-$(date +%Y%m%d-%H%M%S)"
WIENER_BACKEND_FILE="$BACKEND" python3 scripts/patch-vps-v115-lottery-strict-players.py
node --check "$BACKEND"
pm2 restart wiener-api --update-env
sleep 2
curl --max-time 10 -fsS http://127.0.0.1:3000/health
echo
echo 'V115 active: strict 15s Lottery ad + player chance list.'
