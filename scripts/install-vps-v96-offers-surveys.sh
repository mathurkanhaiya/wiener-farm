#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=/opt/wiener-code
DB=wiener_farm_final
BACKEND=/opt/wiener-backend/server.mjs
if [[ ! -f "$BACKEND" ]]; then
  PM2_BACKEND="$(pm2 jlist 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{try{const a=JSON.parse(s);const p=a.find(x=>x.name==='wiener-api');process.stdout.write(p?.pm2_env?.pm_exec_path||'')}catch{}})" || true)"
  if [[ -n "$PM2_BACKEND" && -f "$PM2_BACKEND" ]]; then BACKEND="$PM2_BACKEND"; elif [[ -f /opt/wiener-backend/server.js ]]; then BACKEND=/opt/wiener-backend/server.js; fi
fi
export WIENER_BACKEND_FILE="$BACKEND"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${BACKEND}.v96-backup-${STAMP}"

echo '=== V96 OFFERS + SURVEYS PRECHECK ==='
echo "backend_file=$BACKEND"
[[ -f "$BACKEND" ]] || { echo 'ERROR: live backend not found'; exit 1; }
[[ -f "$ROOT/scripts/patch-vps-v96-offers-surveys.py" ]] || { echo 'ERROR: V96 patcher not found'; exit 1; }
node --check "$BACKEND"
cp -a "$BACKEND" "$BACKUP"

rollback(){
  echo 'ERROR: V96 failed; restoring backend backup.'
  cp -a "$BACKUP" "$BACKEND" || true
  node --check "$BACKEND" || true
  pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
}
trap rollback ERR

echo '=== DATABASE TABLES ==='
runuser -u postgres -- psql -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
create table if not exists public.offer_provider_users(
  provider text not null,
  telegram_id bigint not null references public.users(telegram_id) on delete cascade,
  external_uid text not null,
  created_at timestamptz not null default now(),
  primary key(provider,telegram_id),
  unique(provider,external_uid)
);
create table if not exists public.offer_transactions(
  id bigserial primary key,
  telegram_id bigint not null references public.users(telegram_id) on delete cascade,
  provider text not null,
  kind text not null check(kind in ('offer','survey')),
  provider_tx_id text not null,
  provider_offer_id text,
  title text,
  provider_revenue_usd numeric(24,8) not null default 0,
  user_reward_usd numeric(24,8) not null default 0,
  user_reward_wiener numeric(24,4) not null default 0,
  platform_margin_usd numeric(24,8) not null default 0,
  status text not null default 'pending',
  country text,
  raw_callback jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  credited_at timestamptz,
  reversed_at timestamptz,
  unique(provider,provider_tx_id)
);
create index if not exists offer_transactions_user_created_idx on public.offer_transactions(telegram_id,created_at desc);
create index if not exists offer_transactions_provider_status_idx on public.offer_transactions(provider,status,created_at desc);
grant select,insert,update,delete on public.offer_provider_users to wiener_app;
grant select,insert,update,delete on public.offer_transactions to wiener_app;
grant usage,select on sequence public.offer_transactions_id_seq to wiener_app;
SQL

echo '=== PATCH BACKEND ==='
python3 "$ROOT/scripts/patch-vps-v96-offers-surveys.py"
node --check "$BACKEND"
grep -q 'WIENER OFFERS SURVEYS V96' "$BACKEND"
grep -q "/functions/v1/wiener-offers/lootably-callback" "$BACKEND"
grep -q "/functions/v1/wiener-offers/bitlabs-callback" "$BACKEND"

echo '=== RESTART API ==='
pm2 restart wiener-api --update-env
pm2 save >/dev/null
sleep 2
curl -fsS http://127.0.0.1:3000/health
printf '\n'

echo '=== PROVIDER CONFIG STATUS ==='
ENV=/opt/wiener-backend/.env
for key in LOOTABLY_OFFERWALL_URL LOOTABLY_POSTBACK_SECRET BITLABS_APP_TOKEN BITLABS_APP_SECRET; do
  if [[ -f "$ENV" ]] && grep -Eq "^${key}=.+" "$ENV"; then echo "$key=configured"; else echo "$key=missing"; fi
done

trap - ERR
echo '=== V96 READY ==='
echo 'Backend + ledger + signed callback verification installed.'
echo 'Default user share: 70% of verified provider USD revenue.'
echo 'Default conversion: 20,000 WIENER per USD.'
echo 'Provider credentials are required before Offerwall/Surveys can open.'
echo 'Lootably callback: https://api.viralaitools.xyz/functions/v1/wiener-offers/lootably-callback'
echo 'BitLabs callback: https://api.viralaitools.xyz/functions/v1/wiener-offers/bitlabs-callback'
