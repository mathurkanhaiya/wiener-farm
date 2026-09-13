#!/usr/bin/env bash
set -euo pipefail
cd /opt/wiener-code

echo '=== V97 OFFERWALL.GG PRECHECK ==='
BACKEND_FILE="$(node -e "try{const j=require('/root/.pm2/dump.pm2');const a=j.find(x=>x.name==='wiener-api');if(a&&a.pm_exec_path)process.stdout.write(a.pm_exec_path)}catch(e){}" 2>/dev/null || true)"
if [ -z "${BACKEND_FILE:-}" ] || [ ! -f "$BACKEND_FILE" ]; then
  if [ -f /opt/wiener-backend/server.mjs ]; then BACKEND_FILE=/opt/wiener-backend/server.mjs; else BACKEND_FILE=/opt/wiener-backend/server.js; fi
fi
[ -f "$BACKEND_FILE" ] || { echo 'ERROR: backend file not found'; exit 1; }
echo "backend_file=$BACKEND_FILE"

grep -q 'WIENER OFFERS SURVEYS V96' "$BACKEND_FILE" || { echo 'ERROR: V96 must be installed first'; exit 1; }
BACKUP="${BACKEND_FILE}.v97.$(date +%Y%m%d-%H%M%S).bak"
cp -a "$BACKEND_FILE" "$BACKUP"
rollback(){
  echo 'ERROR: V97 install failed; restoring backend backup'
  cp -a "$BACKUP" "$BACKEND_FILE" || true
  pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
}
trap rollback ERR

echo '=== PATCH BACKEND ==='
WIENER_BACKEND_FILE="$BACKEND_FILE" python3 scripts/patch-vps-v97-offerwallgg.py
node --check "$BACKEND_FILE"
grep -q 'WIENER OFFERWALLGG V97' "$BACKEND_FILE"
grep -q '/functions/v1/wiener-offers/offerwallgg-callback' "$BACKEND_FILE"

echo '=== RESTART API ==='
pm2 restart wiener-api --update-env
sleep 2
curl -fsS http://127.0.0.1:3000/health
echo
trap - ERR

echo '=== CONFIG STATUS ==='
ENV_FILE=/opt/wiener-backend/.env
if grep -q '^OFFERWALLGG_PUBLIC_KEY=' "$ENV_FILE" 2>/dev/null; then echo 'OFFERWALLGG_PUBLIC_KEY=configured'; else echo 'OFFERWALLGG_PUBLIC_KEY=using built-in public placement key'; fi
if grep -q '^OFFERWALLGG_SECRET_KEY=.' "$ENV_FILE" 2>/dev/null; then echo 'OFFERWALLGG_SECRET_KEY=configured'; else echo 'OFFERWALLGG_SECRET_KEY=missing'; fi

echo '=== V97 READY ==='
echo 'Public key: b8fc059c43b0558c2fb457aab937c3e1'
echo 'Callback: https://api.viralaitools.xyz/functions/v1/wiener-offers/offerwallgg-callback'
echo 'Run scripts/configure-vps-v97-offerwallgg.sh to add the secret key.'
