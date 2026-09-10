#!/usr/bin/env bash
set -Eeuo pipefail
CODE=/opt/wiener-code
SERVER=/opt/wiener-backend/server.mjs
[ -f "$SERVER" ] || SERVER=/opt/wiener-backend/server.js
[ -f "$SERVER" ] || { echo 'ERROR: backend file not found'; exit 1; }
cd "$CODE"
STAMP=$(date +%Y%m%d-%H%M%S)
cp -a "$SERVER" "$SERVER.before-v89-$STAMP"

echo '=== V89 PRECHECK ==='
for x in 'async function handleBotFullV18' 'async function adm18' 'const kb18=' 'const cb18=' 'const web18=' 'const url18=' 'async function st18' 'async function edit18' 'async function answer18' 'async function safeTg18' 'async function register18'; do
  grep -q "$x" "$SERVER" || { echo "ERROR: missing bot helper: $x"; exit 1; }
done

echo '=== V89 DATABASE ==='
runuser -u postgres -- psql -d wiener_farm_final -v ON_ERROR_STOP=1 <<'SQL'
create table if not exists public.giveaway_campaigns (
  id bigserial primary key,
  public_code text not null unique,
  title text not null,
  goal text not null default 'custom',
  mode text not null default 'ticket' check (mode in ('simple','ticket','ranking')),
  asset text not null default 'wiener' check (asset in ('wiener','ton','usdt','custom')),
  prize_pool numeric not null check (prize_pool > 0),
  winners_count int not null check (winners_count between 1 and 100),
  distribution jsonb not null default '[]'::jsonb,
  requirements jsonb not null default '{}'::jsonb,
  ticket_rules jsonb not null default '{}'::jsonb,
  status text not null default 'scheduled' check (status in ('draft','scheduled','live','paused','verifying','completed','cancelled')),
  start_at timestamptz not null,
  end_at timestamptz not null,
  created_by bigint not null,
  publish_channel text default '@WienerFarm',
  announcement_chat_id text,
  announcement_message_id bigint,
  auto_announce boolean not null default true,
  auto_reward boolean not null default true,
  eligible_count int not null default 0,
  total_tickets bigint not null default 0,
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at)
);

create table if not exists public.giveaway_entries (
  giveaway_id bigint not null references public.giveaway_campaigns(id) on delete cascade,
  telegram_id bigint not null,
  tickets int not null default 1 check (tickets between 0 and 10000),
  qualified boolean not null default false,
  qualification_snapshot jsonb not null default '{}'::jsonb,
  disqualified_reason text,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(giveaway_id,telegram_id)
);

create table if not exists public.giveaway_rewards (
  id bigserial primary key,
  giveaway_id bigint not null references public.giveaway_campaigns(id) on delete cascade,
  telegram_id bigint not null,
  position int not null,
  asset text not null,
  amount numeric not null check (amount >= 0),
  status text not null default 'pending_external' check (status in ('pending_external','credited','paid','rejected')),
  tx_hash text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  unique(giveaway_id,telegram_id),
  unique(giveaway_id,position)
);

create table if not exists public.giveaway_admin_sessions (
  admin_id bigint primary key,
  step text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.giveaway_audit (
  id bigserial primary key,
  giveaway_id bigint references public.giveaway_campaigns(id) on delete cascade,
  actor_id bigint,
  event text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists giveaway_campaigns_status_end_idx on public.giveaway_campaigns(status,end_at);
create index if not exists giveaway_entries_user_idx on public.giveaway_entries(telegram_id,updated_at desc);
create index if not exists giveaway_rewards_user_idx on public.giveaway_rewards(telegram_id,created_at desc);
create index if not exists giveaway_audit_campaign_idx on public.giveaway_audit(giveaway_id,created_at desc);

grant select,insert,update,delete on public.giveaway_campaigns,public.giveaway_entries,public.giveaway_rewards,public.giveaway_admin_sessions,public.giveaway_audit to wiener_app;
grant usage,select on all sequences in schema public to wiener_app;
SQL

echo '=== V89 BACKEND ==='
WIENER_BACKEND_FILE="$SERVER" python3 scripts/patch-vps-v89-giveaway-studio.py
node --check "$SERVER"
pm2 restart wiener-api --update-env >/dev/null
pm2 save >/dev/null
sleep 2
curl -fsS http://127.0.0.1:3000/health; echo

echo '=== VERIFY V89 ==='
grep -n 'WIENER GIVEAWAY STUDIO V89' "$SERVER" | head
runuser -u postgres -- psql -d wiener_farm_final -P pager=off -c "select table_name from information_schema.tables where table_schema='public' and table_name like 'giveaway_%' order by table_name;"
runuser -u postgres -- psql -d wiener_farm_final -P pager=off -c "select status,count(*) from public.giveaway_campaigns group by status order by status;"
echo '=== V89 READY: /giveaway studio + verified participation + automatic secure draw + auto results ==='
