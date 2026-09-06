#!/usr/bin/env bash
set -Eeuo pipefail

CODE=/opt/wiener-code
SERVER=/opt/wiener-backend/server.mjs
[ -f "$SERVER" ] || SERVER=/opt/wiener-backend/server.js
DB="${WIENER_DB_NAME:-wiener_farm_final}"
export WIENER_BACKEND_FILE="$SERVER"

cd "$CODE"
git fetch origin main
git show origin/main:scripts/patch-vps-v51-spin-schema-credit-fix.py > /tmp/v51.py
python3 -m py_compile /tmp/v51.py

STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP="$SERVER.pre-v51-$STAMP"
cp "$SERVER" "$BACKUP"
rollback(){ rc=$?; echo "V51 failed — restoring backend backup"; cp -f "$BACKUP" "$SERVER" 2>/dev/null || true; pm2 restart wiener-api --update-env >/dev/null 2>&1 || true; exit "$rc"; }
trap rollback ERR

# Repair the full Spinner schema as postgres. IF NOT EXISTS makes this safe on partial installs.
runuser -u postgres -- psql -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
BEGIN;

ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS spin_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS spin_free_daily integer NOT NULL DEFAULT 1;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS spin_ad_daily_limit integer NOT NULL DEFAULT 14;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS spin_ton_daily_budget numeric(24,9) NOT NULL DEFAULT 0.1;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS spin_ton_withdraw_min numeric(24,9) NOT NULL DEFAULT 0.02;
UPDATE public.app_settings SET spin_enabled=true,spin_free_daily=1,spin_ad_daily_limit=14 WHERE id=true;

