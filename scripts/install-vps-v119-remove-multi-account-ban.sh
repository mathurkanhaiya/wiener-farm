#!/usr/bin/env bash
set -euo pipefail
cd /opt/wiener-code
B=/opt/wiener-backend/server.mjs
D=wiener_farm_final
T="$(date +%Y%m%d-%H%M%S)"
cp -a "$B" "$B.v119-$T.bak"
node scripts/v119-disable-multi-account-autoban.js
node --check "$B"

runuser -u postgres -- psql -v ON_ERROR_STOP=1 -d "$D" <<'SQL'
BEGIN;
CREATE TABLE IF NOT EXISTS public.v119_restore_log(
 telegram_id bigint primary key,
 old_is_banned boolean, old_ban_reason text, old_device_blocked boolean,
 old_device_blocked_reason text, old_referral_reward_eligible boolean,
 old_referral_ineligible_reason text, restored_at timestamptz default now()
);
INSERT INTO public.v119_restore_log(telegram_id,old_is_banned,old_ban_reason,old_device_blocked,old_device_blocked_reason,old_referral_reward_eligible,old_referral_ineligible_reason)
SELECT telegram_id,is_banned,ban_reason,device_blocked,device_blocked_reason,referral_reward_eligible,referral_ineligible_reason
FROM public.users
WHERE ban_reason='multi_account_referral'
   OR coalesce(device_blocked_reason,'') ~* '(multi|same.?device|linked.?device)'
   OR coalesce(referral_ineligible_reason,'') ~* '(multi|same.?device|linked.?device)'
ON CONFLICT(telegram_id) DO NOTHING;

UPDATE public.users u SET
 is_banned=CASE WHEN u.ban_reason='multi_account_referral' THEN false ELSE u.is_banned END,
 ban_reason=CASE WHEN u.ban_reason='multi_account_referral' THEN null ELSE u.ban_reason END,
 device_blocked=false,
 device_blocked_reason=null,
 device_unblocked_at=now(),
 device_admin_approved=true,
 referral_reward_eligible=CASE WHEN coalesce(u.referral_ineligible_reason,'') ~* '(multi|same.?device|linked.?device)' THEN true ELSE u.referral_reward_eligible END,
 referral_ineligible_reason=CASE WHEN coalesce(u.referral_ineligible_reason,'') ~* '(multi|same.?device|linked.?device)' THEN null ELSE u.referral_ineligible_reason END
FROM public.v119_restore_log l WHERE l.telegram_id=u.telegram_id;

UPDATE public.user_risk_profiles r SET enforcement_state='normal',manual_override='safe',updated_at=now()
WHERE r.telegram_id IN (SELECT telegram_id FROM public.v119_restore_log)
AND r.enforcement_state IN ('reward_hold','restricted');

UPDATE public.referral_v2 r SET status='pending',ban_reason=null,updated_at=now()
WHERE r.referred_user_id IN (SELECT telegram_id FROM public.v119_restore_log)
AND r.status='banned' AND r.ban_reason='multi_account_referral';
COMMIT;
SQL

pm2 restart wiener-api --update-env
sleep 2
curl -fsS http://127.0.0.1:3000/health
echo
echo "V119 OK"
runuser -u postgres -- psql -P pager=off -d "$D" -c "select count(*) restored from public.v119_restore_log;"
runuser -u postgres -- psql -P pager=off -d "$D" -c "select coalesce(ban_reason,'(none)') reason,count(*) from public.users where is_banned=true group by 1 order by 2 desc;"
