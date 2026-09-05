#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=/opt/wiener-code
DB=wiener_farm_final
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKEND=/opt/wiener-backend/server.js

if [[ ! -f "$BACKEND" ]]; then
  PM2_BACKEND="$(pm2 jlist 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{try{const a=JSON.parse(s);const p=a.find(x=>x.name==='wiener-api');process.stdout.write(p?.pm2_env?.pm_exec_path||'')}catch{}})" || true)"
  if [[ -n "$PM2_BACKEND" && -f "$PM2_BACKEND" ]]; then BACKEND="$PM2_BACKEND"; fi
fi
if [[ ! -f "$BACKEND" && -f /opt/wiener-backend/server.mjs ]]; then BACKEND=/opt/wiener-backend/server.mjs; fi

export WIENER_BACKEND_FILE="$BACKEND"
BACKUP="${BACKEND}.v27-backup-${STAMP}"

echo '=== V27 REFERRAL FIVE-AD DISPLAY/PARITY PRECHECK ==='
echo "backend_file=$BACKEND"
[[ -f "$BACKEND" ]] || { echo 'ERROR: live backend not found'; exit 1; }
[[ -f "$ROOT/scripts/patch-vps-v27-referral-five-ad.py" ]] || { echo 'ERROR: V27 patcher missing'; exit 1; }
python3 -m py_compile "$ROOT/scripts/patch-vps-v27-referral-five-ad.py"
node --check "$BACKEND"

REQ="$(runuser -u postgres -- psql -d "$DB" -Atqc "select referral_active_ads_required from public.app_settings where id=true")"
echo "backend_referral_required_ads=$REQ"
if [[ "$REQ" != "5" ]]; then
  echo 'ERROR: backend referral rule is not currently 5 ads.'
  echo 'Refusing to change it automatically because that could retroactively reward old referrals.'
  echo 'No database rows, balances, or referral rewards were changed.'
  exit 2
fi

echo '=== SNAPSHOT OLD REFERRAL STATE (READ ONLY) ==='
BEFORE="$(runuser -u postgres -- psql -d "$DB" -Atqc "
select
  count(*) filter(where referred_by is not null)::text||'|'||
  count(*) filter(where referred_by is not null and referral_active=true)::text||'|'||
  coalesce(sum(referral_earnings),0)::text
from public.users;
")"
echo "before=$BEFORE"

echo '=== DRY-RUN BOT/API PATCH ==='
EXT="${BACKEND##*.}"
DRYRUN="/tmp/wiener-v27-dryrun-${STAMP}.${EXT}"
cp -a "$BACKEND" "$DRYRUN"
WIENER_BACKEND_FILE="$DRYRUN" python3 "$ROOT/scripts/patch-vps-v27-referral-five-ad.py"
node --check "$DRYRUN"
rm -f "$DRYRUN"
echo 'dry_run=PASS'

cp -a "$BACKEND" "$BACKUP"
rollback(){
  echo 'ERROR: V27 backend step failed; restoring backend backup.'
  cp -a "$BACKUP" "$BACKEND" || true
  node --check "$BACKEND" || true
  pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
}
trap rollback ERR

echo '=== PATCH LIVE BOT/API DISPLAY ==='
python3 "$ROOT/scripts/patch-vps-v27-referral-five-ad.py"
node --check "$BACKEND"
pm2 restart wiener-api --update-env
sleep 2
node --check "$BACKEND"

WEBHOOK="$(curl -sS -o /tmp/wiener-v27-webhook.txt -w '%{http_code}' -X POST http://127.0.0.1:3000/functions/v1/wiener-bot-webhook -H 'content-type: application/json' -d '{}' || true)"
echo "webhook_without_secret_http=$WEBHOOK"
if [[ "$WEBHOOK" == "000" || "$WEBHOOK" == "404" || "$WEBHOOK" == "502" ]]; then
  echo 'ERROR: webhook unhealthy after V27 backend patch'
  exit 1
fi

echo '=== VERIFY NO RETROACTIVE REFERRAL CHANGES ==='
AFTER="$(runuser -u postgres -- psql -d "$DB" -Atqc "
select
  count(*) filter(where referred_by is not null)::text||'|'||
  count(*) filter(where referred_by is not null and referral_active=true)::text||'|'||
  coalesce(sum(referral_earnings),0)::text
from public.users;
")"
echo "after=$AFTER"
if [[ "$BEFORE" != "$AFTER" ]]; then
  echo 'ERROR: referral state changed during display-only V27 install.'
  echo 'Backend was restored; review database state before continuing.'
  exit 1
fi

pm2 save >/dev/null
trap - ERR

echo '=== V27 NON-RETROACTIVE REFERRAL BOT FIX INSTALLED ==='
echo 'Current backend rule confirmed: 5 verified ads.'
echo 'Bot now shows one rule only: 5 verified ads = ACTIVE referral.'
echo 'No 10/20-ad reward levels are shown.'
echo 'Existing referral rows were NOT reprocessed, activated, or rewarded.'
echo 'No balances, referral earnings, payout settings, or wallet secrets were changed.'
