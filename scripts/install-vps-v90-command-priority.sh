#!/usr/bin/env bash
set -Eeuo pipefail
CODE=/opt/wiener-code
SERVER=/opt/wiener-backend/server.mjs
[ -f "$SERVER" ] || SERVER=/opt/wiener-backend/server.js
[ -f "$SERVER" ] || { echo 'ERROR: backend file not found'; exit 1; }
cd "$CODE"
STAMP=$(date +%Y%m%d-%H%M%S)
cp -a "$SERVER" "$SERVER.before-v90-$STAMP"

echo '=== V90 DATABASE PERMISSION REPAIR ==='
runuser -u postgres -- psql -d wiener_farm_final -v ON_ERROR_STOP=1 <<'SQL'
grant usage on schema public to wiener_app;
grant usage,select on all sequences in schema public to wiener_app;
SQL

echo '=== V90 BOT ROUTING REPAIR ==='
python3 scripts/patch-vps-v90-command-priority.py
node --check "$SERVER"
pm2 restart wiener-api --update-env >/dev/null
pm2 save >/dev/null
sleep 2
curl -fsS http://127.0.0.1:3000/health; echo

echo '=== VERIFY V90 ==='
grep -n 'WIENER BOT COMMAND PRIORITY V90' "$SERVER" | head -3
runuser -u postgres -- psql -d wiener_farm_final -P pager=off -c "select has_schema_privilege('wiener_app','public','USAGE') as public_schema_usage;"
echo '=== V90 READY: /broadcast + admin Broadcast button + /addtask command priority repaired ==='
