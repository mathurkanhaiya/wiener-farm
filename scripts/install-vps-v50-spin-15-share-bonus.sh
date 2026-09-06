#!/usr/bin/env bash
set -Eeuo pipefail

CODE=/opt/wiener-code
SERVER=/opt/wiener-backend/server.mjs
[ -f "$SERVER" ] || SERVER=/opt/wiener-backend/server.js
DB="${WIENER_DB_NAME:-wiener_farm_final}"
export WIENER_BACKEND_FILE="$SERVER"

cd "$CODE"
git fetch origin main
git show origin/main:scripts/patch-vps-v50-spin-15-share-bonus.py > /tmp/v50.py
python3 -m py_compile /tmp/v50.py

STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP="$SERVER.pre-v50-$STAMP"
cp "$SERVER" "$BACKUP"

rollback(){
  rc=$?
  echo "V50 failed — restoring backend backup"
  cp -f "$BACKUP" "$SERVER" 2>/dev/null || true
  pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
  exit "$rc"
}
trap rollback ERR

# One-time schema work is done as postgres, never by the runtime API role.
runuser -u postgres -- psql -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
BEGIN;

CREATE TABLE IF NOT EXISTS public.wiener_spin_share_bonus(
  telegram_id bigint PRIMARY KEY REFERENCES public.users(telegram_id) ON DELETE CASCADE,
  completed_shares integer NOT NULL DEFAULT 0 CHECK(completed_shares BETWEEN 0 AND 5),
  rewarded boolean NOT NULL DEFAULT false,
  rewarded_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wiener_spin_share_sessions(
  session_id text PRIMARY KEY,
  telegram_id bigint NOT NULL REFERENCES public.users(telegram_id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'started' CHECK(status IN ('started','completed','failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS wiener_spin_share_sessions_user_idx ON public.wiener_spin_share_sessions(telegram_id,created_at DESC);

-- User requested 15 regular spins/day: 1 free + 14 rewarded-ad spins.
UPDATE public.app_settings SET spin_free_daily=1,spin_ad_daily_limit=14 WHERE id=true;

REVOKE ALL ON TABLE public.wiener_spin_share_bonus,public.wiener_spin_share_sessions FROM PUBLIC;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT rolname FROM pg_roles
    WHERE rolcanlogin
      AND has_schema_privilege(rolname,'public','USAGE')
      AND has_table_privilege(rolname,'public.users','SELECT')
      AND has_table_privilege(rolname,'public.users','UPDATE')
      AND has_table_privilege(rolname,'public.wiener_spin_state','SELECT')
  LOOP
    EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.wiener_spin_share_bonus,public.wiener_spin_share_sessions TO %I',r.rolname);
  END LOOP;
END $$;

COMMIT;
SQL

python3 /tmp/v50.py
node --check "$SERVER"
grep -q "WIENER SPIN SHARE BONUS V50" "$SERVER"

pm2 restart wiener-api --update-env
sleep 2
curl -fsS http://127.0.0.1:3000/health >/dev/null
pm2 save >/dev/null

trap - ERR
echo
echo "=== V50 SPIN 15/DAY + SHARE BONUS READY ==="
echo "- 1 free spin + 14 ad spins/day"
echo "- Each completed rewarded ad unlocks +1 spin"
echo "- Updated reward probability table"
echo "- Bonus-spin storage capped at 5"
echo "- One-time +0.0025 TON share bonus after first TON win"
echo "- 5 visibility-qualified share attempts required"
echo "- Early return => share not detected / send again"
echo "- Bonus is credited atomically to Spin TON balance"
echo "Backup: $BACKUP"
