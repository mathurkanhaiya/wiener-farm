#!/usr/bin/env bash
set -euo pipefail
cd /opt/wiener-code
DB=wiener_farm_final
BACKEND=/opt/wiener-backend/server.mjs
[[ -f "$BACKEND" ]] || BACKEND=/opt/wiener-backend/server.js
[[ -f "$BACKEND" ]] || { echo "ERROR: backend missing"; exit 1; }

echo "=== V119 MULTI-ACCOUNT RESTRICTION AUDIT ==="
echo "This audit is read-only. It changes no users and no backend code."
node --check "$BACKEND"

echo
echo "=== USER TABLE COLUMNS RELATED TO BAN / RESTRICT / DEVICE / RISK ==="
runuser -u postgres -- psql -P pager=off -d "$DB" -c "
select column_name,data_type
from information_schema.columns
where table_schema='public' and table_name='users'
  and (
    column_name ilike '%ban%' or column_name ilike '%restrict%' or
    column_name ilike '%device%' or column_name ilike '%risk%' or
    column_name ilike '%alt%' or column_name ilike '%fraud%'
  )
order by ordinal_position;"

echo
echo "=== TABLES RELATED TO BAN / RESTRICT / DEVICE / RISK ==="
runuser -u postgres -- psql -P pager=off -d "$DB" -c "
select table_name
from information_schema.tables
where table_schema='public'
  and (
    table_name ilike '%ban%' or table_name ilike '%restrict%' or
    table_name ilike '%device%' or table_name ilike '%risk%' or
    table_name ilike '%alt%' or table_name ilike '%fraud%'
  )
order by table_name;"

echo
echo "=== BACKEND REFERENCES ==="
grep -nEi 'multi.?account|multi.?device|device.?finger|fingerprint|auto.?ban|risk.?ban|alt.?account|is_banned|banned|restrict' "$BACKEND" | head -n 240 || true

echo
echo "=== AUDIT COMPLETE ==="
echo "Paste this output back before applying V119 removal/unban."
