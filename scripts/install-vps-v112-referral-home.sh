#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd /opt/wiener-code
BACKEND=/opt/wiener-backend/server.mjs
[[ -f "$BACKEND" ]] || BACKEND=/opt/wiener-backend/server.js
[[ -f "$BACKEND" ]] || { echo 'ERROR: backend missing'; exit 1; }
node --check "$BACKEND"
BACKUP="${BACKEND}.before-v112-$(date +%Y%m%d-%H%M%S)"
cp -a "$BACKEND" "$BACKUP"
rollback(){ cp -a "$BACKUP" "$BACKEND"; pm2 restart wiener-api --update-env || true; echo "Installation failed; backend restored from $BACKUP"; }
trap rollback ERR
# Patch and validate before changing the schema or restarting the running service.
WIENER_BACKEND_FILE="$BACKEND" python3 "$SCRIPT_DIR/patch-vps-v112-referral-home.py"
node --check "$BACKEND"
runuser -u postgres -- psql -d wiener_farm_final -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
ALTER TABLE public.referral_v2 ADD COLUMN IF NOT EXISTS join_home_verified_at timestamptz;
CREATE TABLE IF NOT EXISTS public.referral_home_v112(
 referred_user_id bigint PRIMARY KEY REFERENCES public.users(telegram_id) ON DELETE CASCADE,
 token text NOT NULL UNIQUE,
 started_at timestamptz NOT NULL,
 last_seen_at timestamptz NOT NULL,
 sequence integer NOT NULL DEFAULT 0 CHECK(sequence>=0)
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.referral_home_v112 TO wiener_app;
COMMIT;
SQL
pm2 restart wiener-api --update-env
sleep 2
curl --max-time 10 -fsS http://127.0.0.1:3000/health
grep -q 'WIENER REFERRAL HOME GATE V112' "$BACKEND"
trap - ERR
echo
echo 'V112 installed: verified join + 10 seconds on Home before the joining reward.'
echo 'Existing payouts are preserved. The ad-completion reward amount is unchanged.'
