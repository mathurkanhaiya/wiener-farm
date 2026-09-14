#!/usr/bin/env bash
set -Eeuo pipefail
ROOT=/opt/wiener-code
BACK=/opt/wiener-backend
DB=wiener_farm_final
STAMP=$(date +%Y%m%d-%H%M%S)
SERVER="$BACK/server.mjs"
BAK="$BACK/server.mjs.v100-$STAMP.bak"
cp "$SERVER" "$BAK"
echo "Backup: $BAK"
rollback(){ echo 'V100 failed — restoring server'; cp "$BAK" "$SERVER"; pm2 restart wiener-api --update-env >/dev/null 2>&1 || true; }
trap rollback ERR

# DB hardening. Existing sponsored-task callback fix remains compatible/idempotent.
runuser -u postgres -- psql -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
BEGIN;
CREATE TABLE IF NOT EXISTS public.wiener_spin_tokens(
 token text PRIMARY KEY,
 telegram_id bigint NOT NULL REFERENCES public.users(telegram_id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 consumed_at timestamptz
);
CREATE INDEX IF NOT EXISTS wiener_spin_tokens_user_idx ON public.wiener_spin_tokens(telegram_id,created_at DESC);
DELETE FROM public.wiener_spin_tokens WHERE expires_at<now()-interval '1 day';

-- Main rewarded ad: only AdsGram callback-verified sessions may credit; client interaction flag ignored.
CREATE OR REPLACE FUNCTION public.credit_verified_ad_interaction(p_telegram_id bigint,p_session_id uuid,p_interacted boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
DECLARE v_settings app_settings%rowtype; v_user users%rowtype; v_session ad_sessions%rowtype; v_balance numeric; v_reward numeric; v_ref_result jsonb;
BEGIN
 select * into v_settings from app_settings where id=true;
 if v_settings.maintenance_enabled then raise exception 'maintenance'; end if;
 if not v_settings.ads_enabled then raise exception 'ads_disabled'; end if;
 select * into v_session from ad_sessions where id=p_session_id and telegram_id=p_telegram_id for update;
 if not found then raise exception 'ad_session_not_found'; end if;
 if v_session.network<>'adsgram' then raise exception 'invalid_ad_network'; end if;
 if v_session.status='credited' then select balance into v_balance from users where telegram_id=p_telegram_id; return jsonb_build_object('status','credited','already_credited',true,'reward',v_session.reward,'full_reward',coalesce(v_settings.ad_reward,0),'base_reward',coalesce(v_settings.ad_reward,0),'bonus_reward',0,'bonus_unlocked',false,'interaction_detected',false,'remaining',0,'balance',v_balance); end if;
 if v_session.status<>'verified' or v_session.verified_at is null then raise exception 'adsgram_ad_not_verified'; end if;
 if v_session.started_at<now()-interval '15 minutes' then update ad_sessions set status='expired' where id=v_session.id; raise exception 'ad_session_expired'; end if;
 if v_session.verified_at<v_session.started_at then raise exception 'invalid_ad_verification'; end if;
 select * into v_user from users where telegram_id=p_telegram_id for update;
 if not found then raise exception 'user_not_found'; end if;
 if v_user.is_banned then raise exception 'user_banned'; end if;
 if v_user.ads_day<>current_date then update users set ads_day=current_date,ads_watched_today=0 where telegram_id=p_telegram_id; v_user.ads_watched_today:=0; end if;
 if v_user.ads_watched_today>=v_settings.daily_ad_limit then raise exception 'daily_ad_limit'; end if;
 v_reward:=coalesce(v_settings.ad_reward,0);
 update ad_sessions set status='credited',reward=v_reward,credited_at=now() where id=p_session_id and status='verified';
 update users set ads_watched_today=ads_watched_today+1,total_ads=total_ads+1 where telegram_id=p_telegram_id;
 v_balance:=credit_user(p_telegram_id,v_reward,'rewarded_ad','Rewarded ad',jsonb_build_object('session_id',p_session_id,'network',v_session.network,'provider_verified',true),true);
 v_ref_result:=try_activate_referral(p_telegram_id);
 return jsonb_build_object('status','credited','already_credited',false,'reward',v_reward,'full_reward',v_reward,'base_reward',v_reward,'bonus_reward',0,'bonus_unlocked',false,'interaction_detected',false,'remaining',0,'balance',v_balance,'provider_verified',true,'referral_activated',coalesce((v_ref_result->>'activated')::boolean,false),'referrer',v_ref_result->'referrer','referrer_balance',v_ref_result->'referrer_balance','qualified_reward',coalesce((v_ref_result->>'qualified_reward')::numeric,0),'referral_reason',v_ref_result->>'reason');
END $f$;

-- Bonus ad: callback is authoritative; client interacted=true cannot increase reward.
CREATE OR REPLACE FUNCTION public.credit_tads_ad_interaction(p_telegram_id bigint,p_session_id uuid,p_interacted boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
DECLARE v_user users%rowtype; v_s tads_ad_sessions%rowtype; v_balance numeric; v_count integer; v_reward numeric:=10;
BEGIN
 select * into v_s from tads_ad_sessions where id=p_session_id and telegram_id=p_telegram_id for update;
 if not found then raise exception 'tads_session_not_found'; end if;
 if v_s.status='credited' then select balance into v_balance from users where telegram_id=p_telegram_id; return jsonb_build_object('status','credited','already_credited',true,'reward',v_s.reward,'full_reward',10,'base_reward',10,'bonus_reward',0,'bonus_unlocked',false,'interaction_detected',false,'remaining',0,'balance',v_balance); end if;
 if v_s.status<>'started' then raise exception 'tads_session_invalid'; end if;
 if v_s.callback_received_at is null then raise exception 'tads_ad_not_verified'; end if;
 if v_s.callback_received_at<v_s.started_at then raise exception 'tads_invalid_callback'; end if;
 if v_s.started_at<now()-interval '15 minutes' then update tads_ad_sessions set status='expired' where id=v_s.id; raise exception 'tads_session_expired'; end if;
 select count(*) into v_count from tads_ad_sessions where telegram_id=p_telegram_id and reward_day=current_date and widget_id=v_s.widget_id and status='credited'; if v_count>=10 then raise exception 'tads_daily_limit'; end if;
 select * into v_user from users where telegram_id=p_telegram_id for update; if not found then raise exception 'user_not_found'; end if; if v_user.is_banned then raise exception 'user_banned'; end if;
 update tads_ad_sessions set status='credited',reward=v_reward,credited_at=now() where id=v_s.id and status='started';
 v_balance:=credit_user(p_telegram_id,v_reward,'tads_ad','Bonus rewarded ad',jsonb_build_object('session_id',p_session_id,'widget_id',v_s.widget_id,'provider_verified',true),true);
 return jsonb_build_object('status','credited','already_credited',false,'reward',v_reward,'full_reward',v_reward,'base_reward',v_reward,'bonus_reward',0,'bonus_unlocked',false,'interaction_detected',false,'remaining',0,'balance',v_balance,'provider_verified',true);
END $f$;

-- Sponsored task: callback + cap + one-credit transaction. Replaces earlier partial hardening safely.
CREATE OR REPLACE FUNCTION public.credit_adsgram_task(p_telegram_id bigint,p_session_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
DECLARE s adsgram_task_sessions%rowtype; new_balance numeric; tx_id uuid; used integer;
BEGIN
 select * into s from adsgram_task_sessions where id=p_session_id and telegram_id=p_telegram_id for update;
 if not found then raise exception 'task_session_not_found'; end if;
 if s.status='credited' then select balance into new_balance from users where telegram_id=p_telegram_id; return jsonb_build_object('status','credited','reward',s.reward,'balance',new_balance,'session_id',s.id,'already_credited',true); end if;
 if s.status<>'started' then raise exception 'task_session_closed'; end if;
 if s.created_at<now()-interval '30 minutes' then update adsgram_task_sessions set status='expired' where id=s.id; raise exception 'task_session_expired'; end if;
 if s.callback_received_at is null or s.callback_received_at<s.created_at then raise exception 'adsgram_task_not_verified'; end if;
 select count(*) into used from adsgram_task_sessions where telegram_id=p_telegram_id and status='credited' and credited_at>=current_date and credited_at<current_date+interval '1 day'; if used>=20 then raise exception 'adsgram_task_daily_limit'; end if;
 update users set balance=coalesce(balance,0)+s.reward,total_earned=coalesce(total_earned,0)+s.reward,last_active=now() where telegram_id=p_telegram_id and coalesce(is_banned,false)=false returning balance into new_balance; if new_balance is null then raise exception 'user_not_found_or_banned'; end if;
 insert into transactions(telegram_id,kind,amount,balance_after,description,metadata) values(p_telegram_id,'adsgram_task',s.reward,new_balance,'AdsGram sponsored task reward',jsonb_build_object('block_id',s.block_id,'session_id',s.id,'provider_verified',true)) returning id into tx_id;
 update adsgram_task_sessions set status='credited',credited_at=now() where id=s.id and status='started';
 return jsonb_build_object('status','credited','reward',s.reward,'balance',new_balance,'session_id',s.id,'transaction_id',tx_id,'already_credited',false,'provider_verified',true);
END $f$;
COMMIT;
SQL

python3 "$ROOT/scripts/patch-vps-v100-security-hardening.py"
node --check "$SERVER"
pm2 restart wiener-api --update-env
sleep 2
curl -fsS http://127.0.0.1:3000/health >/dev/null
trap - ERR
echo 'V100 SECURITY HARDENING INSTALLED — health OK'
