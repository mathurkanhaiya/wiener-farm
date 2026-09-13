#!/usr/bin/env bash
set -euo pipefail

REPO=/opt/wiener-code
BACKEND_DIR=/opt/wiener-backend
DB=wiener_farm_final
APP_ROLE=wiener_app
PM2_APP=wiener-api

cd "$REPO"
BACKEND_FILE=""
for f in "$BACKEND_DIR/server.mjs" "$BACKEND_DIR/server.js"; do
  if [ -f "$f" ]; then BACKEND_FILE="$f"; break; fi
done
[ -n "$BACKEND_FILE" ] || { echo 'ERROR: backend server file not found'; exit 1; }

BACKUP="${BACKEND_FILE}.v98f.$(date +%Y%m%d-%H%M%S).bak"
cp -a "$BACKEND_FILE" "$BACKUP"
echo "Backup: $BACKUP"
rollback(){
  echo 'V98F install failed — restoring backend backup'
  cp -a "$BACKUP" "$BACKEND_FILE" || true
  pm2 restart "$PM2_APP" --update-env >/dev/null 2>&1 || true
}
trap rollback ERR

runuser -u postgres -- psql -v ON_ERROR_STOP=1 -d "$DB" <<SQL
CREATE TABLE IF NOT EXISTS public.referral_v2_config(
  id boolean PRIMARY KEY DEFAULT true CHECK(id=true),
  started_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.referral_v2_config(id,started_at) VALUES(true,now()) ON CONFLICT(id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.referral_v2(
  referred_user_id bigint PRIMARY KEY REFERENCES public.users(telegram_id) ON DELETE CASCADE,
  inviter_user_id bigint NOT NULL REFERENCES public.users(telegram_id) ON DELETE CASCADE,
  country_code text,
  tier smallint NOT NULL CHECK(tier BETWEEN 1 AND 4),
  required_ads smallint NOT NULL CHECK(required_ads IN (5,10)),
  join_reward_wiener numeric(24,4) NOT NULL DEFAULT 100 CHECK(join_reward_wiener>=0),
  completion_reward_wiener numeric(24,4) NOT NULL CHECK(completion_reward_wiener>=0),
  total_reward_wiener numeric(24,4) NOT NULL CHECK(total_reward_wiener>=0),
  status text NOT NULL DEFAULT 'pending',
  vpn_blocked boolean NOT NULL DEFAULT false,
  proxy_detected boolean NOT NULL DEFAULT false,
  tor_detected boolean NOT NULL DEFAULT false,
  risk_checked_at timestamptz,
  ban_reason text,
  join_rewarded_at timestamptz,
  qualified_at timestamptz,
  completion_rewarded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS referral_v2_inviter_idx ON public.referral_v2(inviter_user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS referral_v2_status_idx ON public.referral_v2(status,updated_at);

CREATE TABLE IF NOT EXISTS public.referral_v2_ledger(
  id bigserial PRIMARY KEY,
  inviter_user_id bigint NOT NULL REFERENCES public.users(telegram_id) ON DELETE CASCADE,
  referred_user_id bigint NOT NULL REFERENCES public.users(telegram_id) ON DELETE CASCADE,
  stage text NOT NULL CHECK(stage IN ('join','qualified')),
  amount_wiener numeric(24,4) NOT NULL CHECK(amount_wiener>=0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(referred_user_id,stage)
);
CREATE INDEX IF NOT EXISTS referral_v2_ledger_inviter_idx ON public.referral_v2_ledger(inviter_user_id,created_at DESC);

CREATE TABLE IF NOT EXISTS public.referral_v2_ip_cache(
  ip_hash text PRIMARY KEY,
  country_code text,
  is_vpn boolean NOT NULL DEFAULT false,
  is_proxy boolean NOT NULL DEFAULT false,
  is_tor boolean NOT NULL DEFAULT false,
  is_datacenter boolean NOT NULL DEFAULT false,
  checked_at timestamptz NOT NULL DEFAULT now()
);

GRANT USAGE ON SCHEMA public TO $APP_ROLE;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.referral_v2_config,public.referral_v2,public.referral_v2_ledger,public.referral_v2_ip_cache TO $APP_ROLE;
GRANT USAGE,SELECT,UPDATE ON SEQUENCE public.referral_v2_ledger_id_seq TO $APP_ROLE;

-- Disable the old flat reward engine so a new referral cannot be paid twice.
DO \$\$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='app_settings' AND column_name='referral_signup_reward') THEN
    EXECUTE 'UPDATE public.app_settings SET referral_signup_reward=0';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='app_settings' AND column_name='referral_active_reward') THEN
    EXECUTE 'UPDATE public.app_settings SET referral_active_reward=0';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='app_settings' AND column_name='referral_commission_percent') THEN
    EXECUTE 'UPDATE public.app_settings SET referral_commission_percent=0';
  END IF;
END \$\$;
SQL

WIENER_BACKEND_FILE="$BACKEND_FILE" python3 scripts/patch-vps-v98-referral-country-rewards.py
WIENER_BACKEND_FILE="$BACKEND_FILE" python3 scripts/patch-vps-v98f-referral-country-rewards.py
node --check "$BACKEND_FILE"
pm2 restart "$PM2_APP" --update-env
sleep 2
curl -fsS http://127.0.0.1:3000/health
echo

runuser -u postgres -- psql -d "$DB" -P pager=off -c "SELECT started_at FROM public.referral_v2_config WHERE id=true;"
runuser -u postgres -- psql -d "$DB" -P pager=off -c "SELECT has_table_privilege('$APP_ROLE','public.referral_v2','SELECT,INSERT,UPDATE,DELETE') AS referral_v2_ok, has_table_privilege('$APP_ROLE','public.referral_v2_ledger','SELECT,INSERT,UPDATE,DELETE') AS ledger_ok;"

grep -q 'WIENER REFERRAL COUNTRY REWARDS V98F' "$BACKEND_FILE"
trap - ERR
echo '=== V98F REFERRAL COUNTRY REWARDS READY ==='
echo 'Tier1: 600 WIENER / 10 ads | Tier2: 500 / 10 | Tier3: 400 / 5 | Tier4: 300 / 5'
echo 'All tiers: 100 WIENER on valid join; remainder after required valid ads.'
echo 'Self-referral + multi-account: ban. VPN/proxy/Tor: pause reward and ask user to turn it off.'
if grep -q '^IPAPI_IS_KEY=.' "$BACKEND_DIR/.env" 2>/dev/null; then echo 'VPN detection: configured'; else echo 'VPN detection: NOT CONFIGURED — run scripts/configure-vps-v98-referral-risk.sh'; fi
