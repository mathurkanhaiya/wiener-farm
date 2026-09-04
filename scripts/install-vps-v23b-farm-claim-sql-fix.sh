#!/usr/bin/env bash
set -Eeuo pipefail
DB=wiener_farm_final

echo '=== REPAIR V23 FARM COUNTER TRIGGER ==='
runuser -u postgres -- psql -d "$DB" -v ON_ERROR_STOP=1 <<'SQL'
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

  select least(5,count(*)::int)
    into v_count
    from public.transactions t
   where t.telegram_id=new.telegram_id
     and (t.created_at at time zone 'UTC')::date=v_day
     and public.is_wiener_farm_reward(t.kind,t.description,t.amount);

  update public.users
     set farm_claims_today = greatest(
           case
             when left(coalesce(farm_claims_day::text,''),10)=v_day::text
             then coalesce(farm_claims_today,0)
             else 0
           end,
           greatest(0,coalesce(v_count,0))
         ),
         farm_claims_day = v_day
   where telegram_id=new.telegram_id;

  return new;
end
$$;
SQL

echo '=== FUNCTION COMPILE + TRIGGER CHECK ==='
runuser -u postgres -- psql -d "$DB" -P pager=off -c "
select tgname, tgenabled
from pg_trigger
where tgrelid='public.transactions'::regclass
  and tgname='trg_sync_wiener_farm_cycle_counter';
"

echo '=== V23B FARM CLAIM SQL FIX INSTALLED ==='
echo 'Dynamic date SQL removed.'
echo 'Farm claim transaction trigger now uses parameter-safe static SQL.'
echo 'No balances or rewards were modified.'
