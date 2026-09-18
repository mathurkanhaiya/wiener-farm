#!/usr/bin/env bash
set -euo pipefail
cd /opt/wiener-code
BACKEND=/opt/wiener-backend/server.mjs
[[ -f "$BACKEND" ]] || BACKEND=/opt/wiener-backend/server.js
BACKUP="${BACKEND}.before-v116-$(date +%Y%m%d-%H%M%S)"
cp -a "$BACKEND" "$BACKUP"

echo "[V116] Creating admin GRAM send ledger..."
runuser -u postgres -- psql -d wiener_farm_final -v ON_ERROR_STOP=1 <<'SQL'
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS public.admin_gram_sends(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_telegram_id bigint NOT NULL,
  chat_id bigint NOT NULL,
  source_message_id bigint,
  amount_gram numeric(30,9) NOT NULL CHECK(amount_gram>0),
  wallet_address text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending','sending','sent','cancelled','expired','review')),
  tx_hash text,
  explorer_url text,
  error text,
  expires_at timestamptz NOT NULL,
  confirmed_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_gram_sends_admin_created_idx
  ON public.admin_gram_sends(admin_telegram_id,created_at DESC);
ALTER TABLE public.admin_gram_sends OWNER TO wiener_app;
GRANT SELECT,INSERT,UPDATE ON public.admin_gram_sends TO wiener_app;
SQL

WIENER_BACKEND_FILE="$BACKEND" python3 scripts/patch-vps-v116-admin-gram-send.py
node --check "$BACKEND"

if [[ -z "${WIENER_GRAM_SEND_URL:-}" ]]; then
  echo
  echo "NOTE: command/confirm flow is installed, but on-chain sending needs WIENER_GRAM_SEND_URL in PM2 env."
  echo "The endpoint must accept {payment_id,asset:'GRAM',network:'TON',amount,address} and return {ok:true,tx_hash,explorer_url?}."
  echo "Do NOT put a mnemonic/private key in this script or Git."
fi

pm2 restart wiener-api --update-env
sleep 2
curl --max-time 10 -fsS http://127.0.0.1:3000/health
echo
echo "V116 active."
echo "Webhook route: /functions/v1/wiener-telegram-admin-webhook-v116"
echo "Commands: /send <amount> gram <address> OR reply /send <amount> gram"
