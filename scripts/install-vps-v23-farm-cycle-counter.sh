#!/usr/bin/env bash
set -Eeuo pipefail

DB=wiener_farm_final

echo '=== FARM CYCLE COUNTER PRECHECK ==='
runuser -u postgres -- psql -d "$DB" -v ON_ERROR_STOP=1 <<'SQL'
do $$
begin
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='users' and column_name='farm_claims_today') then
    raise exception 'users.farm_claims_today missing';
  end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='users' and column_name='farm_claims_day') then
    raise exception 'users.farm_claims_day missing';
  end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='transactions' and column_name='telegram_id') then
    raise exception 'transactions.telegram_id missing';
  end if;
end $$;
SQL

echo '=== INSTALL LEDGER -> FARM COUNTER SELF-HEAL ==='
runuser -u postgres -- psql -d "$DB" -v ON_ERROR_STOP=1 <<'SQL'
create or replace function public.is_wiener_farm_reward(p_kind text,p_description text,p_amount numeric)
returns boolean
language sql
immutable
as $$
  select coalesce(p_amount,0)>0 and (
    lower(coalesce(p_kind,'')) in ('farm_claim','farm_reward','farming_reward')
    or (lower(coalesce(p_kind,'')) like 'farm_%' and lower(coalesce(p_kind,'')) like '%reward%')
    or lower(trim(coalesce(p_description,''))) in ('farming reward','farm reward','wiener farming reward')
  )
$$;

create or replace function public.sync_wiener_farm_cycle_counter()
returns trigger
language plpgsql
as $$
declare
  v_day date;
  v_count integer;
begin
  if not public.is_wiener_farm_reward(new.kind,new.description,new.amount) then
    return new;
  end if;

  v_day := (coalesce(new.created_at,now()) at time zone 'UTC')::date;

  select count(*)::int
    into v_count
    from public.transactions t
   where t.telegram_id=new.telegram_id
     and (t.created_at at time zone 'UTC')::date=v_day
     and public.is_wiener_farm_reward(t.kind,t.description,t.amount);

  v_count := least(5,greatest(0,coalesce(v_count,0)));

  execute format(
    'update public.users
        set farm_claims_day=%L,
            farm_claims_today=greatest(
              case when left(coalesce(farm_claims_day::text,''),10)=%L
                   then coalesce(farm_claims_today,0) else 0 end,
              $2
            )
      where telegram_id=$1',
    v_day::text,v_day::text
  ) using new.telegram_id,v_count;

  return new;
end
$$;

drop trigger if exists trg_sync_wiener_farm_cycle_counter on public.transactions;
create trigger trg_sync_wiener_farm_cycle_counter
after insert on public.transactions
for each row execute function public.sync_wiener_farm_cycle_counter();
SQL

echo '=== BACKFILL TODAY FROM AUTHORITATIVE TRANSACTION LEDGER ==='
runuser -u postgres -- psql -d "$DB" -v ON_ERROR_STOP=1 <<'SQL'
do $$
declare
  v_day date := (now() at time zone 'UTC')::date;
begin
  execute format($q$
    with counts as (
      select telegram_id,least(5,count(*)::int) as c
        from public.transactions
       where (created_at at time zone 'UTC')::date=%L
         and public.is_wiener_farm_reward(kind,description,amount)
       group by telegram_id
    )
    update public.users u
       set farm_claims_day=%L,
           farm_claims_today=c.c
      from counts c
     where c.telegram_id=u.telegram_id
       and (
         left(coalesce(u.farm_claims_day::text,''),10)<>%L
         or coalesce(u.farm_claims_today,0)<>c.c
       )
  $q$,v_day::text,v_day::text,v_day::text);
end $$;
SQL

echo '=== VERIFY TODAY COUNTERS ==='
runuser -u postgres -- psql -d "$DB" -P pager=off -c "
with ledger as (
  select telegram_id,least(5,count(*)::int) c
  from public.transactions
  where (created_at at time zone 'UTC')::date=(now() at time zone 'UTC')::date
    and public.is_wiener_farm_reward(kind,description,amount)
  group by telegram_id
)
select
  count(*) filter(where l.c>0) as users_with_farm_cycles_today,
  count(*) filter(where coalesce(u.farm_claims_today,0)<>l.c or left(coalesce(u.farm_claims_day::text,''),10)<>(now() at time zone 'UTC')::date::text) as mismatches_after_fix
from ledger l join public.users u using(telegram_id);
"

echo '=== FARM CYCLE COUNTER FIX INSTALLED ==='
echo 'UI reads the greater of stored counter and today farming-reward ledger count.'
echo 'Database now reconciles the stored counter after every farming reward.'
echo 'No balances, withdrawals, payouts, or reward amounts were modified.'
