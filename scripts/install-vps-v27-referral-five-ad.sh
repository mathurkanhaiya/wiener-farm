#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=/opt/wiener-code
DB=wiener_farm_final
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKEND=/opt/wiener-backend/server.js

if [[ ! -f "$BACKEND" ]]; then
  PM2_BACKEND="$(pm2 jlist 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{try{const a=JSON.parse(s);const p=a.find(x=>x.name==='wiener-api');process.stdout.write(p?.pm2_env?.pm_exec_path||'')}catch{}})" || true)"
  if [[ -n "$PM2_BACKEND" && -f "$PM2_BACKEND" ]]; then BACKEND="$PM2_BACKEND"; fi
fi
if [[ ! -f "$BACKEND" && -f /opt/wiener-backend/server.mjs ]]; then BACKEND=/opt/wiener-backend/server.mjs; fi

export WIENER_BACKEND_FILE="$BACKEND"
BACKUP="${BACKEND}.v27-backup-${STAMP}"

echo '=== V27 REFERRAL FIVE-AD PRECHECK ==='
echo "backend_file=$BACKEND"
[[ -f "$BACKEND" ]] || { echo 'ERROR: live backend not found'; exit 1; }
[[ -f "$ROOT/scripts/patch-vps-v27-referral-five-ad.py" ]] || { echo 'ERROR: V27 patcher missing'; exit 1; }
python3 -m py_compile "$ROOT/scripts/patch-vps-v27-referral-five-ad.py"
node --check "$BACKEND"

COLS="$(runuser -u postgres -- psql -d "$DB" -Atqc "
select count(*) from information_schema.columns
where table_schema='public' and table_name='users'
and column_name in ('telegram_id','referred_by','total_ads','referral_active','referral_reward_eligible','active_referrals_count');
")"
[[ "$COLS" == "6" ]] || { echo "ERROR: referral user columns incomplete ($COLS/6)"; exit 1; }

SETTING="$(runuser -u postgres -- psql -d "$DB" -Atqc "
select count(*) from information_schema.columns
where table_schema='public' and table_name='app_settings'
and column_name='referral_active_ads_required';
")"
[[ "$SETTING" == "1" ]] || { echo 'ERROR: referral_active_ads_required setting missing'; exit 1; }
echo 'precheck=PASS'

echo '=== CURRENT REFERRAL STATE ==='
runuser -u postgres -- psql -d "$DB" -P pager=off -c "
select referral_active_ads_required as current_required_ads
from public.app_settings where id=true;

select
  count(*) filter(where referred_by is not null) as referred_users,
  count(*) filter(where referred_by is not null and coalesce(total_ads,0)>=5 and coalesce(referral_reward_eligible,true)=true) as eligible_5plus,
  count(*) filter(where referred_by is not null and referral_active=true and coalesce(referral_reward_eligible,true)=true) as active_now,
  count(*) filter(where referred_by is not null and coalesce(total_ads,0)>=5 and coalesce(referral_reward_eligible,true)=true and coalesce(referral_active,false)=false) as needs_activation
from public.users;
"

echo '=== DRY-RUN BACKEND PATCH ==='
EXT="${BACKEND##*.}"
DRYRUN="/tmp/wiener-v27-dryrun-${STAMP}.${EXT}"
cp -a "$BACKEND" "$DRYRUN"
WIENER_BACKEND_FILE="$DRYRUN" python3 "$ROOT/scripts/patch-vps-v27-referral-five-ad.py"
node --check "$DRYRUN"
rm -f "$DRYRUN"
echo 'dry_run=PASS'

cp -a "$BACKEND" "$BACKUP"
rollback(){
  echo 'ERROR: V27 backend step failed; restoring backend backup.'
  cp -a "$BACKUP" "$BACKEND" || true
  node --check "$BACKEND" || true
  pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
}
trap rollback ERR

echo '=== PATCH LIVE BOT/API ==='
python3 "$ROOT/scripts/patch-vps-v27-referral-five-ad.py"
node --check "$BACKEND"
pm2 restart wiener-api --update-env
sleep 2
node --check "$BACKEND"

WEBHOOK="$(curl -sS -o /tmp/wiener-v27-webhook.txt -w '%{http_code}' -X POST http://127.0.0.1:3000/functions/v1/wiener-bot-webhook -H 'content-type: application/json' -d '{}' || true)"
echo "webhook_without_secret_http=$WEBHOOK"
if [[ "$WEBHOOK" == "000" || "$WEBHOOK" == "404" || "$WEBHOOK" == "502" ]]; then
  echo 'ERROR: webhook unhealthy after V27 backend patch'
  exit 1
fi

echo '=== APPLY ONE CURRENT REFERRAL RULE ==='
runuser -u postgres -- psql -d "$DB" -v ON_ERROR_STOP=1 <<'SQL'
begin;

update public.app_settings
set referral_active_ads_required=5,
    updated_at=now()
where id=true;

-- Re-run the existing referral qualification trigger, if present, using the
-- current 5-ad setting. This preserves the existing reward/idempotency logic.
update public.users
set total_ads=total_ads
where referred_by is not null
  and telegram_id<>referred_by
  and coalesce(total_ads,0)>=5
  and coalesce(referral_reward_eligible,true)=true
  and coalesce(referral_active,false)=false;

-- If an older trigger does not understand the new setting, normalize only the
-- active status. Monetary reward amounts/ledger entries are deliberately not
-- fabricated here.
update public.users
set referral_active=true
where referred_by is not null
  and telegram_id<>referred_by
  and coalesce(total_ads,0)>=5
  and coalesce(referral_reward_eligible,true)=true
  and coalesce(referral_active,false)=false;

update public.users u
set active_referrals_count=(
  select count(*)::int
  from public.users r
  where r.referred_by=u.telegram_id
    and r.referral_active=true
    and coalesce(r.referral_reward_eligible,true)=true
)
where exists(
  select 1 from public.users r where r.referred_by=u.telegram_id
);

commit;
SQL

echo '=== VERIFY CURRENT RULE ==='
runuser -u postgres -- psql -d "$DB" -P pager=off -c "
select referral_active_ads_required as required_ads
from public.app_settings where id=true;

select
  count(*) filter(where referred_by is not null and coalesce(total_ads,0)>=5 and coalesce(referral_reward_eligible,true)=true) as eligible_5plus,
  count(*) filter(where referred_by is not null and coalesce(total_ads,0)>=5 and coalesce(referral_reward_eligible,true)=true and referral_active=true) as active_5plus,
  count(*) filter(where referred_by is not null and coalesce(total_ads,0)>=5 and coalesce(referral_reward_eligible,true)=true and coalesce(referral_active,false)=false) as remaining_mismatch
from public.users;
"

pm2 save >/dev/null
trap - ERR

echo '=== V27 REFERRAL FIVE-AD RULE INSTALLED ==='
echo 'Current rule: every eligible referral becomes ACTIVE at 5 verified ads.'
echo 'Old 10/20-ad qualification display is removed.'
echo 'Existing invalid/same-device referrals remain ineligible.'
echo 'No balances, referral reward amounts, payout settings, or wallet secrets were changed.'
