#!/usr/bin/env bash
set -euo pipefail
cd /opt/wiener-code
BACKEND=/opt/wiener-backend/server.mjs

echo '=== ENSURE V22 SILENT ARCHIVE BASE ==='
bash scripts/install-vps-v22-withdraw-archive.sh

STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP="${BACKEND}.v22b-${STAMP}.bak"
cp -a "$BACKEND" "$BACKUP"
rollback(){
  rc=$?
  if [ "$rc" -ne 0 ]; then
    echo 'ERROR: V22B install failed; restoring working backend backup.' >&2
    cp -a "$BACKUP" "$BACKEND"
    node --check "$BACKEND" >/dev/null 2>&1 || true
    pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
  fi
  exit "$rc"
}
trap rollback EXIT

echo '=== INSTALL BULK SILENT CLEAR ==='
python3 scripts/patch-vps-v22b-bulk-withdraw-archive.py

echo '=== PRE-RESTART SAFETY GATE ==='
node --check "$BACKEND"
grep -Fq 'WIENER VPS BULK SILENT WITHDRAW ARCHIVE V22B' "$BACKEND"
grep -Fq 'warc22b:confirm' "$BACKEND"
grep -Fq 'archiveWithdrawal22' "$BACKEND"
grep -Fq 'payout_already_started' "$BACKEND"

echo '=== RESTART VPS API/BOT ==='
pm2 restart wiener-api --update-env
pm2 save
sleep 2
code=$(curl -sS -o /tmp/v22b-webhook.out -w '%{http_code}' -X POST -H 'content-type: application/json' -d '{}' http://127.0.0.1:3000/functions/v1/wiener-bot-webhook || true)
echo "wiener-bot-webhook -> HTTP $code"
[[ "$code" != "000" && "$code" != "404" && "$code" != "502" ]] || { echo 'ERROR: webhook smoke failed' >&2; exit 1; }

pending=$(runuser -u postgres -- psql -d wiener_farm_final -Atqc "select count(*) from public.withdrawals where status='pending'")
echo "pending_withdrawals_before_clear=$pending"
echo '=== V22B BULK SILENT CLEAR INSTALLED ==='
echo 'Use: /archivewithdraw all'
echo 'Telegram will show a 2-minute confirmation button before changing anything.'
echo 'Eligible pending requests use the existing rejection/refund accounting path.'
echo 'No user Telegram rejection messages are sent.'
echo 'Payouts already in flight are skipped.'
echo 'Financial and admin audit records are preserved.'
echo 'This installer itself modified no withdrawal.'
trap - EXIT
