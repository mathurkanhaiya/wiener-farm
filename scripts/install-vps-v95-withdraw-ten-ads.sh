#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=/opt/wiener-code
BACKEND=/opt/wiener-backend/server.js
if [[ ! -f "$BACKEND" ]]; then
  PM2_BACKEND="$(pm2 jlist 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{try{const a=JSON.parse(s);const p=a.find(x=>x.name==='wiener-api');process.stdout.write(p?.pm2_env?.pm_exec_path||'')}catch{}})" || true)"
  if [[ -n "$PM2_BACKEND" && -f "$PM2_BACKEND" ]]; then BACKEND="$PM2_BACKEND"; fi
fi
export WIENER_BACKEND_FILE="$BACKEND"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${BACKEND}.v95-backup-${STAMP}"

echo '=== V95 WITHDRAW 10-ADS PRECHECK ==='
echo "backend_file=$BACKEND"
[[ -f "$BACKEND" ]] || { echo 'ERROR: live backend not found'; exit 1; }
[[ -f "$ROOT/scripts/patch-vps-v95-withdraw-ten-ads.py" ]] || { echo 'ERROR: V95 patcher not found'; exit 1; }
node --check "$BACKEND"
grep -q 'WIENER WITHDRAW AD UNLOCK V24' "$BACKEND" || { echo 'ERROR: existing V24 gate not found; nothing changed'; exit 1; }
cp -a "$BACKEND" "$BACKUP"

rollback(){
  echo 'ERROR: V95 failed; restoring backend backup.'
  cp -a "$BACKUP" "$BACKEND" || true
  node --check "$BACKEND" || true
  pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
}
trap rollback ERR

echo '=== PATCH REQUIREMENT 5 -> 10 ==='
python3 "$ROOT/scripts/patch-vps-v95-withdraw-ten-ads.py"
node --check "$BACKEND"

echo '=== VERIFY PATCH ==='
grep -nE "withdraw_ad_status|withdrawAdCount<10|withdraw_ads_required_.*of_10" "$BACKEND" | head -20
if grep -q "withdrawAdCount<5" "$BACKEND"; then
  echo 'ERROR: old 5-ad server guard still present.'
  exit 1
fi

echo '=== RESTART API ==='
pm2 restart wiener-api --update-env
pm2 save >/dev/null
sleep 2
curl -fsS http://127.0.0.1:3000/health
printf '\n'

trap - ERR
echo '=== V95 READY ==='
echo 'Withdrawal unlock: 10 completed sponsor ads per UTC day.'
echo 'Watching the first ad does NOT enter the withdrawal form.'
echo 'The wallet/withdrawal form appears only after 10/10.'
echo 'Existing balances, fees, minimums, cooldowns and withdrawal records were not changed.'
