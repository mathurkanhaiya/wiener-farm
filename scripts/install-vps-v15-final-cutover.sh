#!/usr/bin/env bash
set -Eeuo pipefail

CODE=/opt/wiener-code
BACKEND=/opt/wiener-backend
DB=wiener_farm_final
APP_HOST=wiener.viralaitools.xyz
APP_URL="https://${APP_HOST}"
API_URL="https://api.viralaitools.xyz"
WEBHOOK_URL="${API_URL}/functions/v1/wiener-bot-webhook"
APP_ROOT=/opt/wiener-app
CF_CFG=/root/.cloudflared/config.yml
NGINX_SITE=/etc/nginx/sites-available/wiener-app-vps
NGINX_LINK=/etc/nginx/sites-enabled/wiener-app-vps
STAMP=$(date +%Y%m%d-%H%M%S)
RELEASE="${APP_ROOT}/releases/${STAMP}-$(git -C "$CODE" rev-parse --short HEAD)"
CUTOVER_LIVE=0
OLD_APP_URL=''
OLD_WEBHOOK_URL=''
BOT_TOKEN=''
WEBHOOK_SECRET=''

say(){ printf '%s\n' "$*"; }
fail(){ say "ERROR: $*" >&2; exit 1; }

read_env_value(){
  local key="$1" file="$2"
  node - "$key" "$file" <<'NODE'
const fs=require('fs');
const [key,file]=process.argv.slice(2);
const text=fs.readFileSync(file,'utf8');
const line=text.split(/\r?\n/).find(x=>x.startsWith(key+'='));
if(!line) process.exit(2);
let v=line.slice(key.length+1).trim();
if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'"))) v=v.slice(1,-1);
process.stdout.write(v);
NODE
}

pg_scalar(){
  runuser -u postgres -- psql -d "$DB" -Atqc "$1"
}

telegram_ok(){
  python3 -c 'import json,sys; x=json.load(sys.stdin); sys.exit(0 if x.get("ok") else 1)'
}

