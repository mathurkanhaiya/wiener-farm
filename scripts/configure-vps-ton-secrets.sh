#!/usr/bin/env bash
set -euo pipefail

BACKEND_DIR=/opt/wiener-backend
ENV_FILE="$BACKEND_DIR/.env"
SERVER="$BACKEND_DIR/server.mjs"
STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP="$BACKEND_DIR/.env.ton-secrets-$STAMP.bak"

[[ -d "$BACKEND_DIR" ]] || { echo 'ERROR: /opt/wiener-backend not found' >&2; exit 1; }
[[ -f "$SERVER" ]] || { echo 'ERROR: server.mjs not found' >&2; exit 1; }

if [[ ! -f "$ENV_FILE" ]]; then
  install -m 600 /dev/null "$ENV_FILE"
else
  cp -p "$ENV_FILE" "$BACKUP"
  chmod 600 "$ENV_FILE"
fi

has_key(){ grep -qE "^${1}=" "$ENV_FILE" 2>/dev/null; }
status(){ if has_key "$1"; then printf '✅ %s configured\n' "$2"; else printf '❌ %s missing\n' "$2"; fi; }

echo '=== CURRENT TON SECRET STATUS ==='
status WIENER_TON_PAYOUT_MNEMONIC 'TON payout/treasury mnemonic'
status WIENER_TON_RPC_URL 'TON RPC URL'
if has_key WIENER_TON_API_KEY; then echo '✅ TON API key configured'; else echo 'ℹ️ TON API key not configured (optional)'; fi

echo
echo 'Secrets are entered locally on this VPS. They are never printed back.'

read -r -s -p 'TON mnemonic (Enter = keep current): ' TON_MNEMONIC || true
echo
if [[ -n "${TON_MNEMONIC:-}" ]]; then
  WORDS=$(awk '{print NF}' <<<"$TON_MNEMONIC")
  if (( WORDS < 12 || WORDS > 24 )); then
    echo "ERROR: mnemonic must contain 12-24 words; got $WORDS" >&2
    exit 1
  fi
fi

read -r -p 'TON RPC URL (Enter = keep current): ' TON_RPC || true
if [[ -n "${TON_RPC:-}" && ! "$TON_RPC" =~ ^https:// ]]; then
  echo 'ERROR: TON RPC URL must start with https://' >&2
  exit 1
fi

read -r -s -p 'TON API key, optional (Enter = keep current): ' TON_API_KEY || true
echo

export WF_SET_MN=0 WF_SET_RPC=0 WF_SET_API=0
export WF_MN='' WF_RPC='' WF_API=''
if [[ -n "${TON_MNEMONIC:-}" ]]; then WF_SET_MN=1; WF_MN="$TON_MNEMONIC"; fi
if [[ -n "${TON_RPC:-}" ]]; then WF_SET_RPC=1; WF_RPC="$TON_RPC"; fi
if [[ -n "${TON_API_KEY:-}" ]]; then WF_SET_API=1; WF_API="$TON_API_KEY"; fi
export WF_SET_MN WF_SET_RPC WF_SET_API WF_MN WF_RPC WF_API ENV_FILE

python3 - <<'PY'
from pathlib import Path
import json, os

p=Path(os.environ['ENV_FILE'])
lines=p.read_text().splitlines() if p.exists() else []

def write_value(key, value):
    global lines
    prefix=key+'='
    lines=[ln for ln in lines if not ln.startswith(prefix)]
    # JSON string quoting is compatible with dotenv double-quoted values and
    # safely preserves mnemonic spaces without exposing the value in shell args.
    lines.append(prefix+json.dumps(value))

if os.environ.get('WF_SET_MN')=='1':
    write_value('WIENER_TON_PAYOUT_MNEMONIC', os.environ['WF_MN'].strip())
if os.environ.get('WF_SET_RPC')=='1':
    write_value('WIENER_TON_RPC_URL', os.environ['WF_RPC'].strip())
if os.environ.get('WF_SET_API')=='1':
    write_value('WIENER_TON_API_KEY', os.environ['WF_API'].strip())

p.write_text('\n'.join(lines).rstrip()+'\n')
PY

unset TON_MNEMONIC TON_RPC TON_API_KEY WF_MN WF_RPC WF_API WF_SET_MN WF_SET_RPC WF_SET_API
chmod 600 "$ENV_FILE"

# Never arm automatic transfers just because secrets were added.
runuser -u postgres -- psql -d wiener_farm_final -v ON_ERROR_STOP=1 -Atqc \
  "update public.app_settings set ton_treasury_autopay_enabled=false where id=true; select 'ton_autopay='||coalesce(ton_treasury_autopay_enabled,false)::text from public.app_settings where id=true" \
  2>/dev/null || true

node --check "$SERVER"
pm2 restart wiener-api --update-env
sleep 2

code=$(curl -sS -o /tmp/ton-secret-webhook-smoke.txt -w '%{http_code}' -X POST -H 'content-type: application/json' --data '{}' http://127.0.0.1:3000/functions/v1/wiener-bot-webhook || true)
echo "wiener-bot-webhook -> HTTP $code"
if [[ "$code" == "000" || "$code" == "404" || "$code" == "502" ]]; then
  echo 'ERROR: backend did not recover after secret reload.' >&2
  if [[ -f "$BACKUP" ]]; then
    cp -p "$BACKUP" "$ENV_FILE"
    chmod 600 "$ENV_FILE"
    pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
    echo 'Previous .env restored.' >&2
  fi
  exit 1
fi
pm2 save

echo '=== TON SECRETS SAVED SAFELY ==='
status WIENER_TON_PAYOUT_MNEMONIC 'TON payout/treasury mnemonic'
status WIENER_TON_RPC_URL 'TON RPC URL'
if has_key WIENER_TON_API_KEY; then echo '✅ TON API key configured'; else echo 'ℹ️ TON API key not configured (optional)'; fi
echo 'Secret values were not printed.'
echo 'TON autopay remains OFF. Open /config -> SECRET STATUS to verify the derived wallet and balance before enabling payouts.'
