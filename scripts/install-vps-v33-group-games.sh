#!/usr/bin/env bash
set -Eeuo pipefail

CODE=/opt/wiener-code
BACKEND=/opt/wiener-backend
SERVER="$BACKEND/server.mjs"
[ -f "$SERVER" ] || SERVER="$BACKEND/server.js"
export WIENER_BACKEND_FILE="$SERVER"

STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP="$SERVER.v33-$STAMP.bak"

rollback(){
  rc=$?
  echo "V33 failed; restoring backend." >&2
  cp -f "$BACKUP" "$SERVER" 2>/dev/null || true
  pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
  exit "$rc"
}
trap rollback ERR

cd "$CODE"
cp "$SERVER" "$BACKUP"

git fetch origin main
git show origin/main:scripts/patch-vps-v33-group-games.py > /tmp/wiener-v33.py

echo "=== DATABASE ==="
runuser -u postgres -- psql -d wiener_farm_final -v ON_ERROR_STOP=1 <<'SQL'
create table if not exists public.wiener_game_settings(
  id boolean primary key default true check(id),
  enabled boolean not null default true,
  min_bet numeric not null default 20,
  max_bet numeric not null default 500,
  pvp_fee_percent numeric not null default 5,
  bot_dice_multiplier numeric not null default 1.80,
  bot_rps_multiplier numeric not null default 1.80,
  bot_ttt_multiplier numeric not null default 1.65,
  challenge_ttl_seconds integer not null default 60,
  action_timeout_seconds integer not null default 45,
  updated_at timestamptz not null default now()
);

insert into public.wiener_game_settings(id)
values(true)
on conflict(id) do nothing;

create table if not exists public.wiener_game_matches(
  id text primary key,
  chat_id bigint not null,
  message_id bigint,
  mode text not null,
  game_type text not null,
  state text not null,
  player1_id bigint not null,
  player1_username text,
  player2_id bigint,
  player2_username text,
  bet numeric not null,
  payout_multiplier numeric,
  player1_action text,
  player2_action text,
  board text not null default '.........',
  current_turn bigint,
  winner_id bigint,
  outcome text,
  result_text text,
  house_fee numeric not null default 0,
  payout numeric not null default 0,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  last_action_at timestamptz not null default now(),
  settled_at timestamptz
);

create index if not exists idx_wiener_games_chat
  on public.wiener_game_matches(chat_id,created_at desc);

create index if not exists idx_wiener_games_player1
  on public.wiener_game_matches(player1_id,state,created_at desc);

create index if not exists idx_wiener_games_player2
  on public.wiener_game_matches(player2_id,state,created_at desc);

create index if not exists idx_wiener_games_winner
  on public.wiener_game_matches(winner_id,state,created_at desc);
SQL

echo "=== PATCH BACKEND ==="
python3 -m py_compile /tmp/wiener-v33.py
python3 /tmp/wiener-v33.py
node --check "$SERVER"

grep -q "WIENER GROUP GAMES V33" "$SERVER"
grep -q "handleGamesV33" "$SERVER"
grep -q "gameStake33" "$SERVER"

echo "=== RESTART ==="
pm2 restart wiener-api --update-env
sleep 3

if ! ss -ltn | grep -q ':3000'; then
  echo "Backend is not listening on port 3000." >&2
  exit 1
fi

echo "=== SYNC BOT COMMANDS ==="
SECRET=$(runuser -u postgres -- psql -d wiener_farm_final -tA -c "select coalesce(telegram_webhook_secret,'') from public.app_settings where id=true limit 1")
if [ -n "$SECRET" ]; then
  code=$(curl -sS -o /tmp/v33-sync.json -w '%{http_code}' \
    -X POST \
    -H "content-type: application/json" \
    -H "x-wiener-internal-secret: $SECRET" \
    --data '{}' \
    http://127.0.0.1:3000/functions/v1/wiener-bot-sync || true)
  echo "Bot sync HTTP $code"
  cat /tmp/v33-sync.json 2>/dev/null || true
else
  echo "WARNING: telegram_webhook_secret unavailable; commands were not re-synced."
fi

echo "=== SETTINGS ==="
runuser -u postgres -- psql -d wiener_farm_final -P pager=off -c "select enabled,min_bet,max_bet,pvp_fee_percent,bot_dice_multiplier,bot_rps_multiplier,bot_ttt_multiplier,challenge_ttl_seconds,action_timeout_seconds from public.wiener_game_settings where id=true;"

pm2 save >/dev/null

echo
echo "=== V33 READY ==="
echo "Group commands:"
echo "/games"
echo "/challenge"
echo "/gamestats"
echo "/gameleaderboard"
echo "/cancelgame"
echo
echo "Games: Dice Duel, Rock Paper Scissors, Tic-Tac-Toe"
echo "Modes: PvP + VS Bot"
echo "Bets: 20 / 50 / 100 / 250 / 500 WIENER"
trap - ERR
