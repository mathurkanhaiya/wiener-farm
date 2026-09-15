#!/usr/bin/env bash
set -euo pipefail
cd /opt/wiener-code
git fetch origin main
git reset --hard origin/main
runuser -u postgres -- psql -d wiener_farm_final -v ON_ERROR_STOP=1 <<'SQL'
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS public.treasury_v3_accounts(telegram_id BIGINT PRIMARY KEY,points INT NOT NULL DEFAULT 0 CHECK(points>=0 AND points<5),keys INT NOT NULL DEFAULT 0 CHECK(keys>=0),updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.treasury_v3_sessions(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),telegram_id BIGINT NOT NULL,block_id TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN('pending','client_done','credited','expired')),created_at TIMESTAMPTZ NOT NULL DEFAULT now(),client_completed_at TIMESTAMPTZ,credited_at TIMESTAMPTZ,expires_at TIMESTAMPTZ NOT NULL);
CREATE INDEX IF NOT EXISTS treasury_v3_sessions_user_idx ON public.treasury_v3_sessions(telegram_id,created_at DESC);
CREATE TABLE IF NOT EXISTS public.treasury_v3_events(id BIGSERIAL PRIMARY KEY,telegram_id BIGINT NOT NULL,session_id UUID NOT NULL UNIQUE,points INT NOT NULL DEFAULT 1,key_added BOOLEAN NOT NULL DEFAULT false,created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.treasury_v3_opens(id BIGSERIAL PRIMARY KEY,request_id UUID NOT NULL UNIQUE,telegram_id BIGINT NOT NULL,reward INT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS treasury_v3_opens_user_idx ON public.treasury_v3_opens(telegram_id,created_at DESC);
SQL
BACK=/opt/wiener-backend/server.mjs
cp "$BACK" "$BACK.treasury-v3.bak"
python3 - <<'PY'
from pathlib import Path
p=Path('/opt/wiener-backend/server.mjs')
s=p.read_text()
start='// === TREASURY V3 START ==='
end='// === TREASURY V3 END ==='
if start in s:
 a=s.index(start); b=s.index(end,a)+len(end); s=s[:a]+s[b:]
route=Path('/opt/wiener-code/scripts/treasury-v3-route.mjs').read_text()
route=route.replace("import crypto from 'node:crypto';","const crypto = await import('node:crypto');")
s += '\n'+start+'\n'+route+'\n'+end+'\n'
p.write_text(s)
PY
pm2 restart wiener-api --update-env
pm2 save
npm ci
npm run build
printf '\nTreasury V3 installed. AdsGram block 45064 Reward URL:\nhttps://api.viralaitools.xyz/treasury-v3-reward?userId=[userId]\n'
