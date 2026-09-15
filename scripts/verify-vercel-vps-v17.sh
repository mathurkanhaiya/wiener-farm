#!/usr/bin/env bash
set -Eeuo pipefail

APP_URL='https://wiener-farm.vercel.app'
API_URL='https://api.viralaitools.xyz'
WEBHOOK_URL="${API_URL}/functions/v1/wiener-bot-webhook"
BACKEND=/opt/wiener-backend
CODE=/opt/wiener-code
DB=wiener_farm_final

fail(){ echo "ERROR: $*" >&2; exit 1; }
ok(){ echo "OK: $*"; }
read_env(){ node - "$1" "$BACKEND/.env" <<'NODE'
const fs=require('fs'); const [k,f]=process.argv.slice(2); const l=fs.readFileSync(f,'utf8').split(/\r?\n/).find(x=>x.startsWith(k+'=')); if(!l)process.exit(2); let v=l.slice(k.length+1).trim(); if((v[0]==='"'&&v.at(-1)==='"')||(v[0]==="'"&&v.at(-1)==="'"))v=v.slice(1,-1); process.stdout.write(v)
NODE
}

echo '=== FRONTEND + VPS API ==='
[ "$(curl -sS -o /dev/null -w '%{http_code}' "$APP_URL/")" = 200 ] || fail 'Vercel Mini App is not HTTP 200'
api_direct=$(curl -sS -o /tmp/v17-direct.json -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' "$API_URL/functions/v1/wiener-api" || true)
case "$api_direct" in 000|404|502) fail "Direct VPS API unavailable: HTTP $api_direct";; esac
api_bridge=$(curl -sS -o /tmp/v17-bridge.json -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' "$APP_URL/functions/v1/wiener-api" || true)
case "$api_bridge" in 000|404|502) fail "Vercel -> VPS API bridge unavailable: HTTP $api_bridge";; esac
echo "direct_vps_api=$api_direct vercel_bridge=$api_bridge"
ok 'Vercel frontend and VPS backend bridge are live'

echo '=== LOCAL POSTGRES ==='
runuser -u postgres -- psql -d "$DB" -Atqc 'select 1' >/dev/null || fail 'Local PostgreSQL unavailable'
app_db=$(runuser -u postgres -- psql -d "$DB" -Atqc "select coalesce(app_url,'') from public.app_settings where id=true limit 1")
[ "${app_db%/}" = "${APP_URL%/}" ] || fail "DB app_url incorrect: $app_db"
echo "users=$(runuser -u postgres -- psql -d "$DB" -Atqc 'select count(*) from public.users') withdrawals=$(runuser -u postgres -- psql -d "$DB" -Atqc 'select count(*) from public.withdrawals')"
ok 'VPS PostgreSQL is authoritative'

echo '=== TELEGRAM ==='
BOT_TOKEN=$(read_env TELEGRAM_BOT_TOKEN) || fail 'TELEGRAM_BOT_TOKEN missing'
info=$(curl -fsS "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo")
webhook=$(printf '%s' "$info" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("result",{}).get("url",""))')
[ "$webhook" = "$WEBHOOK_URL" ] || fail "Telegram webhook not on VPS: $webhook"
menu=$(curl -fsS "https://api.telegram.org/bot${BOT_TOKEN}/getChatMenuButton")
menu_url=$(printf '%s' "$menu" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("result",{}).get("web_app",{}).get("url",""))')
[ "${menu_url%/}" = "${APP_URL%/}" ] || fail "Telegram Mini App menu not on Vercel: $menu_url"
ok 'Telegram menu uses Vercel frontend; webhook uses VPS'

echo '=== VPS SERVICES ==='
pm2 jlist | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const a=JSON.parse(s),p=a.find(x=>x.name==="wiener-api");process.exit(p&&p.pm2_env.status==="online"?0:1)})' || fail 'wiener-api not online'
systemctl is-active --quiet cloudflared || fail 'cloudflared inactive'
systemctl is-enabled --quiet cloudflared || fail 'cloudflared not enabled'
systemctl is-enabled --quiet pm2-root || fail 'pm2-root not enabled'
[ -x /usr/local/bin/wiener-cron.sh ] || fail 'wiener cron missing'
crontab -l 2>/dev/null | grep -q '/usr/local/bin/wiener-cron.sh' || fail 'wiener cron not scheduled'
ok 'VPS API/tunnel/cron persistence checks passed'

echo '=== NO SUPABASE RUNTIME ==='
if grep -Eiq 'supabase\.co|^SUPABASE_|^VITE_SUPABASE_|^NEXT_PUBLIC_SUPABASE_' "$BACKEND/.env"; then fail 'Supabase reference remains in VPS backend env'; fi
if grep -RInE --exclude-dir=node_modules --exclude-dir=.git 'supabase\.co|/api/supabase\?fn=' "$CODE/src" "$CODE/dist" 2>/dev/null; then fail 'Supabase runtime URL/proxy remains in source/build'; fi
ok 'No Supabase runtime dependency detected'

echo '=== VPS STORAGE ==='
asset_count=$(find /opt/wiener-host-assets -maxdepth 1 -type f 2>/dev/null | wc -l)
[ "$asset_count" -gt 0 ] || fail 'No VPS hosted assets found'
asset=$(find /opt/wiener-host-assets -maxdepth 1 -type f -printf '%f\n' | head -n1)
direct_asset=$(curl -sS -o /dev/null -w '%{http_code}' "$API_URL/api/host/$asset" || true)
[ "$direct_asset" = 200 ] || fail "Direct VPS asset unavailable: HTTP $direct_asset"
vercel_asset=$(curl -sS -o /dev/null -w '%{http_code}' "$APP_URL/api/host/$asset" || true)
[ "$vercel_asset" = 200 ] || fail "Vercel asset bridge unavailable: HTTP $vercel_asset"
echo "hosted_assets=$asset_count direct=$direct_asset via_vercel=$vercel_asset"
ok 'Storage is VPS-backed'

echo '=== PAYOUT SAFE PREFLIGHT ==='
for fn in wiener-payout wiener-ton-payout; do
  c=$(curl -sS -o /tmp/v17-payout.json -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' "$API_URL/functions/v1/$fn" || true)
  case "$c" in 000|404|502) fail "$fn unavailable: HTTP $c";; esac
  echo "$fn -> HTTP $c"
done
ok 'Payout routes protected/reachable; no payment executed'

echo '=== V17 DESIRED ARCHITECTURE PASSED ==='
echo "Mini App frontend: $APP_URL"
echo "VPS API/webhook: $API_URL"
echo 'Database: VPS PostgreSQL'
echo 'Storage: VPS'
echo 'Workers/cron: VPS'
echo 'Supabase runtime dependency: none detected'
echo 'SAFE_TO_PAUSE_SUPABASE=YES'
