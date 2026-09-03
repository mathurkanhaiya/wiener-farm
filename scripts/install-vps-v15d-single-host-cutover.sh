#!/usr/bin/env bash
set -Eeuo pipefail

CODE=/opt/wiener-code
BACKEND=/opt/wiener-backend
DB=wiener_farm_final
APP_ROOT=/opt/wiener-app
APP_URL='https://api.viralaitools.xyz'
WEBHOOK_URL="${APP_URL}/functions/v1/wiener-bot-webhook"
NGINX_SITE=/etc/nginx/sites-available/wiener-app-vps
NGINX_LINK=/etc/nginx/sites-enabled/wiener-app-vps
STAMP=$(date +%Y%m%d-%H%M%S)
RELEASE="${APP_ROOT}/releases/${STAMP}-$(git -C "$CODE" rev-parse --short HEAD)"
CF_CFG=''
BOT_TOKEN=''
WEBHOOK_SECRET=''
OLD_APP_URL=''
OLD_WEBHOOK_URL=''
CUTOVER_LIVE=0

say(){ printf '%s\n' "$*"; }
fail(){ say "ERROR: $*" >&2; exit 1; }

pg_scalar(){ runuser -u postgres -- psql -d "$DB" -Atqc "$1"; }
read_env(){
  local key="$1" file="$2"
  node - "$key" "$file" <<'NODE'
const fs=require('fs'); const [key,file]=process.argv.slice(2);
const l=fs.readFileSync(file,'utf8').split(/\r?\n/).find(x=>x.startsWith(key+'='));
if(!l) process.exit(2); let v=l.slice(key.length+1).trim();
if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'"))) v=v.slice(1,-1);
process.stdout.write(v);
NODE
}
telegram_ok(){ python3 -c 'import json,sys; x=json.load(sys.stdin); sys.exit(0 if x.get("ok") else 1)'; }

