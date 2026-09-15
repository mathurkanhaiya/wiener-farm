#!/usr/bin/env bash
set -euo pipefail
cd /opt/wiener-code
git fetch origin main
git reset --hard origin/main
SERVER=/opt/wiener-backend/server.mjs
[ -f "$SERVER" ] || SERVER=/opt/wiener-backend/server.js
[ -f "$SERVER" ] || { echo 'Backend not found'; exit 1; }
cp "$SERVER" "$SERVER.v106-$(date +%Y%m%d-%H%M%S).bak"

# V2 uses started/client_done/credited/expired. The old Treasury table can carry
# a legacy CHECK constraint that rejects these V2 states. Replace only that
# status constraint; do not touch balances, sessions or other app tables.
runuser -u postgres -- psql -d wiener_farm_final -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE r record;
BEGIN
  IF to_regclass('public.treasury_ad_sessions') IS NOT NULL THEN
    FOR r IN
      SELECT conname
      FROM pg_constraint
      WHERE conrelid='public.treasury_ad_sessions'::regclass
        AND contype='c'
        AND pg_get_constraintdef(oid) ILIKE '%status%'
    LOOP
      EXECUTE format('ALTER TABLE public.treasury_ad_sessions DROP CONSTRAINT %I', r.conname);
    END LOOP;
    ALTER TABLE public.treasury_ad_sessions
      ADD CONSTRAINT treasury_ad_sessions_status_check
      CHECK (status IN ('started','client_done','credited','expired')) NOT VALID;
  END IF;
END $$;
SQL

set -a
[ -f /etc/wiener-farm/treasury.env ] && . /etc/wiener-farm/treasury.env
set +a
ROUTE=/opt/wiener-code/scripts/v106-treasury-v2-route.txt
python3 - "$SERVER" "$ROUTE" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1]); route=Path(sys.argv[2]).read_text().rstrip()+"\n"; s=p.read_text(); marker='// V106 ISOLATED WIENER TREASURY V2'
def listen(text,start=0):
 xs=[x for n in ('app.listen(','server.listen(') if (x:=text.find(n,start))>=0]
 return min(xs) if xs else len(text)
if marker in s:
 a=s.index(marker); z=listen(s,a); s=s[:a]+route+'\n'+s[z:]
else:
 xs=[x for n in ('app.listen(','server.listen(') if (x:=s.rfind(n))>=0]; z=max(xs) if xs else len(s); s=s[:z]+route+'\n'+s[z:]
p.write_text(s)
PY
node --check "$SERVER"
npm run build
pm2 restart wiener-api --update-env
pm2 save >/dev/null 2>&1 || true
sleep 2
curl -fsS http://127.0.0.1:3000/health
echo
echo 'Treasury V2 installed; session status constraint fixed.'