rollback(){
  local rc=$?
  if [ "$CUTOVER_LIVE" = 1 ]; then
    say '=== ROLLBACK LIVE CUTOVER ==='
    if [ -n "$OLD_APP_URL" ]; then
      runuser -u postgres -- psql -d "$DB" -v old="$OLD_APP_URL" -qc "update public.app_settings set app_url=:'old' where id=true" || true
      curl -fsS -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setChatMenuButton" \
        --data-urlencode "menu_button={\"type\":\"web_app\",\"text\":\"🌭 OPEN WIENER FARM\",\"web_app\":{\"url\":\"${OLD_APP_URL}\"}}" >/dev/null || true
    fi
    if [ -n "$OLD_WEBHOOK_URL" ]; then
      curl -fsS -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
        --data-urlencode "url=${OLD_WEBHOOK_URL}" \
        --data-urlencode "secret_token=${WEBHOOK_SECRET}" \
        --data-urlencode 'drop_pending_updates=false' >/dev/null || true
    fi
  fi
  exit "$rc"
}
trap rollback ERR

cd "$CODE"
git pull --ff-only

say '=== PRE-CUTOVER CHECKS ==='
curl -fsS "${API_URL}/healthz" >/tmp/wiener-v15-api-health.json
cat /tmp/wiener-v15-api-health.json
node --check "$BACKEND/server.mjs"

if grep -Eq '^DATABASE_URL=.*supabase' "$BACKEND/.env"; then
  fail 'DATABASE_URL still points to Supabase; refusing cutover.'
fi

BOT_TOKEN=$(read_env_value TELEGRAM_BOT_TOKEN "$BACKEND/.env") || fail 'TELEGRAM_BOT_TOKEN missing on VPS'
WEBHOOK_SECRET=$(pg_scalar "select coalesce(telegram_webhook_secret,'') from public.app_settings where id=true limit 1")
[ -n "$WEBHOOK_SECRET" ] || fail 'telegram_webhook_secret missing in local PostgreSQL'
OLD_APP_URL=$(pg_scalar "select coalesce(app_url,'') from public.app_settings where id=true limit 1")
[ -n "$OLD_APP_URL" ] || OLD_APP_URL='https://wiener-farm.vercel.app'
OLD_WEBHOOK_URL=$(curl -fsS "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("result",{}).get("url", ""))')
[ -n "$OLD_WEBHOOK_URL" ] || fail 'Could not read current Telegram webhook URL'

say '=== BUILD MINI APP ON VPS ==='
mkdir -p "$APP_ROOT/releases" "$RELEASE"
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi
npm run build
[ -f dist/index.html ] || fail 'Vite build did not produce dist/index.html'
cp -a dist/. "$RELEASE/"
ln -sfn "$RELEASE" "$APP_ROOT/current.new"
mv -Tf "$APP_ROOT/current.new" "$APP_ROOT/current"

say '=== INSTALL VPS NGINX APP ==='
cat >"$NGINX_SITE" <<'NGINX'
server {
    listen 127.0.0.1:18081;
    server_name _;
    root /opt/wiener-app/current;
    index index.html;

    location = /healthz {
        proxy_pass http://127.0.0.1:3000/healthz;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /functions/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }

    location /api/host/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto https;
    }

    location = /api/adsgram/reward {
        proxy_pass http://127.0.0.1:3000/functions/v1/wiener-adsgram-reward$is_args$args;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto https;
    }

    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache" always;
    }
}
NGINX
ln -sfn "$NGINX_SITE" "$NGINX_LINK"
nginx -t
systemctl reload nginx
curl -fsS http://127.0.0.1:18081/ >/tmp/wiener-v15-local-app.html
curl -fsS http://127.0.0.1:18081/healthz >/tmp/wiener-v15-local-health.json

say '=== CLOUDFLARE APP HOSTNAME ==='
[ -f "$CF_CFG" ] || fail "Cloudflare config missing: $CF_CFG"
cp -a "$CF_CFG" "${CF_CFG}.bak-${STAMP}"
python3 - "$CF_CFG" "$APP_HOST" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1]); host=sys.argv[2]
s=p.read_text()
if f'hostname: {host}' not in s:
    marker='  - service: http_status:404'
    if marker not in s:
        raise SystemExit('Cloudflare fallback ingress marker missing')
    s=s.replace(marker, f'  - hostname: {host}\n    service: http://127.0.0.1:18081\n{marker}', 1)
    p.write_text(s)
print('Cloudflare ingress ready')
PY
cloudflared tunnel ingress validate
if ! cloudflared tunnel route dns wiener-farm "$APP_HOST" >/tmp/wiener-v15-cf-dns.txt 2>&1; then
  if ! grep -Eqi 'already exists|already configured|record.*exists' /tmp/wiener-v15-cf-dns.txt; then
    cat /tmp/wiener-v15-cf-dns.txt >&2
    fail 'Could not create Cloudflare tunnel DNS route'
  fi
fi
systemctl restart cloudflared
sleep 3

say '=== VERIFY NEW VPS APP BEFORE SWITCHING USERS ==='
OK=0
for _ in $(seq 1 20); do
  code=$(curl -sS -o /tmp/wiener-v15-public-app.html -w '%{http_code}' "${APP_URL}/" || true)
  if [ "$code" = 200 ]; then OK=1; break; fi
  sleep 2
done
[ "$OK" = 1 ] || fail "${APP_URL} did not become reachable"