rollback(){
  rc=$?
  if [ "$CUTOVER_LIVE" = 1 ]; then
    say '=== ROLLBACK TELEGRAM/APP URL ==='
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

say '=== PRECHECK EXISTING VPS API ==='
pre=$(curl -sS -o /tmp/wiener-v15d-pre.json -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' "${APP_URL}/functions/v1/wiener-api" || true)
case "$pre" in 000|404|502) fail "Existing VPS API unreachable: HTTP $pre" ;; esac
cat /tmp/wiener-v15d-pre.json || true
node --check "$BACKEND/server.mjs"
if grep -Eq '^DATABASE_URL=.*(supabase|pooler)' "$BACKEND/.env"; then fail 'DATABASE_URL still points outside local VPS PostgreSQL'; fi

BOT_TOKEN=$(read_env TELEGRAM_BOT_TOKEN "$BACKEND/.env") || fail 'TELEGRAM_BOT_TOKEN missing'
WEBHOOK_SECRET=$(pg_scalar "select coalesce(telegram_webhook_secret,'') from public.app_settings where id=true limit 1")
[ -n "$WEBHOOK_SECRET" ] || fail 'telegram_webhook_secret missing in local DB'
OLD_APP_URL=$(pg_scalar "select coalesce(app_url,'') from public.app_settings where id=true limit 1")
OLD_WEBHOOK_URL=$(curl -fsS "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("result",{}).get("url", ""))')
[ -n "$OLD_WEBHOOK_URL" ] || fail 'Unable to read current Telegram webhook'

say '=== BUILD MINI APP ON VPS ==='
mkdir -p "$APP_ROOT/releases" "$RELEASE"
if [ -f package-lock.json ]; then npm ci; else npm install; fi
npm run build
[ -f dist/index.html ] || fail 'Vite build missing dist/index.html'
cp -a dist/. "$RELEASE/"
ln -sfn "$RELEASE" "$APP_ROOT/current.new"
mv -Tf "$APP_ROOT/current.new" "$APP_ROOT/current"

say '=== CONFIGURE NGINX SINGLE HOST ==='
cat >"$NGINX_SITE" <<'NGINX'
server {
    listen 127.0.0.1:18081;
    server_name _;
    root /opt/wiener-app/current;
    index index.html;

    location = /healthz {
        default_type application/json;
        return 200 '{"ok":true,"service":"wiener-farm-vps-web"}';
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

    location ~ ^/api/host/([^/]+)$ {
        alias /opt/wiener-host-assets/$1;
        add_header Cache-Control "public, max-age=31536000, immutable" always;
        add_header X-Wiener-Storage "vps" always;
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
curl -fsS http://127.0.0.1:18081/ >/dev/null
curl -fsS http://127.0.0.1:18081/healthz

say '=== POINT EXISTING CLOUDFLARE HOST TO NGINX ==='
for c in /etc/cloudflared/config.yml /root/.cloudflared/config.yml; do [ -f "$c" ] && CF_CFG="$c" && break; done
[ -n "$CF_CFG" ] || fail 'No cloudflared config found'
cp -a "$CF_CFG" "${CF_CFG}.bak-v15d-${STAMP}"
python3 - "$CF_CFG" <<'PY'
from pathlib import Path
import sys,re
p=Path(sys.argv[1]); s=p.read_text()
s=re.sub(r'\n\s*- hostname: wiener\.viralaitools\.xyz\n\s*service: http://127\.0\.0\.1:18081\n?', '\n', s)
pat=r'(\s*- hostname: api\.viralaitools\.xyz\s*\n\s*service:)\s*\S+'
if re.search(pat,s):
    s=re.sub(pat, r'\1 http://127.0.0.1:18081', s, count=1)
else:
    marker='  - service: http_status:404'
    if marker not in s: raise SystemExit('Cloudflare fallback ingress missing')
    s=s.replace(marker,'  - hostname: api.viralaitools.xyz\n    service: http://127.0.0.1:18081\n'+marker,1)
p.write_text(s)
print('api.viralaitools.xyz -> 127.0.0.1:18081')
PY
cloudflared tunnel --config "$CF_CFG" ingress validate
systemctl restart cloudflared
sleep 4

say '=== VERIFY PUBLIC FRONTEND + API BEFORE TELEGRAM SWITCH ==='
root=$(curl -sS -o /tmp/wiener-v15d-root.html -w '%{http_code}' "${APP_URL}/" || true)
health=$(curl -sS -o /tmp/wiener-v15d-health.json -w '%{http_code}' "${APP_URL}/healthz" || true)
api=$(curl -sS -o /tmp/wiener-v15d-api.json -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' "${APP_URL}/functions/v1/wiener-api" || true)
printf 'root=%s health=%s api=%s\n' "$root" "$health" "$api"
[ "$root" = 200 ] || fail 'Frontend root not 200'
[ "$health" = 200 ] || fail 'Nginx health not 200'
case "$api" in 000|404|502) fail "Function route failed: HTTP $api" ;; esac

asset=$(find /opt/wiener-host-assets -maxdepth 1 -type f -printf '%f\n' 2>/dev/null | head -n1 || true)
if [ -n "$asset" ]; then
  ac=$(curl -sS -o /dev/null -w '%{http_code}' "${APP_URL}/api/host/${asset}" || true)
  [ "$ac" = 200 ] || fail "Hosted asset GET failed: HTTP $ac"
fi

say '=== SWITCH TELEGRAM + APP URL TO VPS ==='
CUTOVER_LIVE=1
runuser -u postgres -- psql -d "$DB" -v new="$APP_URL" -qc "update public.app_settings set app_url=:'new' where id=true"
curl -fsS -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  --data-urlencode "url=${WEBHOOK_URL}" --data-urlencode "secret_token=${WEBHOOK_SECRET}" \
  --data-urlencode 'drop_pending_updates=false' | telegram_ok
curl -fsS -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setChatMenuButton" \
  --data-urlencode "menu_button={\"type\":\"web_app\",\"text\":\"🌭 OPEN WIENER FARM\",\"web_app\":{\"url\":\"${APP_URL}\"}}" | telegram_ok

cw=$(curl -fsS "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("result",{}).get("url", ""))')
[ "$cw" = "$WEBHOOK_URL" ] || fail 'Telegram webhook verification failed'
ca=$(pg_scalar "select coalesce(app_url,'') from public.app_settings where id=true limit 1")
[ "$ca" = "$APP_URL" ] || fail 'Local app_url verification failed'

say '=== REMOVE SUPABASE ENV FROM VPS ==='
cp -a "$BACKEND/.env" "$BACKEND/.env.pre-no-supabase-${STAMP}"
python3 - "$BACKEND/.env" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1]); lines=p.read_text().splitlines()
prefix=('SUPABASE_','VITE_SUPABASE_','NEXT_PUBLIC_SUPABASE_')
clean=[x for x in lines if not x.strip().startswith(prefix)]
p.write_text('\n'.join(clean)+'\n')
print('removed_supabase_env_lines=',len(lines)-len(clean))
PY
pm2 restart wiener-api --update-env
pm2 save
sleep 2

say '=== VPS-ONLY AUDIT ==='
if grep -RInE --exclude-dir=node_modules --exclude-dir=.git 'https://[^[:space:]"'"']*supabase\.co|/api/supabase\?fn=|SUPABASE_(URL|SERVICE_ROLE_KEY|ANON_KEY)|VITE_SUPABASE_|NEXT_PUBLIC_SUPABASE_' "$CODE/src" "$CODE/dist"; then
  fail 'Supabase runtime reference remains in source/build'
fi
if grep -Eiq 'supabase\.co|SUPABASE_|VITE_SUPABASE_|NEXT_PUBLIC_SUPABASE_' "$BACKEND/.env"; then fail 'Supabase reference remains in backend env'; fi
if grep -Eq '^DATABASE_URL=.*(supabase|pooler)' "$BACKEND/.env"; then fail 'Database is not local VPS PostgreSQL'; fi

say '=== FINAL PUBLIC SMOKE ==='
root=$(curl -sS -o /dev/null -w '%{http_code}' "${APP_URL}/")
health=$(curl -sS -o /dev/null -w '%{http_code}' "${APP_URL}/healthz")
api=$(curl -sS -o /tmp/wiener-v15d-final.json -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' "${APP_URL}/functions/v1/wiener-api")
printf 'app=%s health=%s unauth_api=%s\n' "$root" "$health" "$api"
[ "$root" = 200 ] && [ "$health" = 200 ] || fail 'Final web smoke failed'
case "$api" in 000|404|502) fail "Final API smoke failed: HTTP $api" ;; esac

CUTOVER_LIVE=0
trap - ERR
say '=== V15D ALL-VPS CUTOVER COMPLETE ==='
say "Live Mini App: ${APP_URL}"
say "Live Bot webhook: ${WEBHOOK_URL}"
say 'Frontend + API + PostgreSQL + hosted assets: VPS'
say 'Supabase runtime dependency: none detected'
