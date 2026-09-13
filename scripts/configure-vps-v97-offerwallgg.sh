#!/usr/bin/env bash
set -euo pipefail
ENV_FILE=/opt/wiener-backend/.env
[ -f "$ENV_FILE" ] || touch "$ENV_FILE"
cp -a "$ENV_FILE" "${ENV_FILE}.v97.$(date +%Y%m%d-%H%M%S).bak"

PUBLIC_KEY='b8fc059c43b0558c2fb457aab937c3e1'
printf 'Offerwall.GG public key [%s]: ' "$PUBLIC_KEY"
read -r INPUT_PUBLIC || true
if [ -n "${INPUT_PUBLIC:-}" ]; then PUBLIC_KEY="$INPUT_PUBLIC"; fi

printf 'Offerwall.GG secret key (hidden): '
IFS= read -r -s SECRET_KEY
echo
[ -n "${SECRET_KEY:-}" ] || { echo 'ERROR: secret key is required'; exit 1; }

upsert_env(){
  local key="$1" value="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    python3 - "$ENV_FILE" "$key" "$value" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1]); k=sys.argv[2]; v=sys.argv[3]
lines=p.read_text().splitlines()
out=[]; done=False
for line in lines:
    if line.startswith(k+'='):
        if not done: out.append(k+'='+v); done=True
    else: out.append(line)
if not done: out.append(k+'='+v)
p.write_text('\n'.join(out)+'\n')
PY
  else
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

upsert_env OFFERWALLGG_PUBLIC_KEY "$PUBLIC_KEY"
upsert_env OFFERWALLGG_SECRET_KEY "$SECRET_KEY"
chmod 600 "$ENV_FILE" || true
unset SECRET_KEY

pm2 restart wiener-api --update-env
sleep 2
curl -fsS http://127.0.0.1:3000/health
echo

echo '=== OFFERWALL.GG CONFIGURED ==='
echo "Public key: $PUBLIC_KEY"
echo 'Secret key: stored privately in /opt/wiener-backend/.env'
echo 'Callback URL:'
echo 'https://api.viralaitools.xyz/functions/v1/wiener-offers/offerwallgg-callback'
echo 'Enable Require Signature on the Offerwall.GG placement.'
