#!/usr/bin/env bash
set -euo pipefail
ENV=/opt/wiener-backend/.env
[ -f "$ENV" ] || touch "$ENV"
read -rsp 'IPAPI.IS API key: ' KEY
echo
[ -n "$KEY" ] || { echo 'ERROR: key cannot be empty'; exit 1; }
TMP=$(mktemp)
grep -v '^IPAPI_IS_KEY=' "$ENV" > "$TMP" || true
printf 'IPAPI_IS_KEY=%s\n' "$KEY" >> "$TMP"
install -m 600 "$TMP" "$ENV"
rm -f "$TMP"
unset KEY
pm2 restart wiener-api --update-env
sleep 2
curl -fsS http://127.0.0.1:3000/health
echo
echo 'Referral VPN/proxy risk detection configured.'
