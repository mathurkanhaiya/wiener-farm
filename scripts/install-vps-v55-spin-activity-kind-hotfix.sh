#!/usr/bin/env bash
set -euo pipefail

cd /opt/wiener-code
DB=wiener_farm_final
BACKEND=/opt/wiener-backend/server.mjs

echo '=== V55 SPIN ACTIVITY TRANSACTION HOTFIX ==='
[[ -f "$BACKEND" ]] || { echo 'ERROR: backend server.mjs not found' >&2; exit 1; }
node --check "$BACKEND"

# V54 owns the activity schema/triggers. Install/verify it first, then replace only
# the logging functions with a non-blocking, transactions.kind-aware version.
bash scripts/install-vps-v54-spin-activity-safe.sh

echo '=== PATCH SPIN ACTIVITY MIRROR ==='
runuser -u postgres -- psql -d "$DB" -v ON_ERROR_STOP=1 <<'SQL'
create or replace function public.wiener_spin_tx_mirror_v55(
  p_telegram_id bigint,
  p_amount numeric,
  p_description text
) returns void
language plpgsql
as $$
begin
  -- Current production transactions schema requires kind. Keep this helper
  -- schema-aware so older/local schemas without kind also remain compatible.
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='transactions' and column_name='kind'
  ) then
    execute 'insert into public.transactions(telegram_id,amount,description,kind) values($1,$2,$3,$4)'
      using p_telegram_id,p_amount,p_description,'spin';
  else
    execute 'insert into public.transactions(telegram_id,amount,description) values($1,$2,$3)'
      using p_telegram_id,p_amount,p_description;
  end if;
exception when others then
  -- Activity logging must NEVER make a real spin/ad/withdrawal fail.
  raise warning 'spin activity transaction mirror skipped: %', sqlerrm;
  return;
end $$;

create or replace function public.log_wiener_spin_event_activity_v54()
returns trigger language plpgsql as $$
declare
  d text;
  a numeric := 0;
begin
  begin
    if new.reward_type='wiener' then
      a := new.reward_amount;
      d := '🎡 Spin win: '||trim(to_char(new.reward_amount,'FM999999990.#########'))||' WIENER';
    elsif new.reward_type='ton' then
      d := '🎡 Spin TON win: '||trim(to_char(new.reward_amount,'FM999999990.#########'))||' TON';
    else
      d := '🎡 Spin bonus: +'||trim(to_char(new.reward_amount,'FM999999990'))||case when new.reward_amount=1 then ' spin' else ' spins' end;
    end if;

    insert into public.wiener_spin_activity(telegram_id,event_type,reference_type,reference_id,amount,asset,details)
    values(new.telegram_id,'spin_reward','spin_event',new.id::text,new.reward_amount,new.reward_type,
      jsonb_build_object('reward_type',new.reward_type,'segment_index',new.segment_index,'source',new.source))
    on conflict do nothing;

    if found then perform public.wiener_spin_tx_mirror_v55(new.telegram_id,a,d); end if;
  exception when others then
    raise warning 'spin reward activity log skipped: %', sqlerrm;
  end;
  return new;
end $$;

create or replace function public.log_wiener_spin_ad_activity_v54()
returns trigger language plpgsql as $$
begin
  begin
    if new.status='completed' and old.status is distinct from 'completed' then
      insert into public.wiener_spin_activity(telegram_id,event_type,reference_type,reference_id,amount,asset,details)
      values(new.telegram_id,'ad_spin_credit','spin_ad_session',new.session_id,1,'spin',jsonb_build_object('completed_at',new.completed_at))
      on conflict do nothing;
      if found then perform public.wiener_spin_tx_mirror_v55(new.telegram_id,0,'🎡 Spin ad completed: +1 spin'); end if;
    end if;
  exception when others then
    raise warning 'spin ad activity log skipped: %', sqlerrm;
  end;
  return new;
end $$;

create or replace function public.log_wiener_spin_withdraw_activity_v54()
returns trigger language plpgsql as $$
declare
  ev text;
  ref text;
  d text;
begin
  begin
    if tg_op='INSERT' then
      ev := 'withdraw_requested';
      ref := new.id::text;
      d := '🎡 Spin TON withdrawal requested: '||trim(to_char(new.amount_ton,'FM999999990.#########'))||' TON';
    elsif new.status is distinct from old.status and new.status in ('paid','rejected') then
      ev := 'withdraw_'||new.status;
      ref := new.id::text;
      if new.status='paid' then
        d := '✅ Spin TON withdrawal paid: '||trim(to_char(new.amount_ton,'FM999999990.#########'))||' TON';
      else
        d := '❌ Spin TON withdrawal rejected/refunded: '||trim(to_char(new.amount_ton,'FM999999990.#########'))||' TON';
      end if;
    else
      return new;
    end if;

    insert into public.wiener_spin_activity(telegram_id,event_type,reference_type,reference_id,amount,asset,details)
    values(new.telegram_id,ev,'spin_withdrawal',ref,new.amount_ton,'TON',
      jsonb_build_object('status',new.status,'wallet_address',new.wallet_address,'tx_hash',new.tx_hash))
    on conflict do nothing;

    if found then perform public.wiener_spin_tx_mirror_v55(new.telegram_id,0,d); end if;
  exception when others then
    raise warning 'spin withdrawal activity log skipped: %', sqlerrm;
  end;
  return new;
end $$;

revoke all on function public.wiener_spin_tx_mirror_v55(bigint,numeric,text) from public;
SQL

echo '=== VERIFY V55 ==='
kind_nullable=$(runuser -u postgres -- psql -d "$DB" -Atqc "select coalesce(is_nullable,'missing') from information_schema.columns where table_schema='public' and table_name='transactions' and column_name='kind'")
echo "transactions.kind nullable=$kind_nullable"
runuser -u postgres -- psql -d "$DB" -Atqc "select case when to_regprocedure('public.wiener_spin_tx_mirror_v55(bigint,numeric,text)') is not null then 'spin_tx_mirror_v55_ok' else 'spin_tx_mirror_v55_missing' end"
runuser -u postgres -- psql -d "$DB" -Atqc "select count(*)||' spin_activity_triggers' from pg_trigger where not tgisinternal and tgname in ('trg_wiener_spin_event_activity_v54','trg_wiener_spin_ad_activity_v54','trg_wiener_spin_withdraw_insert_v54','trg_wiener_spin_withdraw_update_v54')"
node --check "$BACKEND"
curl -fsS http://127.0.0.1:3000/health >/dev/null

echo '=== V55 READY ==='
echo 'Spin activity now writes transactions.kind=spin when that column exists.'
echo 'Any future admin-activity logging failure is isolated and cannot fail a user spin, ad credit, or Spin TON withdrawal.'
echo 'Frontend/UI files are not touched by V55.'
