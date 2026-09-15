#!/usr/bin/env bash
set -euo pipefail

cd /opt/wiener-code
DB=wiener_farm_final
BACKEND=/opt/wiener-backend/server.mjs
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${BACKEND}.bak-v57-${STAMP}"

echo '=== V57 MEDIA BROADCAST SAFE INSTALL ==='
[[ -f "$BACKEND" ]] || { echo 'ERROR: backend server.mjs not found' >&2; exit 1; }
cp -a "$BACKEND" "$BACKUP"

echo '=== DATABASE ==='
runuser -u postgres -- psql -d "$DB" -v ON_ERROR_STOP=1 <<'SQL'
ALTER TABLE public.admin_broadcast_sessions ADD COLUMN IF NOT EXISTS source_chat_id bigint;
ALTER TABLE public.admin_broadcast_sessions ADD COLUMN IF NOT EXISTS source_message_id bigint;
ALTER TABLE public.admin_broadcast_sessions ADD COLUMN IF NOT EXISTS media_kind text;
SQL

echo '=== BACKEND PATCH ==='
if ! python3 scripts/patch-vps-v57-broadcast-media.py; then
  cp -a "$BACKUP" "$BACKEND"
  echo 'ERROR: patch failed; backend restored' >&2
  exit 1
fi

if ! node --check "$BACKEND"; then
  cp -a "$BACKUP" "$BACKEND"
  echo 'ERROR: node syntax check failed; backend restored' >&2
  exit 1
fi

grep -q 'WIENER BROADCAST MEDIA V57' "$BACKEND" || { cp -a "$BACKUP" "$BACKEND"; echo 'ERROR: V57 marker missing; backend restored' >&2; exit 1; }
grep -q 'copyMessage' "$BACKEND" || { cp -a "$BACKUP" "$BACKEND"; echo 'ERROR: copyMessage support missing; backend restored' >&2; exit 1; }
grep -q "bcm:send" "$BACKEND" || { cp -a "$BACKUP" "$BACKEND"; echo 'ERROR: media confirm callback missing; backend restored' >&2; exit 1; }

echo '=== RESTART ==='
pm2 restart wiener-api
sleep 2
if ! curl -fsS http://127.0.0.1:3000/health; then
  echo
  echo 'ERROR: health check failed; restoring backend' >&2
  cp -a "$BACKUP" "$BACKEND"
  pm2 restart wiener-api
  sleep 2
  curl -fsS http://127.0.0.1:3000/health || true
  exit 1
fi

echo
pm2 save

echo '=== VERIFY V57 ==='
runuser -u postgres -- psql -d "$DB" -Atqc "select count(*)||' media_columns' from information_schema.columns where table_schema='public' and table_name='admin_broadcast_sessions' and column_name in ('source_chat_id','source_message_id','media_kind')"
node --check "$BACKEND"

echo '=== V57 READY ==='
echo 'Broadcast Center now accepts text as before plus one photo/video/GIF/document with its caption.'
echo 'Media preview uses Telegram copyMessage, preserving the original media and caption.'
echo 'Nothing is delivered until admin taps SEND NOW.'
echo 'Final delivery includes the OPEN WIENER FARM button and remains deduplicated per target.'
