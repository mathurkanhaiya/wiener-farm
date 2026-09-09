#!/usr/bin/env bash
set -euo pipefail

DB="wiener_farm_final"
BACKEND_DIR="/opt/wiener-backend"
BACKEND_FILE="$BACKEND_DIR/server.mjs"
[ -f "$BACKEND_FILE" ] || BACKEND_FILE="$BACKEND_DIR/server.js"
[ -f "$BACKEND_FILE" ] || { echo "Backend file not found"; exit 1; }

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$BACKEND_FILE.before-remove-limited-gram-$STAMP"
cp -a "$BACKEND_FILE" "$BACKUP"
echo "Backend backup: $BACKUP"

python3 - "$BACKEND_FILE" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1])
s=p.read_text()
marker='// === WIENER LIMITED GRAM TASK V80 ==='
if marker in s:
    start=s.rfind('\n',0,s.index(marker))
    if start < 0: start=s.index(marker)
    fallback=s.find('app.use((_req,res)=>',s.index(marker))
    if fallback < 0:
        raise SystemExit('Could not locate backend fallback after Limited GRAM block; refusing unsafe edit')
    line=s.rfind('\n',0,fallback)
    if line < 0: line=fallback
    s=s[:start]+s[line:]
    p.write_text(s)
    print('Removed Limited GRAM backend endpoint block')
else:
    print('Limited GRAM backend block already absent')
PY

node --check "$BACKEND_FILE"

runuser -u postgres -- psql -v ON_ERROR_STOP=1 -d "$DB" -P pager=off <<'SQL'
BEGIN;

-- Delete every withdrawal request created by the Limited GRAM feature.
DELETE FROM public.wiener_spin_withdrawals w
USING public.wiener_limited_gram_tasks t
WHERE t.withdrawal_id IS NOT NULL
  AND w.id = t.withdrawal_id
  AND w.telegram_id = t.telegram_id;

DROP TABLE IF EXISTS public.wiener_limited_gram_sessions;
DROP TABLE IF EXISTS public.wiener_limited_gram_tasks;

COMMIT;
SQL

cd "$BACKEND_DIR"
pm2 restart wiener-api --update-env >/dev/null
sleep 2
curl -fsS http://127.0.0.1:3000/health
echo
echo "Limited GRAM task removed completely."
