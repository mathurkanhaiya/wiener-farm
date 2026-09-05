#!/usr/bin/env bash
set -Eeuo pipefail

CODE=/opt/wiener-code
BACKEND=/opt/wiener-backend
SERVER="$BACKEND/server.mjs"
[ -f "$SERVER" ] || SERVER="$BACKEND/server.js"
export WIENER_BACKEND_FILE="$SERVER"
STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP="$SERVER.v28-$STAMP.bak"
OLD_APP=$(readlink -f /opt/wiener-app/current 2>/dev/null || true)

rollback(){
  rc=$?
  echo 'V28 failed; restoring backend/app.' >&2
  cp -f "$BACKUP" "$SERVER" 2>/dev/null || true
  if [[ -n "$OLD_APP" && -e "$OLD_APP" ]]; then ln -sfn "$OLD_APP" /opt/wiener-app/current || true; fi
  pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
  exit "$rc"
}
trap rollback ERR

cd "$CODE"
cp "$SERVER" "$BACKUP"

echo '=== PATCH MAIN TON TREASURY ==='
python3 -m py_compile scripts/patch-vps-v28-main-ton-treasury.py
python3 scripts/patch-vps-v28-main-ton-treasury.py
node --check "$SERVER"
grep -q 'WIENER MAIN TON TREASURY V28' "$SERVER"
grep -q 'MAIN_TREASURY_SCAN_MS_V28=7000' "$SERVER"
grep -q "wiener-main-treasury" "$SERVER"

echo '=== RETIRE ACTIVE POLYGON TREASURY ==='
runuser -u postgres -- psql -d wiener_farm_final -v ON_ERROR_STOP=1 <<'SQL'
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='app_settings' AND column_name='payout_polygon_enabled') THEN
    EXECUTE 'update public.app_settings set payout_polygon_enabled=false where id=true';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='app_settings' AND column_name='treasury_withdraw_enabled') THEN
    EXECUTE 'update public.app_settings set treasury_withdraw_enabled=false where id=true';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='app_settings' AND column_name='ton_treasury_scan_enabled') THEN
    EXECUTE 'update public.app_settings set ton_treasury_scan_enabled=true where id=true';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='app_settings' AND column_name='ton_treasury_next_scan_at') THEN
    EXECUTE 'update public.app_settings set ton_treasury_next_scan_at=now() where id=true';
  END IF;
  IF to_regclass('public.withdrawal_methods') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='withdrawal_methods' AND column_name='network') THEN
      EXECUTE $$update public.withdrawal_methods set enabled=false where lower(coalesce(network,''))='polygon'$$;
    ELSE
      EXECUTE $$update public.withdrawal_methods set enabled=false where lower(method_key) like '%polygon%'$$;
    END IF;
  END IF;
END $do$;
SQL

echo '=== BUILD ADVANCED TREASURY UI ==='
test -f src/MainTreasuryAdmin.tsx
npm run build
test -f dist/index.html
NEW_RELEASE="/opt/wiener-app/releases/$(date +%Y%m%d-%H%M%S)-v28-main-ton-treasury"
mkdir -p "$NEW_RELEASE"
cp -a dist/. "$NEW_RELEASE/"

echo '=== RESTART API + SWITCH APP ==='
pm2 restart wiener-api --update-env
sleep 3
if ! ss -ltn | grep -q '127.0.0.1:3000'; then
  echo 'Backend is not listening on 127.0.0.1:3000' >&2
  exit 1
fi
ln -sfn "$NEW_RELEASE" /opt/wiener-app/current
pm2 save >/dev/null

echo '=== VERIFY MAIN TREASURY ROUTE ==='
code=$(curl -sS -o /tmp/wiener-v28-route.json -w '%{http_code}' -X POST -H 'content-type: application/json' --data '{}' http://127.0.0.1:3000/functions/v1/wiener-main-treasury || true)
if [[ "$code" == "000" || "$code" == "404" || "$code" == "502" ]]; then
  cat /tmp/wiener-v28-route.json 2>/dev/null || true
  echo "Main Treasury route failed: HTTP $code" >&2
  exit 1
fi

echo '=== V28 READY ==='
echo 'TON is now the active Main Treasury.'
echo 'Polygon/USDT treasury is retired from active use; historical records are preserved.'
echo 'TON deposits are scanned every ~7 seconds under normal provider conditions.'
echo 'Sponsored task deposits reconcile immediately after detection.'
echo 'Admin Money now opens Main Treasury with advanced unified transactions.'
trap - ERR
