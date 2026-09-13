#!/usr/bin/env bash
set -euo pipefail
REPO=/opt/wiener-code
BACKEND_DIR=/opt/wiener-backend
PM2_APP=wiener-api
cd "$REPO"
BACKEND_FILE=""
for f in "$BACKEND_DIR/server.mjs" "$BACKEND_DIR/server.js"; do [ -f "$f" ] && { BACKEND_FILE="$f"; break; }; done
[ -n "$BACKEND_FILE" ] || { echo 'ERROR: backend server file not found'; exit 1; }
BACKUP="${BACKEND_FILE}.v99.$(date +%Y%m%d-%H%M%S).bak"
cp -a "$BACKEND_FILE" "$BACKUP"
echo "Backup: $BACKUP"
rollback(){ echo 'V99 install failed — restoring backend'; cp -a "$BACKUP" "$BACKEND_FILE" || true; pm2 restart "$PM2_APP" --update-env >/dev/null 2>&1 || true; }
trap rollback ERR
WIENER_BACKEND_FILE="$BACKEND_FILE" python3 scripts/patch-vps-v99-referral-alerts.py
node --check "$BACKEND_FILE"
pm2 restart "$PM2_APP" --update-env
sleep 2
curl -fsS http://127.0.0.1:3000/health
echo
grep -q 'WIENER REFERRAL ALERTS V99' "$BACKEND_FILE"
trap - ERR
echo '=== V99 REFERRAL + ADMIN ALERTS READY ==='
echo 'Admin: detailed new-referral user/security/activity alert.'
echo 'Inviter: clean join reward + final qualification reward alerts.'
echo 'No per-ad notification spam. Referral reward/accounting values unchanged.'
