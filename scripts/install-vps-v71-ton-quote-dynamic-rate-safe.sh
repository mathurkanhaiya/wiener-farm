#!/usr/bin/env bash
set -euo pipefail

DB=wiener_farm_final
FUNC=public.request_ton_withdrawal
BACKUP="/opt/wiener-backend/request_ton_withdrawal.v71.$(date +%Y%m%d%H%M%S).sql"

RATE=$(runuser -u postgres -- psql -d "$DB" -Atqc "select token_per_usdt from public.app_settings where id=true limit 1" 2>/dev/null || true)
echo "Current DB token_per_usdt: ${RATE:-unknown}"

runuser -u postgres -- psql -d "$DB" -Atqc "select pg_get_functiondef('public.request_ton_withdrawal(bigint,numeric,numeric,numeric,text)'::regprocedure)" > "$BACKUP"

runuser -u postgres -- psql -d "$DB" -v ON_ERROR_STOP=1 <<'SQL'
DO $do$
DECLARE
  ddl text;
  before_ddl text;
BEGIN
  SELECT pg_get_functiondef('public.request_ton_withdrawal(bigint,numeric,numeric,numeric,text)'::regprocedure)
    INTO before_ddl;

  ddl := before_ddl;
  ddl := replace(
    ddl,
    'v_expected_usd:=round((p_amount_wiener/15000.0)::numeric,8);',
    'if coalesce(v_settings.token_per_usdt,0)<=0 then raise exception ''invalid_token_per_usdt''; end if; v_expected_usd:=round((p_amount_wiener/v_settings.token_per_usdt)::numeric,8);'
  );
  ddl := replace(
    ddl,
    '''wiener_per_usdt'',15000',
    '''wiener_per_usdt'',v_settings.token_per_usdt'
  );

  IF ddl = before_ddl THEN
    IF before_ddl LIKE '%p_amount_wiener/v_settings.token_per_usdt%' AND before_ddl LIKE '%''wiener_per_usdt'',v_settings.token_per_usdt%' THEN
      RAISE NOTICE 'Dynamic TON quote rate patch already present';
      RETURN;
    END IF;
    RAISE EXCEPTION 'Expected hardcoded TON quote fragments not found; refusing unsafe patch';
  END IF;

  EXECUTE ddl;
END
$do$;
SQL

DEF=$(runuser -u postgres -- psql -d "$DB" -Atqc "select pg_get_functiondef('public.request_ton_withdrawal(bigint,numeric,numeric,numeric,text)'::regprocedure)")

if printf '%s' "$DEF" | grep -q "p_amount_wiener/15000"; then
  echo "Hardcoded TON quote conversion still present. Restore from: $BACKUP" >&2
  exit 1
fi
if printf '%s' "$DEF" | grep -q "'wiener_per_usdt',15000"; then
  echo "Hardcoded TON metadata rate still present. Restore from: $BACKUP" >&2
  exit 1
fi
if ! printf '%s' "$DEF" | grep -q "p_amount_wiener/v_settings.token_per_usdt"; then
  echo "Dynamic TON quote calculation missing. Restore from: $BACKUP" >&2
  exit 1
fi

if pm2 describe wiener-api >/dev/null 2>&1; then
  pm2 restart wiener-api --update-env >/dev/null
  pm2 save >/dev/null
else
  echo "PM2 process wiener-api not found; database function is patched but backend restart was not performed." >&2
  exit 1
fi

sleep 2
RESP=$(curl -sS -X POST -H 'Content-Type: application/json' -d '{}' http://127.0.0.1:3000/functions/v1/wiener-ton-wallet || true)
echo "TON route check: $RESP"
if ! printf '%s' "$RESP" | grep -q 'telegram_required'; then
  echo "Unexpected TON route response; inspect backend before testing withdrawals." >&2
  exit 1
fi

echo
echo "=== V71 READY ==="
echo "TON quote validation now follows live app_settings.token_per_usdt."
echo "Security validation remains enabled; only the hardcoded 15000 rate was removed."
echo "Function backup: $BACKUP"
