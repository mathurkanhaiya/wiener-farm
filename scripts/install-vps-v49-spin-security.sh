#!/usr/bin/env bash
set -Eeuo pipefail

CODE=/opt/wiener-code
SERVER=/opt/wiener-backend/server.mjs
[ -f "$SERVER" ] || SERVER=/opt/wiener-backend/server.js
DB="${WIENER_DB_NAME:-wiener_farm_final}"
export WIENER_BACKEND_FILE="$SERVER"

cd "$CODE"
git fetch origin main
git show origin/main:scripts/patch-vps-v49-spin-security.py > /tmp/v49.py
python3 -m py_compile /tmp/v49.py

STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP="$SERVER.pre-v49-$STAMP"
cp "$SERVER" "$BACKUP"

rollback(){
  rc=$?
  echo "V49 failed — restoring backend backup"
  cp -f "$BACKUP" "$SERVER" 2>/dev/null || true
  pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
  exit "$rc"
}
trap rollback ERR

# Provision schema once as postgres. Runtime API role gets only the minimum data privileges.
runuser -u postgres -- psql -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
BEGIN;

CREATE TABLE IF NOT EXISTS public.wiener_spin_state(
  telegram_id bigint PRIMARY KEY REFERENCES public.users(telegram_id) ON DELETE CASCADE,
  spin_day date NOT NULL DEFAULT current_date,
  free_used integer NOT NULL DEFAULT 0 CHECK (free_used >= 0),
  ad_used integer NOT NULL DEFAULT 0 CHECK (ad_used >= 0),
  bonus_spins integer NOT NULL DEFAULT 0 CHECK (bonus_spins >= 0),
  spin_ton_balance numeric(24,9) NOT NULL DEFAULT 0 CHECK (spin_ton_balance >= 0),
  total_ton_earned numeric(24,9) NOT NULL DEFAULT 0 CHECK (total_ton_earned >= 0),
  total_ton_withdrawn numeric(24,9) NOT NULL DEFAULT 0 CHECK (total_ton_withdrawn >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wiener_spin_events(
  id bigserial PRIMARY KEY,
  telegram_id bigint NOT NULL REFERENCES public.users(telegram_id) ON DELETE CASCADE,
  idempotency_key text NOT NULL UNIQUE,
  reward_type text NOT NULL CHECK(reward_type IN ('wiener','ton','spin')),
  reward_amount numeric(24,9) NOT NULL CHECK(reward_amount > 0),
  segment_index integer NOT NULL CHECK(segment_index BETWEEN 0 AND 11),
  source text NOT NULL DEFAULT 'spin',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wiener_spin_events_user_created_idx ON public.wiener_spin_events(telegram_id,created_at DESC);

CREATE TABLE IF NOT EXISTS public.wiener_spin_ad_sessions(
  session_id text PRIMARY KEY,
  telegram_id bigint NOT NULL REFERENCES public.users(telegram_id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'started' CHECK(status IN ('started','completed','expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS wiener_spin_ad_sessions_user_idx ON public.wiener_spin_ad_sessions(telegram_id,created_at DESC);

CREATE TABLE IF NOT EXISTS public.wiener_spin_withdrawals(
  id bigserial PRIMARY KEY,
  telegram_id bigint NOT NULL REFERENCES public.users(telegram_id) ON DELETE CASCADE,
  amount_ton numeric(24,9) NOT NULL CHECK(amount_ton > 0),
  wallet_address text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','rejected','failed')),
  tx_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS wiener_spin_one_pending_withdrawal_idx ON public.wiener_spin_withdrawals(telegram_id) WHERE status='pending';

ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS spin_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS spin_free_daily integer NOT NULL DEFAULT 1;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS spin_ad_daily_limit integer NOT NULL DEFAULT 3;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS spin_ton_daily_budget numeric(24,9) NOT NULL DEFAULT 0.1;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS spin_ton_withdraw_min numeric(24,9) NOT NULL DEFAULT 0.02;

REVOKE ALL ON TABLE public.wiener_spin_state,public.wiener_spin_events,public.wiener_spin_ad_sessions,public.wiener_spin_withdrawals FROM PUBLIC;
REVOKE ALL ON SEQUENCE public.wiener_spin_events_id_seq,public.wiener_spin_withdrawals_id_seq FROM PUBLIC;

-- Grant only to existing login roles that already have Wiener user read/update access.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT rolname FROM pg_roles
    WHERE rolcanlogin
      AND has_schema_privilege(rolname,'public','USAGE')
      AND has_table_privilege(rolname,'public.users','SELECT')
      AND has_table_privilege(rolname,'public.users','UPDATE')
  LOOP
    EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.wiener_spin_state,public.wiener_spin_events,public.wiener_spin_ad_sessions,public.wiener_spin_withdrawals TO %I',r.rolname);
    EXECUTE format('GRANT USAGE,SELECT ON SEQUENCE public.wiener_spin_events_id_seq,public.wiener_spin_withdrawals_id_seq TO %I',r.rolname);
  END LOOP;
END $$;

COMMIT;
SQL

python3 /tmp/v49.py
node --check "$SERVER"
grep -q "WIENER SPIN SECURITY V49" "$SERVER"

# Verify schema exists and PUBLIC has no direct table grants.
runuser -u postgres -- psql -v ON_ERROR_STOP=1 -d "$DB" -Atc "
SELECT CASE WHEN
  to_regclass('public.wiener_spin_state') IS NOT NULL AND
  to_regclass('public.wiener_spin_events') IS NOT NULL AND
  to_regclass('public.wiener_spin_ad_sessions') IS NOT NULL AND
  to_regclass('public.wiener_spin_withdrawals') IS NOT NULL
THEN 'spin_schema_ok' ELSE 'spin_schema_missing' END;
SELECT CASE WHEN EXISTS(
  SELECT 1 FROM information_schema.table_privileges
  WHERE table_schema='public'
    AND table_name IN ('wiener_spin_state','wiener_spin_events','wiener_spin_ad_sessions','wiener_spin_withdrawals')
    AND grantee='PUBLIC'
) THEN 'public_privilege_bad' ELSE 'public_privileges_ok' END;
"

pm2 restart wiener-api --update-env
sleep 2
curl -fsS http://127.0.0.1:3000/health >/dev/null
pm2 save >/dev/null

trap - ERR
echo
echo "=== V49 SPIN SECURITY READY ==="
echo "- Spinner schema provisioned once by postgres"
echo "- Runtime API no longer runs CREATE/ALTER in public schema"
echo "- PUBLIC access revoked from Spinner tables/sequences"
echo "- Existing Wiener DB role receives minimum DML permissions only"
echo "- TON daily reward budget serialized against concurrent spins"
echo "- Existing atomic balance + idempotent spin protections preserved"
echo "Backup: $BACKUP"
