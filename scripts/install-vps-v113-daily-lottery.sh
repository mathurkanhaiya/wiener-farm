#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd /opt/wiener-code
BACKEND=/opt/wiener-backend/server.mjs
[[ -f "$BACKEND" ]] || BACKEND=/opt/wiener-backend/server.js
[[ -f "$BACKEND" ]] || { echo 'ERROR: backend missing'; exit 1; }
node --check "$BACKEND"
BACKUP="${BACKEND}.before-v113-$(date +%Y%m%d-%H%M%S)"
cp -a "$BACKEND" "$BACKUP"
rollback(){ cp -a "$BACKUP" "$BACKEND"; pm2 restart wiener-api --update-env || true; echo "Install failed; restored $BACKUP"; }
trap rollback ERR
WIENER_BACKEND_FILE="$BACKEND" python3 "$SCRIPT_DIR/patch-vps-v113-daily-lottery.py"
node --check "$BACKEND"
pm2 restart wiener-api --update-env
sleep 2
curl --max-time 10 -fsS http://127.0.0.1:3000/health
grep -q 'WIENER DAILY LOTTERY V113' "$BACKEND"
trap - ERR
echo
echo 'V113 installed: Daily Lottery backend active.'
echo '100 WIENER/ticket · 2 unique users minimum · 80% winner · 20% platform · automatic refund below minimum.'
