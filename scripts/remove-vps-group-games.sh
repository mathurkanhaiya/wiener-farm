#!/usr/bin/env bash
set -Eeuo pipefail

CODE=/opt/wiener-code
SERVER=/opt/wiener-backend/server.mjs
[ -f "$SERVER" ] || SERVER=/opt/wiener-backend/server.js
export WIENER_BACKEND_FILE="$SERVER"

cd "$CODE"
git fetch origin main
git show origin/main:scripts/remove-vps-group-games.py > /tmp/remove-games.py
python3 -m py_compile /tmp/remove-games.py

STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP="$SERVER.pre-remove-games-$STAMP"
cp "$SERVER" "$BACKUP"

rollback(){
  rc=$?
  cp -f "$BACKUP" "$SERVER" 2>/dev/null || true
  pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
  exit "$rc"
}
trap rollback ERR

echo "=== REFUND ACTIVE GAME STAKES ==="
runuser -u postgres -- psql -d wiener_farm_final -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE
  g record;
  bal numeric;
BEGIN
  IF to_regclass('public.wiener_game_settings') IS NOT NULL THEN
    UPDATE public.wiener_game_settings SET enabled=false,updated_at=now() WHERE id=true;
  END IF;

  IF to_regclass('public.wiener_game_matches') IS NULL THEN
    RETURN;
  END IF;

  FOR g IN
    SELECT * FROM public.wiener_game_matches
    WHERE state IN ('open','active')
    ORDER BY created_at
    FOR UPDATE
  LOOP
    UPDATE public.users
       SET balance=balance+g.bet
     WHERE telegram_id=g.player1_id
     RETURNING balance INTO bal;

    IF FOUND THEN
      INSERT INTO public.transactions(telegram_id,amount,balance_after,kind,description,metadata)
      VALUES(g.player1_id,g.bet,bal,'game_refund','Group games removed · stake refunded',
             jsonb_build_object('match_id',g.id,'reason','group_games_removed'));
    END IF;

    IF g.mode='pvp' AND g.state='active' AND g.player2_id IS NOT NULL AND g.player2_id<>0 THEN
      UPDATE public.users
         SET balance=balance+g.bet
       WHERE telegram_id=g.player2_id
       RETURNING balance INTO bal;

      IF FOUND THEN
        INSERT INTO public.transactions(telegram_id,amount,balance_after,kind,description,metadata)
        VALUES(g.player2_id,g.bet,bal,'game_refund','Group games removed · stake refunded',
               jsonb_build_object('match_id',g.id,'reason','group_games_removed'));
      END IF;
    END IF;

    UPDATE public.wiener_game_matches
       SET state='refunded',
           outcome='games_removed',
           result_text='Group games removed · stake refunded',
           payout=CASE WHEN g.mode='pvp' AND g.state='active' THEN g.bet*2 ELSE g.bet END,
           house_fee=0,
           settled_at=now(),
           last_action_at=now()
     WHERE id=g.id;
  END LOOP;
END $$;
SQL

python3 /tmp/remove-games.py
node --check "$SERVER"

if grep -q "WIENER GROUP GAMES V33" "$SERVER"; then
  echo "ERROR: group game code still present" >&2
  exit 1
fi

pm2 restart wiener-api --update-env
sleep 2

SECRET=$(runuser -u postgres -- psql -d wiener_farm_final -tA -c "select coalesce(telegram_webhook_secret,'') from public.app_settings where id=true limit 1")
if [ -n "$SECRET" ]; then
  curl -sS -X POST     -H "content-type: application/json"     -H "x-wiener-internal-secret: $SECRET"     --data '{}'     http://127.0.0.1:3000/functions/v1/wiener-bot-sync >/tmp/remove-games-sync.json || true
fi

pm2 save >/dev/null
trap - ERR

echo "=== GROUP GAMES REMOVED ==="
echo "V33 Dice / RPS / Tic-Tac-Toe group games removed"
echo "Any open or active game stakes were refunded"
