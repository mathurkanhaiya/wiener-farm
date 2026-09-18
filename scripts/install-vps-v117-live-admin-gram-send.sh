#!/usr/bin/env bash
set -euo pipefail
cd /opt/wiener-code
BACKEND=/opt/wiener-backend/server.mjs
[[ -f "$BACKEND" ]] || BACKEND=/opt/wiener-backend/server.js
cp -a "$BACKEND" "${BACKEND}.before-v117-$(date +%Y%m%d-%H%M%S)"

# V116 table should already exist, but make deployment self-healing.
runuser -u postgres -- psql -d wiener_farm_final -v ON_ERROR_STOP=1 <<'SQL'
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS public.admin_gram_sends(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_telegram_id bigint NOT NULL,
  chat_id bigint NOT NULL,
  source_message_id bigint,
  amount_gram numeric(30,9) NOT NULL CHECK(amount_gram>0),
  wallet_address text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','cancelled','expired','review')),
  tx_hash text, explorer_url text, error text,
  expires_at timestamptz NOT NULL, confirmed_at timestamptz, sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_gram_sends OWNER TO wiener_app;
GRANT SELECT,INSERT,UPDATE ON public.admin_gram_sends TO wiener_app;
SQL

# Install V116 definitions if this VPS never got them.
if ! grep -q 'WIENER ADMIN GRAM SEND V116' "$BACKEND"; then
  WIENER_BACKEND_FILE="$BACKEND" python3 scripts/patch-vps-v116-admin-gram-send.py
fi
WIENER_BACKEND_FILE="$BACKEND" python3 scripts/patch-vps-v117-live-admin-gram-send.py
node --check "$BACKEND"
pm2 restart wiener-api --update-env
sleep 2
curl --max-time 10 -fsS http://127.0.0.1:3000/health
echo
echo "V117 active. Test: /send 0.001 gram <TON address>"
echo "Or reply to a message containing one TON address with: /send 0.001 gram"