auth_code=$(curl -sS -o /tmp/wiener-v15-auth.json -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' "${APP_URL}/functions/v1/wiener-api" || true)
[ "$auth_code" != 404 ] && [ "$auth_code" != 502 ] && [ "$auth_code" != 000 ] || fail "VPS function route failed on new app host: HTTP $auth_code"

asset=$(find /opt/wiener-host-assets -maxdepth 1 -type f -printf '%f\n' 2>/dev/null | head -n1 || true)
if [ -n "$asset" ]; then
  asset_code=$(curl -sS -I -o /dev/null -w '%{http_code}' "${APP_URL}/api/host/${asset}" || true)
  [ "$asset_code" = 200 ] || fail "Hosted asset failed on new app host: HTTP $asset_code"
fi

say '=== SWITCH APP + TELEGRAM TO VPS ==='
CUTOVER_LIVE=1
runuser -u postgres -- psql -d "$DB" -v new="$APP_URL" -qc "update public.app_settings set app_url=:'new' where id=true"

curl -fsS -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  --data-urlencode "url=${WEBHOOK_URL}" \
  --data-urlencode "secret_token=${WEBHOOK_SECRET}" \
  --data-urlencode 'drop_pending_updates=false' | telegram_ok

curl -fsS -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setChatMenuButton" \
  --data-urlencode "menu_button={\"type\":\"web_app\",\"text\":\"🌭 OPEN WIENER FARM\",\"web_app\":{\"url\":\"${APP_URL}\"}}" | telegram_ok

current_webhook=$(curl -fsS "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("result",{}).get("url", ""))')
[ "$current_webhook" = "$WEBHOOK_URL" ] || fail 'Telegram webhook did not switch to VPS endpoint'
current_app=$(pg_scalar "select coalesce(app_url,'') from public.app_settings where id=true limit 1")
[ "$current_app" = "$APP_URL" ] || fail 'app_settings.app_url did not switch to VPS app hostname'

say '=== REMOVE SUPABASE ENV FROM VPS ==='
cp -a "$BACKEND/.env" "$BACKEND/.env.pre-no-supabase-${STAMP}"
python3 - "$BACKEND/.env" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1]); lines=p.read_text().splitlines()
prefixes=('SUPABASE_','VITE_SUPABASE_','NEXT_PUBLIC_SUPABASE_')
clean=[x for x in lines if not x.strip().startswith(prefixes)]
p.write_text('\n'.join(clean)+'\n')
print(f'removed={len(lines)-len(clean)} Supabase env line(s)')
PY
pm2 restart wiener-api --update-env
pm2 save
sleep 2
curl -fsS "${API_URL}/healthz" >/tmp/wiener-v15-post-health.json
cat /tmp/wiener-v15-post-health.json

say '=== NO-SUPABASE RUNTIME AUDIT ==='
if grep -RInE --exclude-dir=node_modules --exclude-dir=.git 'https://[^[:space:]"'"']*supabase\.co|/api/supabase\?fn=|SUPABASE_(URL|SERVICE_ROLE_KEY|ANON_KEY)|VITE_SUPABASE_|NEXT_PUBLIC_SUPABASE_' "$CODE/src" "$CODE/dist" 2>/tmp/wiener-v15-grep.err; then
  fail 'Supabase runtime reference remains in built frontend/source'
fi
if grep -Eiq 'supabase\.co|SUPABASE_|VITE_SUPABASE_|NEXT_PUBLIC_SUPABASE_' "$BACKEND/.env"; then
  fail 'Supabase variable/reference remains in backend .env'
fi
if grep -Eq '^DATABASE_URL=.*(pooler\.supabase|supabase\.co)' "$BACKEND/.env"; then
  fail 'DATABASE_URL points to Supabase after cutover'
fi

say '=== FINAL PUBLIC SMOKES ==='
root_code=$(curl -sS -o /dev/null -w '%{http_code}' "${APP_URL}/")
health_code=$(curl -sS -o /dev/null -w '%{http_code}' "${APP_URL}/healthz")
api_code=$(curl -sS -o /tmp/wiener-v15-final-api.json -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' "${APP_URL}/functions/v1/wiener-api")
printf 'app=%s health=%s unauth_api=%s\n' "$root_code" "$health_code" "$api_code"
[ "$root_code" = 200 ] && [ "$health_code" = 200 ] || fail 'Final public smoke failed'
[ "$api_code" != 404 ] && [ "$api_code" != 502 ] || fail 'Final API route smoke failed'

CUTOVER_LIVE=0
trap - ERR
say '=== V15 FINAL VPS CUTOVER COMPLETE ==='
say "Live Mini App: ${APP_URL}"
say "Live Bot webhook: ${WEBHOOK_URL}"
say 'Runtime: VPS frontend + VPS API + VPS PostgreSQL + VPS hosted assets'
say 'Supabase runtime dependency: none detected'
