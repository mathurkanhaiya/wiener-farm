#!/usr/bin/env bash
set -euo pipefail

APP=/opt/wiener-backend/server.mjs
BACKUP="/opt/wiener-backend/server.mjs.v70.$(date +%Y%m%d%H%M%S).bak"

if [ ! -f "$APP" ]; then
  echo "server.mjs not found: $APP" >&2
  exit 1
fi

if command -v psql >/dev/null 2>&1; then
  RATE=$(runuser -u postgres -- psql -d wiener_farm_final -Atqc "select token_per_usdt from public.app_settings where id=true limit 1" 2>/dev/null || true)
  echo "Current DB token_per_usdt: ${RATE:-unknown}"
fi

if grep -q "admin_broadcast_sessions" "$APP"; then
  SENDING=$(runuser -u postgres -- psql -d wiener_farm_final -Atqc "select count(*) from public.admin_broadcast_sessions where step='media_sending'" 2>/dev/null || echo 0)
  if [ "${SENDING:-0}" != "0" ]; then
    echo "Broadcast media sending is active. Abort to avoid restart during broadcast." >&2
    exit 1
  fi
fi

cp -a "$APP" "$BACKUP"
python3 - <<'PY'
from pathlib import Path
p=Path('/opt/wiener-backend/server.mjs')
s=p.read_text()
old="const price=await tonUsdV4(true),gross=Number(((amount/15000)/price).toFixed(8));"
new="const rate=num((await pool.query(`select token_per_usdt from public.app_settings where id=true`)).rows[0]?.token_per_usdt)||10000,price=await tonUsdV4(true),gross=Number(((amount/rate)/price).toFixed(8));"
if old not in s:
    if "((amount/rate)/price)" in s and "select token_per_usdt from public.app_settings" in s:
        print('Backend dynamic rate patch already present')
    else:
        raise SystemExit('Expected hardcoded TON withdrawal conversion not found; refusing unsafe patch')
else:
    s=s.replace(old,new,1)
    p.write_text(s)
    print('Patched TON withdrawal conversion to live app_settings.token_per_usdt')
PY

node --check "$APP" || { cp -a "$BACKUP" "$APP"; echo "Syntax check failed; rolled back" >&2; exit 1; }

if grep -q "amount/15000" "$APP"; then
  cp -a "$BACKUP" "$APP"
  echo "Hardcoded amount/15000 still present; rolled back" >&2
  exit 1
fi

pm2 restart wiener-backend --update-env >/dev/null
sleep 2
curl -fsS http://127.0.0.1:3000/healthz

echo
echo "=== V70 READY ==="
echo "TON withdrawal conversion now reads live token_per_usdt from app_settings."
echo "Backup: $BACKUP"
