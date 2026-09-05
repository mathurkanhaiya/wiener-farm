#!/usr/bin/env bash
set -Eeuo pipefail
CODE=/opt/wiener-code
BACKEND=/opt/wiener-backend
STAMP=$(date +%Y%m%d-%H%M%S)
SERVER="$BACKEND/server.mjs"
[ -f "$SERVER" ] || SERVER="$BACKEND/server.js"
[ -f "$SERVER" ] || { echo 'ERROR: Wiener backend server not found'; exit 1; }
cd "$CODE"
git pull --ff-only
cp "$SERVER" "$SERVER.v26-${STAMP}.bak"

# Sharp belongs to the backend runtime because banner generation happens on the VPS API process.
cd "$BACKEND"
if ! node -e "import('sharp')" >/dev/null 2>&1; then
  npm install --save sharp
fi
cd "$CODE"
python3 scripts/patch-vps-v26-ambassador-banner.py
node --check "$SERVER"

# The template must already be hosted under one of these names. promo-code is accepted as a migration fallback.
if [ ! -f /opt/wiener-host-assets/ambassador-promo-template ] && [ ! -f /opt/wiener-host-assets/promo-code ]; then
  echo 'ERROR: Upload the supplied blank banner once with: /host ambassador-promo-template'
  echo 'Then send the image to the Wiener bot and rerun this installer.'
  exit 1
fi

pm2 restart wiener-api --update-env
sleep 2
pm2 save
curl -fsS http://127.0.0.1:3000/ >/tmp/wiener-v26-health.json

echo '=== WIENER AMBASSADOR BANNER V26 INSTALLED ==='
echo 'Ambassador publish now generates AMBxxxxxxx, renders it on the ticket template, hosts the PNG, and posts that unique banner to each eligible ambassador channel.'
