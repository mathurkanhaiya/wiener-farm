#!/usr/bin/env bash
set -euo pipefail

cd /opt/wiener-code
DB=wiener_farm_final
BACKEND=/opt/wiener-backend/server.mjs
[[ -f "$BACKEND" ]] || BACKEND=/opt/wiener-backend/server.js
[[ -f "$BACKEND" ]] || { echo 'ERROR: Wiener backend not found' >&2; exit 1; }
STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP="${BACKEND}.pre-v79b-owner-fix-${STAMP}.bak"

echo '=== FETCH V79B OWNER FIX ==='
git fetch origin main
git show origin/main:scripts/patch-vps-v79b-gram-quest-owner-fix.py > /tmp/v79b-owner.py
python3 -m py_compile /tmp/v79b-owner.py
cp -a "$BACKEND" "$BACKUP"

rollback(){
  echo 'ERROR: V79B failed; restoring backend.' >&2
  cp -a "$BACKUP" "$BACKEND"
  pm2 restart wiener-api >/dev/null 2>&1 || true
}
trap rollback ERR

# Ensure schema exists with the actual DB owner/superuser, never from app runtime.
runuser -u postgres -- psql -d "$DB" -v ON_ERROR_STOP=1 <<'SQL'
alter table public.app_settings add column if not exists gram_quest_enabled boolean not null default true;
alter table public.app_settings add column if not exists gram_quest_required_ads integer not null default 50;
alter table public.app_settings add column if not exists gram_quest_reward numeric(24,9) not null default 0.03;
update public.app_settings set gram_quest_enabled=true,gram_quest_required_ads=50,gram_quest_reward=0.03 where id=true;
create table if not exists public.wiener_gram_daily_quest_claims(
  telegram_id bigint not null references public.users(telegram_id) on delete cascade,
  quest_day date not null,
  verified_main_ads integer not null,
  reward_gram numeric(24,9) not null,
  claimed_at timestamptz not null default now(),
  primary key(telegram_id,quest_day)
);
create index if not exists wiener_gram_daily_quest_claims_day_idx on public.wiener_gram_daily_quest_claims(quest_day,claimed_at desc);
SQL

WIENER_BACKEND_FILE="$BACKEND" python3 /tmp/v79b-owner.py
node --check "$BACKEND"
grep -Fq 'WIENER DAILY GRAM QUEST V79B OWNER FIX' "$BACKEND"

pm2 restart wiener-api
sleep 2
curl -fsS http://127.0.0.1:3000/health >/dev/null
pm2 save >/dev/null 2>&1 || true
trap - ERR

echo '=== VERIFY ==='
runuser -u postgres -- psql -d "$DB" -P pager=off -c "select gram_quest_enabled,gram_quest_required_ads,gram_quest_reward from public.app_settings where id=true;"
echo '=== V79B OWNER ERROR FIXED ==='
echo 'Runtime no longer ALTERs app_settings.'
