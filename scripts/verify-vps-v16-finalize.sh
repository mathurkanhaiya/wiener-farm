#!/usr/bin/env bash
set -Eeuo pipefail

APP_URL='https://api.viralaitools.xyz'
API_URL='https://api.viralaitools.xyz'
WEBHOOK_URL="${API_URL}/functions/v1/wiener-bot-webhook"
BACKEND=/opt/wiener-backend
CODE=/opt/wiener-code
DB=wiener_farm_final
STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR=/root/wiener-final-backups

fail(){ echo "ERROR: $*" >&2; exit 1; }
ok(){ echo "OK: $*"; }
read_env(){ node - "$1" "$BACKEND/.env" <<'NODE'
const fs=require('fs'); const [k,f]=process.argv.slice(2); const l=fs.readFileSync(f,'utf8').split(/\r?\n/).find(x=>x.startsWith(k+'=')); if(!l)process.exit(2); let v=l.slice(k.length+1).trim(); if((v[0]==='"'&&v.at(-1)==='"')||(v[0]==="'"&&v.at(-1)==="'"))v=v.slice(1,-1); process.stdout.write(v)
NODE
}

cd "$CODE"

echo '=== VPS PUBLIC ROUTING ==='
[ "$(curl -sS -o /dev/null -w '%{http_code}' "$APP_URL/")" = 200 ] || fail 'Mini App hostname not 200'
[ "$(curl -sS -o /dev/null -w '%{http_code}' "$APP_URL/healthz")" = 200 ] || fail 'VPS web health not 200'
for fn in wiener-api wiener-task-api wiener-ad wiener-withdraw wiener-admin-api wiener-bot-webhook wiener-giveaway wiener-raffle-api wiener-exclusive; do
  c=$(curl -sS -o /tmp/v16.json -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' "$APP_URL/functions/v1/$fn" || true)
  case "$c" in 000|404|502) fail "$fn unavailable: HTTP $c";; esac
  echo "$fn -> HTTP $c"
done
ok 'Mini App and core API routes are on VPS'

echo '=== LOCAL POSTGRES ==='
[ -n "$(runuser -u postgres -- psql -d "$DB" -Atqc 'select 1')" ] || fail 'Local PostgreSQL unavailable'
users=$(runuser -u postgres -- psql -d "$DB" -Atqc 'select count(*) from public.users')
withdrawals=$(runuser -u postgres -- psql -d "$DB" -Atqc 'select count(*) from public.withdrawals')
echo "users=$users withdrawals=$withdrawals"
app_db=$(runuser -u postgres -- psql -d "$DB" -Atqc "select coalesce(app_url,'') from public.app_settings where id=true limit 1")
[ "${app_db%/}" = "${APP_URL%/}" ] || fail "DB app_url is not VPS app: $app_db"
ok 'Local PostgreSQL is authoritative'

echo '=== TELEGRAM CUTOVER ==='
BOT_TOKEN=$(read_env TELEGRAM_BOT_TOKEN) || fail 'TELEGRAM_BOT_TOKEN missing'
info=$(curl -fsS "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo")
current=$(printf '%s' "$info" | python3 -c 'import json,sys; x=json.load(sys.stdin)["result"]; print(x.get("url",""))')
[ "$current" = "$WEBHOOK_URL" ] || fail "Telegram webhook is not VPS: $current"
err=$(printf '%s' "$info" | python3 -c 'import json,sys; x=json.load(sys.stdin)["result"]; print(x.get("last_error_message", ""))')
[ -z "$err" ] || echo "WARNING: Telegram reports historical webhook error: $err"
menu=$(curl -fsS "https://api.telegram.org/bot${BOT_TOKEN}/getChatMenuButton")
menu_url=$(printf '%s' "$menu" | python3 -c 'import json,sys; x=json.load(sys.stdin).get("result",{}); print(x.get("web_app",{}).get("url",""))')
[ "${menu_url%/}" = "${APP_URL%/}" ] || fail "Telegram menu still points elsewhere: $menu_url"
ok 'Telegram webhook and Mini App menu are VPS-only'

