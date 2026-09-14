#!/usr/bin/env bash
set -euo pipefail
cd /opt/wiener-code
git fetch origin main
git reset --hard origin/main
SERVER=/opt/wiener-backend/server.mjs
[ -f "$SERVER" ] || SERVER=/opt/wiener-backend/server.js
[ -f "$SERVER" ] || { echo 'Wiener backend server not found'; exit 1; }
cp "$SERVER" "$SERVER.treasury-$(date +%Y%m%d-%H%M%S).bak"
install -d -m 700 /etc/wiener-farm
SECRET_FILE=/etc/wiener-farm/treasury.env
if [ ! -s "$SECRET_FILE" ]; then
  umask 077
  printf 'TREASURY_SERVER_SECRET=%s\n' "$(openssl rand -hex 48)" > "$SECRET_FILE"
  printf 'TREASURY_ADSGRAM_BLOCK_ID=%s\n' "${TREASURY_ADSGRAM_BLOCK_ID:-int-44228}" >> "$SECRET_FILE"
fi
chmod 600 "$SECRET_FILE"
set -a
. "$SECRET_FILE"
set +a
runuser -u postgres -- psql -d wiener_farm_final -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS public.treasury_accounts(telegram_id bigint PRIMARY KEY,keys integer NOT NULL DEFAULT 0 CHECK(keys>=0),points integer NOT NULL DEFAULT 0 CHECK(points>=0),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.treasury_ad_sessions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),telegram_id bigint NOT NULL,block_id text,status text NOT NULL DEFAULT 'started',started_at timestamptz NOT NULL DEFAULT now(),eligible_at timestamptz,expires_at timestamptz,credited_at timestamptz,reward_day date DEFAULT (now() at time zone 'utc')::date);
ALTER TABLE public.treasury_ad_sessions ADD COLUMN IF NOT EXISTS block_id text;
ALTER TABLE public.treasury_ad_sessions ADD COLUMN IF NOT EXISTS eligible_at timestamptz;
ALTER TABLE public.treasury_ad_sessions ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE public.treasury_ad_sessions ADD COLUMN IF NOT EXISTS credited_at timestamptz;
ALTER TABLE public.treasury_ad_sessions ADD COLUMN IF NOT EXISTS reward_day date;
ALTER TABLE public.treasury_ad_sessions ADD COLUMN IF NOT EXISTS points_awarded integer DEFAULT 0;
ALTER TABLE public.treasury_ad_sessions ADD COLUMN IF NOT EXISTS client_completed_at timestamptz;
UPDATE public.treasury_ad_sessions SET block_id=COALESCE(NULLIF(block_id,''),'int-44228'),eligible_at=COALESCE(eligible_at,started_at),expires_at=COALESCE(expires_at,started_at+interval '10 minutes'),reward_day=COALESCE(reward_day,(started_at at time zone 'utc')::date) WHERE block_id IS NULL OR block_id='' OR eligible_at IS NULL OR expires_at IS NULL OR reward_day IS NULL;
ALTER TABLE public.treasury_ad_sessions ALTER COLUMN block_id SET DEFAULT 'int-44228';
ALTER TABLE public.treasury_ad_sessions ALTER COLUMN eligible_at SET NOT NULL;
ALTER TABLE public.treasury_ad_sessions ALTER COLUMN expires_at SET NOT NULL;
ALTER TABLE public.treasury_ad_sessions ALTER COLUMN reward_day SET DEFAULT (now() at time zone 'utc')::date;
ALTER TABLE public.treasury_ad_sessions ALTER COLUMN reward_day SET NOT NULL;
WITH r AS (SELECT id,row_number() OVER(PARTITION BY telegram_id ORDER BY started_at DESC,id DESC) n FROM public.treasury_ad_sessions WHERE status='started') UPDATE public.treasury_ad_sessions t SET status='expired' FROM r WHERE t.id=r.id AND r.n>1;
CREATE UNIQUE INDEX IF NOT EXISTS treasury_one_open_ad ON public.treasury_ad_sessions(telegram_id) WHERE status='started';
CREATE INDEX IF NOT EXISTS treasury_ad_daily_idx ON public.treasury_ad_sessions(telegram_id,reward_day,status);
CREATE TABLE IF NOT EXISTS public.treasury_key_events(id bigserial PRIMARY KEY,telegram_id bigint NOT NULL,source text NOT NULL,points integer NOT NULL DEFAULT 0,key_added integer NOT NULL DEFAULT 0,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS treasury_key_daily_idx ON public.treasury_key_events(telegram_id,created_at);
CREATE TABLE IF NOT EXISTS public.treasury_chest_opens(id bigserial PRIMARY KEY,request_id uuid NOT NULL UNIQUE,telegram_id bigint NOT NULL,reward numeric NOT NULL CHECK(reward>=0),created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS treasury_open_user_idx ON public.treasury_chest_opens(telegram_id,created_at DESC);
COMMIT;
SQL
ROUTE=/opt/wiener-code/scripts/v104-treasury-route.txt
python3 - "$SERVER" "$ROUTE" <<'PY'
from pathlib import Path
import re,sys
p=Path(sys.argv[1]); route=Path(sys.argv[2]).read_text().rstrip()+"\n"; s=p.read_text()
# Remove the legacy 410 compatibility blocker regardless of its line number.
s=re.sub(r"// Removed Treasury Chest compatibility\.[\s\S]*?for\(const path of \['/functions/v1/wiener-treasury','/functions/v1/wiener-treasury-reward'\]\)\{\s*app\.all\(path,[\s\S]*?\);\s*\}\s*",'',s,count=1)
marker='// V104 SECURE WIENER TREASURY'
def next_listen(text,start):
    xs=[x for n in ('app.listen(','server.listen(') if (x:=text.find(n,start))>=0]
    return min(xs) if xs else len(text)
if marker in s:
    a=s.index(marker); z=next_listen(s,a); s=s[:a]+route+'\n'+s[z:]
else:
    xs=[x for n in ('app.listen(','server.listen(') if (x:=s.rfind(n))>=0]; pos=max(xs) if xs else len(s); s=s[:pos]+route+'\n'+s[pos:]
p.write_text(s)
PY
node --check "$SERVER"
npm run build
pm2 restart wiener-api --update-env
pm2 save >/dev/null 2>&1 || true
sleep 2
curl -fsS http://127.0.0.1:3000/health
echo
echo 'Fresh Wiener Treasury repaired and deployed.'
