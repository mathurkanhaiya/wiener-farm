#!/usr/bin/env bash
set -Eeuo pipefail
REPO=/opt/wiener-code
BACKEND_DIR=/opt/wiener-backend
DB=wiener_farm_final
PM2_APP=wiener-api
cd "$REPO"
BACKEND="$BACKEND_DIR/server.mjs"
[[ -f "$BACKEND" ]] || BACKEND="$BACKEND_DIR/server.js"
[[ -f "$BACKEND" ]] || { echo "ERROR: backend not found"; exit 1; }
ENV_FILE="$BACKEND_DIR/.env"
touch "$ENV_FILE"
set -a
source "$ENV_FILE" 2>/dev/null || true
set +a
if ! grep -q '^MONETAG_POSTBACK_SECRET=' "$ENV_FILE"; then
  printf 'MONETAG_POSTBACK_SECRET=%s\n' "$(openssl rand -hex 24)" >> "$ENV_FILE"
  export MONETAG_POSTBACK_SECRET="$(tail -n1 "$ENV_FILE" | cut -d= -f2-)"
fi
grep -q '^MONETAG_ZONE_ID=' "$ENV_FILE" || echo 'MONETAG_ZONE_ID=' >> "$ENV_FILE"
grep -q '^ADEXIUM_WIDGET_ID=' "$ENV_FILE" || echo 'ADEXIUM_WIDGET_ID=' >> "$ENV_FILE"

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$BACKEND.v120-$STAMP.bak"
cp -a "$BACKEND" "$BACKUP"
rollback(){ cp -a "$BACKUP" "$BACKEND" || true; pm2 restart "$PM2_APP" --update-env >/dev/null 2>&1 || true; }
trap rollback ERR
node --check "$BACKEND"

runuser -u postgres -- psql -d "$DB" -v ON_ERROR_STOP=1 -v monetag_zone="${MONETAG_ZONE_ID:-}" -v adexium_widget="${ADEXIUM_WIDGET_ID:-}" <<'SQL'
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS adsgram_ad_reward numeric(24,4) NOT NULL DEFAULT 50;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS ad_reward numeric(24,4) NOT NULL DEFAULT 50;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS daily_ad_limit integer NOT NULL DEFAULT 15;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS adsgram_daily_limit integer NOT NULL DEFAULT 15;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS monetag_ad_reward numeric(24,4) NOT NULL DEFAULT 30;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS monetag_daily_limit integer NOT NULL DEFAULT 10;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS monetag_zone_id text;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS adexium_ad_reward numeric(24,4) NOT NULL DEFAULT 50;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS adexium_daily_limit integer NOT NULL DEFAULT 5;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS adexium_widget_id text;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS withdraw_minimum_usdt numeric(24,8) NOT NULL DEFAULT 0.03;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS withdraw_fee_usdt numeric(24,8) NOT NULL DEFAULT 0.01;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS referral_join_reward numeric(24,4) NOT NULL DEFAULT 125;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS referral_total_reward numeric(24,4) NOT NULL DEFAULT 375;
UPDATE public.app_settings SET token_per_usdt=25000,ad_reward=50,daily_ad_limit=15,adsgram_ad_reward=50,adsgram_daily_limit=15,monetag_ad_reward=30,monetag_daily_limit=10,adexium_ad_reward=50,adexium_daily_limit=5,withdraw_minimum_usdt=0.03,withdraw_fee_usdt=0.01,referral_join_reward=125,referral_total_reward=375,monetag_zone_id=NULLIF(:'monetag_zone',''),adexium_widget_id=NULLIF(:'adexium_widget','') WHERE id=true;

CREATE TABLE IF NOT EXISTS public.provider_ad_sessions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 provider text NOT NULL CHECK(provider IN ('monetag','adexium')),
 telegram_id bigint NOT NULL REFERENCES public.users(telegram_id) ON DELETE CASCADE,
 day date NOT NULL DEFAULT ((now() AT TIME ZONE 'utc')::date),
 ymid text UNIQUE,zone_id text,widget_id text,task_id text,status text NOT NULL DEFAULT 'started',
 client_completed_at timestamptz,provider_verified_at timestamptz,credited_at timestamptz,
 reward_wiener numeric(24,4) NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS provider_ad_sessions_user_day_idx ON public.provider_ad_sessions(provider,telegram_id,day,credited_at);
