#!/usr/bin/env bash
set -Eeuo pipefail

BACKEND=/opt/wiener-backend
DB=wiener_farm_final
APP_URL='https://wiener-farm.vercel.app'
API_URL='https://api.viralaitools.xyz'
WEBHOOK_URL="${API_URL}/functions/v1/wiener-bot-webhook"

fail(){ echo "ERROR: $*" >&2; exit 1; }
read_env(){ node - "$1" "$BACKEND/.env" <<'NODE'
const fs=require('fs'); const [k,f]=process.argv.slice(2); const l=fs.readFileSync(f,'utf8').split(/\r?\n/).find(x=>x.startsWith(k+'=')); if(!l)process.exit(2); let v=l.slice(k.length+1).trim(); if((v[0]==='"'&&v.at(-1)==='"')||(v[0]==="'"&&v.at(-1)==="'"))v=v.slice(1,-1); process.stdout.write(v)
NODE
}
set_app_url(){
  local value="$1"
  local escaped=${value//\'/\'\'}
  runuser -u postgres -- psql -d "$DB" -v ON_ERROR_STOP=1 -qc "update public.app_settings set app_url='${escaped}' where id=true"
}
set_menu_json(){
  BOT_TOKEN="$BOT_TOKEN" APP_URL="$APP_URL" python3 <<'PY'
import json, os, urllib.request
url=f"https://api.telegram.org/bot{os.environ['BOT_TOKEN']}/setChatMenuButton"
payload={"menu_button":{"type":"web_app","text":"🌭 OPEN WIENER FARM","web_app":{"url":os.environ['APP_URL']}}}
req=urllib.request.Request(url,data=json.dumps(payload).encode(),headers={"Content-Type":"application/json"},method="POST")
with urllib.request.urlopen(req,timeout=15) as r:
    x=json.load(r)
if not x.get("ok"):
    raise SystemExit(x.get("description","Telegram menu update failed"))
PY
}
get_menu_url(){
  curl -fsS "https://api.telegram.org/bot${BOT_TOKEN}/getChatMenuButton" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("result",{}).get("web_app",{}).get("url",""))'
}

BOT_TOKEN=$(read_env TELEGRAM_BOT_TOKEN) || fail 'TELEGRAM_BOT_TOKEN missing'

[ "$(curl -sS -o /dev/null -w '%{http_code}' "$APP_URL/")" = 200 ] || fail 'Vercel frontend is not HTTP 200'
api_code=$(curl -sS -o /tmp/wiener-switch-api.json -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' "$API_URL/functions/v1/wiener-api" || true)
case "$api_code" in 000|404|502) fail "VPS API unavailable: HTTP $api_code";; esac

set_app_url "$APP_URL"

# Update the bot's default menu button using strict JSON, then verify with retries.
for _ in 1 2 3; do
  set_menu_json
  sleep 1
  menu_url=$(get_menu_url)
  [ "${menu_url%/}" = "${APP_URL%/}" ] && break
done
[ "${menu_url%/}" = "${APP_URL%/}" ] || fail "Telegram default menu verification failed: $menu_url"

# Keep webhook on VPS; repair it only if it drifted.
current_webhook=$(curl -fsS "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("result",{}).get("url",""))')
if [ "$current_webhook" != "$WEBHOOK_URL" ]; then
  WEBHOOK_SECRET=$(runuser -u postgres -- psql -d "$DB" -Atqc "select coalesce(telegram_webhook_secret,'') from public.app_settings where id=true limit 1")
  [ -n "$WEBHOOK_SECRET" ] || fail 'telegram_webhook_secret missing in local DB'
  curl -fsS -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
    --data-urlencode "url=${WEBHOOK_URL}" \
    --data-urlencode "secret_token=${WEBHOOK_SECRET}" \
    --data-urlencode 'drop_pending_updates=false' \
    | python3 -c 'import json,sys; x=json.load(sys.stdin); sys.exit(0 if x.get("ok") else 1)'
fi

app_db=$(runuser -u postgres -- psql -d "$DB" -Atqc "select coalesce(app_url,'') from public.app_settings where id=true limit 1")
[ "${app_db%/}" = "${APP_URL%/}" ] || fail "DB app_url verification failed: $app_db"
current_webhook=$(curl -fsS "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("result",{}).get("url",""))')
[ "$current_webhook" = "$WEBHOOK_URL" ] || fail "Webhook is not VPS: $current_webhook"

echo '=== HYBRID FRONTEND/VPS BACKEND SWITCH COMPLETE ==='
echo "Mini App: $APP_URL"
echo "Bot webhook/API: $API_URL"
echo 'Database/storage/workers: VPS'
echo 'Supabase runtime dependency: none'
