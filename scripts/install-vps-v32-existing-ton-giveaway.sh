#!/usr/bin/env bash
set -Eeuo pipefail

CODE=/opt/wiener-code
BACKEND=/opt/wiener-backend
SERVER="$BACKEND/server.mjs"
[ -f "$SERVER" ] || SERVER="$BACKEND/server.js"
export WIENER_BACKEND_FILE="$SERVER"

STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP="$SERVER.v32-$STAMP.bak"

rollback(){
  rc=$?
  echo "V32 failed; restoring backend." >&2
  cp -f "$BACKUP" "$SERVER" 2>/dev/null || true
  pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
  exit "$rc"
}
trap rollback ERR

cd "$CODE"
cp "$SERVER" "$BACKUP"

git fetch origin main
git show origin/main:scripts/patch-vps-v32-existing-ton-giveaway.py > /tmp/wiener-v32.py

echo "=== DATABASE ==="
runuser -u postgres -- psql -d wiener_farm_final -v ON_ERROR_STOP=1 <<'SQL'
create table if not exists public.wiener_external_giveaways(
  id text primary key,
  public_id text not null unique,
  admin_id bigint not null,
  source_chat_id bigint not null,
  source_chat_username text,
  source_message_id bigint not null,
  source_post_url text not null,
  discussion_chat_id bigint not null,
  winner_count integer not null default 3,
  prize_ton numeric(20,9) not null default 0.05,
  reaction_target integer not null default 50,
  reaction_count integer not null default 0,
  target_confirmed_at timestamptz,
  status text not null default 'collecting',
  payout_state text not null default 'not_started',
  signer_lock_id text not null,
  draw_seed text,
  snapshot_hash text,
  entry_count integer,
  payout_seqno bigint,
  payout_submitted_at timestamptz,
  payout_tx_hash text,
  payout_explorer_url text,
  payout_error text,
  imported_at timestamptz not null default now(),
  drawn_at timestamptz,
  paid_at timestamptz,
  announced_at timestamptz,
  announcement_message_id bigint,
  updated_at timestamptz not null default now(),
  unique(source_chat_id,source_message_id)
);

create table if not exists public.wiener_external_giveaway_entries(
  id bigserial primary key,
  giveaway_id text not null,
  telegram_id bigint not null,
  username text,
  wallet text not null,
  wallet_key text not null,
  source_chat_id bigint,
  source_message_id bigint,
  source text not null default 'comment',
  eligible boolean not null default true,
  created_at timestamptz not null default now(),
  unique(giveaway_id,telegram_id),
  unique(giveaway_id,wallet_key)
);

create table if not exists public.wiener_external_giveaway_winners(
  id bigserial primary key,
  giveaway_id text not null,
  entry_id bigint not null,
  draw_rank integer not null,
  winner_slot integer,
  kind text not null,
  telegram_id bigint not null,
  username text,
  wallet text not null,
  wallet_key text not null,
  prize_ton numeric(20,9) not null,
  payout_status text not null,
  seqno bigint,
  submitted_at timestamptz,
  tx_hash text,
  explorer_url text,
  confirmed_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  unique(giveaway_id,draw_rank),
  unique(giveaway_id,telegram_id),
  unique(giveaway_id,wallet_key),
  unique(giveaway_id,winner_slot)
);

create index if not exists idx_wiener_ext_giveaway_discussion
  on public.wiener_external_giveaways(discussion_chat_id,status);
create index if not exists idx_wiener_ext_giveaway_entries
  on public.wiener_external_giveaway_entries(giveaway_id,created_at);
create index if not exists idx_wiener_ext_giveaway_winners
  on public.wiener_external_giveaway_winners(giveaway_id,kind,draw_rank);
SQL

echo "=== PATCH BACKEND ==="
python3 -m py_compile /tmp/wiener-v32.py
python3 /tmp/wiener-v32.py
node --check "$SERVER"
grep -q "WIENER EXISTING TON GIVEAWAY V32" "$SERVER"
grep -q "gvHandle32" "$SERVER"
grep -q "wiener-giveaway-sync-v32" "$SERVER"

echo "=== RESTART ==="
pm2 restart wiener-api --update-env
sleep 3

if ! ss -ltn | grep -q '127.0.0.1:3000'; then
  echo "Backend is not listening on 127.0.0.1:3000" >&2
  exit 1
fi

echo "=== ENABLE REACTION UPDATES ==="
SECRET=$(runuser -u postgres -- psql -d wiener_farm_final -tA -c "select coalesce(telegram_webhook_secret,'') from public.app_settings where id=true limit 1")
if [ -n "$SECRET" ]; then
  code=$(curl -sS -o /tmp/v32-sync.json -w '%{http_code}' \
    -X POST \
    -H "content-type: application/json" \
    -H "x-wiener-internal-secret: $SECRET" \
    --data '{}' \
    http://127.0.0.1:3000/functions/v1/wiener-giveaway-sync-v32 || true)
  echo "Webhook sync HTTP $code"
  cat /tmp/v32-sync.json 2>/dev/null || true
else
  echo "WARNING: telegram_webhook_secret unavailable; reaction count updates were not re-subscribed."
  echo "The giveaway can still use the admin CONFIRM 50 REACTIONS button."
fi

pm2 save >/dev/null

echo
echo "=== V32 READY ==="
echo "Import the already-posted giveaway:"
echo "/giveaway_import https://t.me/WienerFarm/POST_ID"
echo
echo "New wallet comments are captured automatically."
echo "For an old comment missed before V32: reply to that comment with /giveaway_add"
echo "Then use /giveaway_status to draw and pay."
trap - ERR
