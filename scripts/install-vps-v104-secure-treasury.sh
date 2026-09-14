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
CREATE TABLE IF NOT EXISTS public.treasury_ad_sessions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),telegram_id bigint NOT NULL,status text NOT NULL DEFAULT 'started',started_at timestamptz NOT NULL DEFAULT now(),eligible_at timestamptz,expires_at timestamptz,credited_at timestamptz,reward_day date DEFAULT (now() at time zone 'utc')::date);
ALTER TABLE public.treasury_ad_sessions ADD COLUMN IF NOT EXISTS eligible_at timestamptz;
ALTER TABLE public.treasury_ad_sessions ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE public.treasury_ad_sessions ADD COLUMN IF NOT EXISTS credited_at timestamptz;
ALTER TABLE public.treasury_ad_sessions ADD COLUMN IF NOT EXISTS reward_day date;
UPDATE public.treasury_ad_sessions SET eligible_at=COALESCE(eligible_at,started_at),expires_at=COALESCE(expires_at,started_at+interval '10 minutes'),reward_day=COALESCE(reward_day,(started_at at time zone 'utc')::date) WHERE eligible_at IS NULL OR expires_at IS NULL OR reward_day IS NULL;
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
[ -s "$ROUTE" ] || { echo 'Treasury route source missing'; exit 1; }
python3 - "$SERVER" "$ROUTE" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1])
route=Path(sys.argv[2]).read_text().rstrip()+"\n"
s=p.read_text()
marker='// V104 SECURE WIENER TREASURY'

def first_listen_after(text,start):
    candidates=[]
    for needle in ('app.listen(','server.listen('):
        pos=text.find(needle,start)
        if pos >= 0:
            candidates.append(pos)
    return min(candidates) if candidates else len(text)

if marker in s:
    start=s.index(marker)
    end=first_listen_after(s,start)
    s=s[:start]+route+'\n'+s[end:]
else:
    candidates=[]
    for needle in ('app.listen(','server.listen('):
        pos=s.rfind(needle)
        if pos >= 0:
            candidates.append(pos)
    pos=max(candidates) if candidates else len(s)
    s=s[:pos]+route+'\n'+s[pos:]
p.write_text(s)
PY
node --check "$SERVER"
npm run build
pm2 restart wiener-api --update-env
pm2 save >/dev/null 2>&1 || true
sleep 2
curl -fsS http://127.0.0.1:3000/health
echo
echo 'Fresh server-authoritative Wiener Treasury installed.'
echo 'Secret remains server-only at /etc/wiener-farm/treasury.env'