echo '=== PROCESS PERSISTENCE ==='
pm2 jlist | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const a=JSON.parse(s),p=a.find(x=>x.name==="wiener-api");process.exit(p&&p.pm2_env.status==="online"?0:1)})' || fail 'wiener-api not online in PM2'
systemctl is-active --quiet cloudflared || fail 'cloudflared not active'
systemctl is-enabled --quiet cloudflared || fail 'cloudflared not enabled at boot'
systemctl is-enabled --quiet pm2-root || fail 'pm2-root not enabled at boot'
[ -x /usr/local/bin/wiener-cron.sh ] || fail 'wiener-cron.sh missing/not executable'
crontab -l 2>/dev/null | grep -q '/usr/local/bin/wiener-cron.sh' || fail 'Wiener cron not installed in root crontab'
ok 'PM2, Cloudflare and cron persistence checks passed'

echo '=== NO SUPABASE RUNTIME ==='
if grep -Eiq 'supabase\.co|^SUPABASE_|^VITE_SUPABASE_|^NEXT_PUBLIC_SUPABASE_' "$BACKEND/.env"; then fail 'Supabase reference remains in backend .env'; fi
if grep -RInE --exclude-dir=node_modules --exclude-dir=.git 'supabase\.co|/api/supabase\?fn=' "$CODE/src" "$CODE/dist" 2>/dev/null; then fail 'Supabase runtime URL/proxy reference remains in source/build'; fi
ok 'No Supabase runtime dependency detected on VPS app/backend'

echo '=== HOSTED STORAGE ==='
[ -d /opt/wiener-host-assets ] || fail 'VPS hosted-assets directory missing'
asset_count=$(find /opt/wiener-host-assets -maxdepth 1 -type f | wc -l)
echo "hosted_assets=$asset_count"
if [ "$asset_count" -gt 0 ]; then
  asset=$(find /opt/wiener-host-assets -maxdepth 1 -type f -printf '%f\n' | head -n1)
  c=$(curl -sS -o /dev/null -w '%{http_code}' "$APP_URL/api/host/$asset" || true)
  [ "$c" = 200 ] || fail "Hosted asset public GET failed: HTTP $c"
fi
ok 'Hosted files are served from VPS'

echo '=== PAYOUT SAFE PREFLIGHT ==='
for fn in wiener-payout wiener-ton-payout; do
  c=$(curl -sS -o /tmp/v16-payout.json -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' "$APP_URL/functions/v1/$fn" || true)
  case "$c" in 000|404|502) fail "$fn route unavailable: HTTP $c";; esac
  echo "$fn protected smoke -> HTTP $c"
done
grep -Eqi 'idempot|already.*paid|status.*paid|double.*pay|payment.*processed' "$BACKEND/server.mjs" || echo 'WARNING: duplicate-protection pattern not recognized automatically; manual code review required.'
ok 'Payout routes reachable; no transfer executed'

echo '=== FINAL BACKUPS ==='
mkdir -p "$BACKUP_DIR"
runuser -u postgres -- pg_dump -Fc -d "$DB" -f "/tmp/wiener-db-$STAMP.dump"
mv "/tmp/wiener-db-$STAMP.dump" "$BACKUP_DIR/wiener-db-$STAMP.dump"
tar -C /opt -czf "$BACKUP_DIR/wiener-host-assets-$STAMP.tar.gz" wiener-host-assets
cp -a "$BACKEND/.env" "$BACKUP_DIR/backend-env-$STAMP.backup"
chmod 600 "$BACKUP_DIR"/*
ln -sfn "$BACKUP_DIR/wiener-db-$STAMP.dump" "$BACKUP_DIR/latest-db.dump"
ln -sfn "$BACKUP_DIR/wiener-host-assets-$STAMP.tar.gz" "$BACKUP_DIR/latest-host-assets.tar.gz"
ok "Backups written under $BACKUP_DIR"

echo '=== V16 VPS-ONLY GATE PASSED ==='
echo "Mini App: $APP_URL"
echo "Bot webhook: $WEBHOOK_URL"
echo 'Database: VPS PostgreSQL'
echo 'Storage: VPS local hosted assets'
echo 'Supabase runtime dependency: none detected'
echo 'SAFE_TO_PAUSE_SUPABASE=YES'
