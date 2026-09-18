#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd /opt/wiener-code
BACKEND=/opt/wiener-backend/server.mjs
[[ -f "$BACKEND" ]] || BACKEND=/opt/wiener-backend/server.js
[[ -f "$BACKEND" ]] || { echo 'ERROR: backend missing'; exit 1; }
BACKUP="${BACKEND}.before-v114-$(date +%Y%m%d-%H%M%S)"; cp -a "$BACKEND" "$BACKUP"
rollback(){ cp -a "$BACKUP" "$BACKEND"; pm2 restart wiener-api --update-env || true; }; trap rollback ERR
runuser -u postgres -- psql -d wiener_farm_final -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE IF NOT EXISTS public.wiener_lottery_bonus_entries(id bigserial PRIMARY KEY,round_id bigint NOT NULL REFERENCES public.wiener_lottery_rounds(id) ON DELETE CASCADE,telegram_id bigint NOT NULL REFERENCES public.users(telegram_id) ON DELETE CASCADE,session_id text NOT NULL UNIQUE,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.wiener_lottery_ad_sessions(session_id text PRIMARY KEY,round_id bigint NOT NULL REFERENCES public.wiener_lottery_rounds(id) ON DELETE CASCADE,telegram_id bigint NOT NULL REFERENCES public.users(telegram_id) ON DELETE CASCADE,status text NOT NULL DEFAULT 'started',created_at timestamptz NOT NULL DEFAULT now(),completed_at timestamptz);
ALTER TABLE public.wiener_lottery_bonus_entries OWNER TO wiener_app;
ALTER TABLE public.wiener_lottery_ad_sessions OWNER TO wiener_app;
ALTER SEQUENCE public.wiener_lottery_bonus_entries_id_seq OWNER TO wiener_app;
GRANT SELECT,UPDATE ON public.users TO wiener_app;
SQL
WIENER_BACKEND_FILE="$BACKEND" python3 "$SCRIPT_DIR/patch-vps-v114-lottery-bonus.py"
node --check "$BACKEND"
pm2 restart wiener-api --update-env
sleep 2
curl --max-time 10 -fsS http://127.0.0.1:3000/health
trap - ERR
echo; echo 'V114 Lottery bonus entries active: +1 per ad, max 20/day.'