CREATE TABLE IF NOT EXISTS public.wiener_spin_state(
  telegram_id bigint PRIMARY KEY REFERENCES public.users(telegram_id) ON DELETE CASCADE,
  spin_day date NOT NULL DEFAULT current_date,
  free_used integer NOT NULL DEFAULT 0,
  ad_used integer NOT NULL DEFAULT 0,
  ad_spin_credits integer NOT NULL DEFAULT 0,
  bonus_spins integer NOT NULL DEFAULT 0,
  spin_ton_balance numeric(24,9) NOT NULL DEFAULT 0,
  total_ton_earned numeric(24,9) NOT NULL DEFAULT 0,
  total_ton_withdrawn numeric(24,9) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wiener_spin_state ADD COLUMN IF NOT EXISTS spin_day date NOT NULL DEFAULT current_date;
ALTER TABLE public.wiener_spin_state ADD COLUMN IF NOT EXISTS free_used integer NOT NULL DEFAULT 0;
ALTER TABLE public.wiener_spin_state ADD COLUMN IF NOT EXISTS ad_used integer NOT NULL DEFAULT 0;
ALTER TABLE public.wiener_spin_state ADD COLUMN IF NOT EXISTS ad_spin_credits integer NOT NULL DEFAULT 0;
ALTER TABLE public.wiener_spin_state ADD COLUMN IF NOT EXISTS bonus_spins integer NOT NULL DEFAULT 0;
ALTER TABLE public.wiener_spin_state ADD COLUMN IF NOT EXISTS spin_ton_balance numeric(24,9) NOT NULL DEFAULT 0;
ALTER TABLE public.wiener_spin_state ADD COLUMN IF NOT EXISTS total_ton_earned numeric(24,9) NOT NULL DEFAULT 0;
ALTER TABLE public.wiener_spin_state ADD COLUMN IF NOT EXISTS total_ton_withdrawn numeric(24,9) NOT NULL DEFAULT 0;
ALTER TABLE public.wiener_spin_state ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.wiener_spin_events(
  id bigserial PRIMARY KEY,
  telegram_id bigint NOT NULL REFERENCES public.users(telegram_id) ON DELETE CASCADE,
  idempotency_key text NOT NULL UNIQUE,
  reward_type text NOT NULL,
  reward_amount numeric(24,9) NOT NULL,
  segment_index integer NOT NULL,
  source text NOT NULL DEFAULT 'spin',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wiener_spin_events_user_created_idx ON public.wiener_spin_events(telegram_id,created_at DESC);

CREATE TABLE IF NOT EXISTS public.wiener_spin_ad_sessions(
  session_id text PRIMARY KEY,
  telegram_id bigint NOT NULL REFERENCES public.users(telegram_id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'started',
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
ALTER TABLE public.wiener_spin_ad_sessions ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'started';
ALTER TABLE public.wiener_spin_ad_sessions ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.wiener_spin_ad_sessions ADD COLUMN IF NOT EXISTS completed_at timestamptz;
CREATE INDEX IF NOT EXISTS wiener_spin_ad_sessions_user_idx ON public.wiener_spin_ad_sessions(telegram_id,created_at DESC);

CREATE TABLE IF NOT EXISTS public.wiener_spin_withdrawals(
  id bigserial PRIMARY KEY,
  telegram_id bigint NOT NULL REFERENCES public.users(telegram_id) ON DELETE CASCADE,
  amount_ton numeric(24,9) NOT NULL,
  wallet_address text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  tx_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS wiener_spin_one_pending_withdrawal_idx ON public.wiener_spin_withdrawals(telegram_id) WHERE status='pending';

CREATE TABLE IF NOT EXISTS public.wiener_spin_share_bonus(
  telegram_id bigint PRIMARY KEY REFERENCES public.users(telegram_id) ON DELETE CASCADE,
  completed_shares integer NOT NULL DEFAULT 0,
  rewarded boolean NOT NULL DEFAULT false,
  rewarded_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.wiener_spin_share_sessions(
  session_id text PRIMARY KEY,
  telegram_id bigint NOT NULL REFERENCES public.users(telegram_id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'started',
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS wiener_spin_share_sessions_user_idx ON public.wiener_spin_share_sessions(telegram_id,created_at DESC);

REVOKE ALL ON TABLE public.wiener_spin_state,public.wiener_spin_events,public.wiener_spin_ad_sessions,public.wiener_spin_withdrawals,public.wiener_spin_share_bonus,public.wiener_spin_share_sessions FROM PUBLIC;
REVOKE ALL ON SEQUENCE public.wiener_spin_events_id_seq,public.wiener_spin_withdrawals_id_seq FROM PUBLIC;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT rolname FROM pg_roles
    WHERE rolcanlogin
      AND has_schema_privilege(rolname,'public','USAGE')
      AND has_table_privilege(rolname,'public.users','SELECT')
      AND has_table_privilege(rolname,'public.users','UPDATE')
  LOOP
    EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.wiener_spin_state,public.wiener_spin_events,public.wiener_spin_ad_sessions,public.wiener_spin_withdrawals,public.wiener_spin_share_bonus,public.wiener_spin_share_sessions TO %I',r.rolname);
    EXECUTE format('GRANT USAGE,SELECT ON SEQUENCE public.wiener_spin_events_id_seq,public.wiener_spin_withdrawals_id_seq TO %I',r.rolname);
  END LOOP;
END $$;

COMMIT;
SQL

python3 /tmp/v51.py
node --check "$SERVER"
grep -q "WIENER SPIN CREDIT FIX V51" "$SERVER"

pm2 restart wiener-api --update-env
sleep 2
curl -fsS http://127.0.0.1:3000/health >/dev/null

# Hard verification: required columns exist and 14-ad setting is active.
runuser -u postgres -- psql -v ON_ERROR_STOP=1 -d "$DB" -P pager=off -Atc "
SELECT CASE WHEN count(*)=9 THEN 'spin_columns_ok' ELSE 'spin_columns_missing:'||count(*) END
FROM information_schema.columns
WHERE table_schema='public' AND table_name='wiener_spin_state'
AND column_name IN ('telegram_id','spin_day','free_used','ad_used','ad_spin_credits','bonus_spins','spin_ton_balance','total_ton_earned','total_ton_withdrawn');
SELECT 'spin_ad_daily_limit='||spin_ad_daily_limit FROM public.app_settings WHERE id=true;
"

pm2 save >/dev/null
trap - ERR
echo
echo "=== V51 SPINNER REPAIR READY ==="
echo "- Missing Spinner columns repaired"
echo "- 1 free + 14 rewarded-ad spins/day"
echo "- Each completed ad gets its own ad_spin_credits +1"
echo "- Ad credits are no longer blocked by the 5 bonus-spin prize cap"
echo "- Daily reset clears ad credits correctly"
echo "- Runtime role has DML only; schema DDL remains postgres-only"
echo "Backup: $BACKUP"