UPDATE public.referral_v2 SET join_reward_wiener=125,completion_reward_wiener=250,total_reward_wiener=375,updated_at=now() WHERE join_rewarded_at IS NULL OR completion_rewarded_at IS NULL;

DO $$
BEGIN
 IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='app_settings' AND column_name='referral_signup_reward') THEN EXECUTE 'UPDATE public.app_settings SET referral_signup_reward=0 WHERE id=true'; END IF;
 IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='app_settings' AND column_name='referral_active_reward') THEN EXECUTE 'UPDATE public.app_settings SET referral_active_reward=0 WHERE id=true'; END IF;
 IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='app_settings' AND column_name='referral_commission_percent') THEN EXECUTE 'UPDATE public.app_settings SET referral_commission_percent=0 WHERE id=true'; END IF;
END $$;
DO $$
BEGIN
 IF to_regclass('public.withdrawal_methods') IS NOT NULL THEN
   UPDATE public.withdrawal_methods SET minimum_usdt=0.03,fee_usdt=0.01,network='BEP20',label='USDT (BEP20)' WHERE method_key ILIKE '%usdt%';
   UPDATE public.withdrawal_methods SET minimum_usdt=0.03,fee_usdt=0.01,network='TON',label='Gram (TON)' WHERE method_key='gram_ton';
 END IF;
 IF to_regclass('public.withdraw_methods') IS NOT NULL THEN
   UPDATE public.withdraw_methods SET minimum_usdt=0.03,fee_usdt=0.01,network='BEP20',label='USDT (BEP20)' WHERE method_key ILIKE '%usdt%';
   UPDATE public.withdraw_methods SET minimum_usdt=0.03,fee_usdt=0.01,network='TON',label='Gram (TON)' WHERE method_key='gram_ton';
 END IF;
END $;
DO $
BEGIN
 IF to_regclass('public.withdrawal_methods') IS NOT NULL THEN
   IF NOT EXISTS (SELECT 1 FROM public.withdrawal_methods WHERE method_key ILIKE '%usdt%') THEN
     INSERT INTO public.withdrawal_methods(method_key,label,network,enabled,minimum_usdt,fee_usdt,sort_order)
     VALUES ('usdt_bep20','USDT (BEP20)','BEP20',true,0.03,0.01,10);
   END IF;
 END IF;
 IF to_regclass('public.withdraw_methods') IS NOT NULL THEN
   IF NOT EXISTS (SELECT 1 FROM public.withdraw_methods WHERE method_key ILIKE '%usdt%') THEN
     INSERT INTO public.withdraw_methods(method_key,label,network,enabled,minimum_usdt,fee_usdt,sort_order)
     VALUES ('usdt_bep20','USDT (BEP20)','BEP20',true,0.03,0.01,10);
   END IF;
 END IF;
END $;
DROP TABLE IF EXISTS public.withdraw_ad_sessions;
SQL

python3 "$REPO/scripts/patch-vps-v120-economy-provider-ads.py" "$BACKEND"
node --check "$BACKEND"
pm2 restart "$PM2_APP" --update-env
sleep 3
curl -fsS http://127.0.0.1:3000/health >/dev/null
pm2 save >/dev/null
trap - ERR
echo "=== V120 READY ==="
echo "25000 WIENER = 1 USDT"
echo "AdsGram 50 W / 15 per day"
echo "Monetag 30 W / 10 per day"
echo "Adexium 50 W / 5 per day"
echo "Withdrawal minimum 0.03 USDT / fee 0.01 USDT"
echo "Withdrawal ad unlock: REMOVED"
echo "Referral: 125 join + 250 active = 375 WIENER"
echo
echo "Set Monetag zone in $ENV_FILE and admin setting monetag_zone_id."
echo "Set Adexium widget in $ENV_FILE and admin setting adexium_widget_id."
echo "Configure Monetag postback:"
echo "https://api.viralaitools.xyz/functions/v1/wiener-monetag-postback?secret=$(grep '^MONETAG_POSTBACK_SECRET=' "$ENV_FILE" | cut -d= -f2-)&ymid={ymid}&event={event_type}&value={reward_event_type}&zone={zone_id}"
