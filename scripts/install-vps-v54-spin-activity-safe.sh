#!/usr/bin/env bash
set -euo pipefail

cd /opt/wiener-code
DB=wiener_farm_final
BACKEND=/opt/wiener-backend/server.mjs

echo '=== V54 SPIN ACTIVITY AUDIT ==='

# V53 is the authoritative secure Spin TON /pay integration. Install/verify it first.
bash scripts/install-vps-v53-spin-pay-unified-safe.sh

[[ -f "$BACKEND" ]] || { echo 'ERROR: backend server.mjs not found' >&2; exit 1; }
node --check "$BACKEND"

echo '=== INSTALL DATABASE-LEVEL SPIN ACTIVITY LOGGING ==='
runuser -u postgres -- psql -d "$DB" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
  IF to_regclass('public.transactions') IS NULL THEN
    RAISE EXCEPTION 'public.transactions table is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='transactions' AND column_name='telegram_id'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='transactions' AND column_name='amount'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='transactions' AND column_name='description'
  ) THEN
    RAISE EXCEPTION 'public.transactions is missing telegram_id/amount/description columns';
  END IF;
END $$;

create table if not exists public.wiener_spin_activity(
  id bigserial primary key,
  telegram_id bigint not null,
  event_type text not null,
  reference_type text not null,
  reference_id text not null,
  amount numeric(24,9) not null default 0,
  asset text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(reference_type,reference_id,event_type)
);
create index if not exists wiener_spin_activity_user_created_idx
  on public.wiener_spin_activity(telegram_id,created_at desc);

create or replace function public.log_wiener_spin_event_activity_v54()
returns trigger language plpgsql as $$
declare
  d text;
  a numeric := 0;
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

  if found then
    insert into public.transactions(telegram_id,amount,description)
    values(new.telegram_id,a,d);
  end if;
  return new;
end $$;

drop trigger if exists trg_wiener_spin_event_activity_v54 on public.wiener_spin_events;
create trigger trg_wiener_spin_event_activity_v54
after insert on public.wiener_spin_events
for each row execute function public.log_wiener_spin_event_activity_v54();

create or replace function public.log_wiener_spin_ad_activity_v54()
returns trigger language plpgsql as $$
begin
  if new.status='completed' and old.status is distinct from 'completed' then
    insert into public.wiener_spin_activity(telegram_id,event_type,reference_type,reference_id,amount,asset,details)
    values(new.telegram_id,'ad_spin_credit','spin_ad_session',new.session_id,1,'spin',jsonb_build_object('completed_at',new.completed_at))
    on conflict do nothing;
    if found then
      insert into public.transactions(telegram_id,amount,description)
      values(new.telegram_id,0,'🎡 Spin ad completed: +1 spin');
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_wiener_spin_ad_activity_v54 on public.wiener_spin_ad_sessions;
create trigger trg_wiener_spin_ad_activity_v54
after update of status on public.wiener_spin_ad_sessions
for each row execute function public.log_wiener_spin_ad_activity_v54();

create or replace function public.log_wiener_spin_withdraw_activity_v54()
returns trigger language plpgsql as $$
declare
  ev text;
  ref text;
  d text;
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

  if found then
    insert into public.transactions(telegram_id,amount,description)
    values(new.telegram_id,0,d);
  end if;
  return new;
end $$;

drop trigger if exists trg_wiener_spin_withdraw_insert_v54 on public.wiener_spin_withdrawals;
create trigger trg_wiener_spin_withdraw_insert_v54
after insert on public.wiener_spin_withdrawals
for each row execute function public.log_wiener_spin_withdraw_activity_v54();

drop trigger if exists trg_wiener_spin_withdraw_update_v54 on public.wiener_spin_withdrawals;
create trigger trg_wiener_spin_withdraw_update_v54
after update of status on public.wiener_spin_withdrawals
for each row execute function public.log_wiener_spin_withdraw_activity_v54();

-- Keep the dedicated audit table private from PUBLIC.
revoke all on table public.wiener_spin_activity from public;
revoke all on sequence public.wiener_spin_activity_id_seq from public;
SQL

echo '=== VERIFY ==='
runuser -u postgres -- psql -d "$DB" -Atqc "select case when to_regclass('public.wiener_spin_activity') is not null then 'spin_activity_table_ok' else 'spin_activity_table_missing' end"
runuser -u postgres -- psql -d "$DB" -Atqc "select count(*)||' spin_activity_triggers' from pg_trigger where not tgisinternal and tgname in ('trg_wiener_spin_event_activity_v54','trg_wiener_spin_ad_activity_v54','trg_wiener_spin_withdraw_insert_v54','trg_wiener_spin_withdraw_update_v54')"
node --check "$BACKEND"
curl -fsS http://127.0.0.1:3000/health >/dev/null

echo '=== V54 READY ==='
echo 'New Spin rewards, ad-spin credits, and Spin TON withdrawal status changes are now mirrored into public.transactions for admin activity review.'
echo 'A dedicated public.wiener_spin_activity audit table also keeps immutable Spin-specific event details.'
echo 'No balance, reward probability, spin limit, payout amount, or frontend behavior is changed by V54.'
