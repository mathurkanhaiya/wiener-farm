#!/usr/bin/env bash
set -Eeuo pipefail

CODE=/opt/wiener-code
SERVER=/opt/wiener-backend/server.mjs
[ -f "$SERVER" ] || SERVER=/opt/wiener-backend/server.js
[ -f "$SERVER" ] || { echo 'ERROR: backend file not found'; exit 1; }

cd "$CODE"
STAMP=$(date +%Y%m%d-%H%M%S)
cp -a "$SERVER" "$SERVER.before-v86-$STAMP"

echo '=== V86 DATABASE ==='
runuser -u postgres -- psql -d wiener_farm_final -v ON_ERROR_STOP=1 <<'SQL'
create table if not exists public.wiener_ad_leagues(
  week_start date primary key,
  week_end date not null,
  status text not null default 'active' check(status in ('active','completed','paused')),
  prize_pool numeric not null default 50000,
  daily_target int not null default 10,
  daily_bonus int not null default 5,
  streak_bonus int not null default 25,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  finalized_at timestamptz
);

create table if not exists public.wiener_ad_league_events(
  id bigserial primary key,
  week_start date not null,
  telegram_id bigint not null,
  source text not null,
  session_key text not null,
  event_day date not null default ((now() at time zone 'utc')::date),
  created_at timestamptz not null default now(),
  unique(source,session_key)
);
create index if not exists wiener_ad_league_events_week_user_idx on public.wiener_ad_league_events(week_start,telegram_id);
create index if not exists wiener_ad_league_events_day_idx on public.wiener_ad_league_events(week_start,event_day,telegram_id);

create table if not exists public.wiener_ad_league_rewards(
  week_start date not null,
  telegram_id bigint not null,
  rank int not null,
  points int not null,
  prize numeric not null,
  status text not null default 'credited',
  credited_at timestamptz,
  primary key(week_start,telegram_id)
);

create or replace function public.wiener_ad_league_capture_v86()
returns trigger language plpgsql as $$
declare
  j jsonb:=to_jsonb(new);
  uid bigint;
  sk text;
  st text;
  credited boolean:=false;
  wk date;
  src text:=tg_table_name;
begin
  begin
    uid:=nullif(coalesce(j->>'telegram_id',j->>'user_id',j->>'uid'),'')::bigint;
  exception when others then uid:=null; end;
  sk:=nullif(coalesce(j->>'session_id',j->>'id',j->>'request_id',j->>'nonce'),'');
  st:=lower(coalesce(j->>'status',''));
  credited := st in ('credited','completed','complete','rewarded','paid','success')
              or nullif(j->>'credited_at','') is not null
              or nullif(j->>'rewarded_at','') is not null;
  if uid is null or sk is null or not credited then return new; end if;
  if exists(select 1 from public.users u where u.telegram_id=uid and coalesce(u.is_banned,false)=true) then return new; end if;
  wk := ((now() at time zone 'utc')::date - (((extract(dow from now() at time zone 'utc')::int + 6) % 7)));
  insert into public.wiener_ad_leagues(week_start,week_end,status,prize_pool,daily_target,daily_bonus,streak_bonus,enabled)
  values(wk,wk+7,'active',50000,10,5,25,true) on conflict(week_start) do nothing;
  if not coalesce((select enabled from public.wiener_ad_leagues where week_start=wk),true) then return new; end if;
  insert into public.wiener_ad_league_events(week_start,telegram_id,source,session_key,event_day)
  values(wk,uid,src,sk,(now() at time zone 'utc')::date)
  on conflict(source,session_key) do nothing;
  return new;
end $$;

-- Main AdsGram rewarded sessions.
do $$ begin
  if to_regclass('public.ad_sessions') is not null then
    execute 'drop trigger if exists wiener_ad_league_v86 on public.ad_sessions';
    execute 'create trigger wiener_ad_league_v86 after insert or update on public.ad_sessions for each row execute function public.wiener_ad_league_capture_v86()';
  end if;
end $$;

-- Bonus rewarded ads. This table is used when present; harmlessly skipped otherwise.
do $$ begin
  if to_regclass('public.promo_ad_sessions') is not null then
    execute 'drop trigger if exists wiener_ad_league_v86 on public.promo_ad_sessions';
    execute 'create trigger wiener_ad_league_v86 after insert or update on public.promo_ad_sessions for each row execute function public.wiener_ad_league_capture_v86()';
  end if;
end $$;
SQL

echo '=== V86 BACKEND ROUTE ==='
WIENER_BACKEND_FILE="$SERVER" python3 scripts/patch-vps-v86-ad-league.py
node --check "$SERVER"
pm2 restart wiener-api --update-env >/dev/null
pm2 save >/dev/null
sleep 2
curl -fsS http://127.0.0.1:3000/health; echo

echo '=== VERIFY V86 ==='
runuser -u postgres -- psql -d wiener_farm_final -P pager=off -c "select week_start,week_end,status,prize_pool,daily_target,daily_bonus,streak_bonus,enabled from public.wiener_ad_leagues order by week_start desc limit 3;"
runuser -u postgres -- psql -d wiener_farm_final -P pager=off -c "select event_object_table,trigger_name from information_schema.triggers where trigger_name='wiener_ad_league_v86' order by event_object_table;"
echo '=== V86 WEEKLY AD LEAGUE INSTALLED ==='
