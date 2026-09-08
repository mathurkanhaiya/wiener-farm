#!/usr/bin/env bash
set -euo pipefail

cd /opt/wiener-code
DB=wiener_farm_final
BACKEND=/opt/wiener-backend/server.mjs
PATCH=scripts/patch-vps-v78-advanced-broadcast-center.py
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${BACKEND}.pre-v78-broadcast-${STAMP}.bak"

echo '=== V78 ADVANCED BROADCAST CENTER SAFE INSTALL ==='
[[ -f "$BACKEND" ]] || { echo 'ERROR: /opt/wiener-backend/server.mjs not found' >&2; exit 1; }
[[ -f "$PATCH" ]] || { echo "ERROR: $PATCH not found" >&2; exit 1; }
cp -a "$BACKEND" "$BACKUP"

echo '=== DATABASE MIGRATION (ADDITIVE ONLY) ==='
runuser -u postgres -- psql -d "$DB" -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.admin_broadcast_sessions ADD COLUMN IF NOT EXISTS audience_v78 text NOT NULL DEFAULT 'all';
ALTER TABLE public.admin_broadcast_sessions ADD COLUMN IF NOT EXISTS filter_v78 text;
ALTER TABLE public.admin_broadcast_sessions ADD COLUMN IF NOT EXISTS broadcast_id_v78 uuid;
ALTER TABLE public.admin_broadcast_sessions ADD COLUMN IF NOT EXISTS button_text_v78 text;

ALTER TABLE public.admin_broadcasts ADD COLUMN IF NOT EXISTS media_kind text;
ALTER TABLE public.admin_broadcasts ADD COLUMN IF NOT EXISTS source_chat_id bigint;
ALTER TABLE public.admin_broadcasts ADD COLUMN IF NOT EXISTS source_message_id bigint;
ALTER TABLE public.admin_broadcasts ADD COLUMN IF NOT EXISTS private_targets integer NOT NULL DEFAULT 0;
ALTER TABLE public.admin_broadcasts ADD COLUMN IF NOT EXISTS group_targets integer NOT NULL DEFAULT 0;
ALTER TABLE public.admin_broadcasts ADD COLUMN IF NOT EXISTS channel_targets integer NOT NULL DEFAULT 0;

ALTER TABLE public.admin_broadcast_deliveries ADD COLUMN IF NOT EXISTS chat_type text;
ALTER TABLE public.admin_broadcast_deliveries ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;
ALTER TABLE public.admin_broadcast_deliveries ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz;

CREATE TABLE IF NOT EXISTS public.admin_broadcast_jobs_v78 (
  broadcast_id uuid PRIMARY KEY REFERENCES public.admin_broadcasts(id) ON DELETE CASCADE,
  admin_id bigint NOT NULL,
  state text NOT NULL DEFAULT 'preparing' CHECK (state IN ('preparing','scheduled','sending','paused','completed','failed','cancelled')),
  audience text NOT NULL DEFAULT 'all',
  filter_key text,
  media_kind text,
  source_chat_id bigint,
  source_message_id bigint,
  buttons jsonb NOT NULL DEFAULT '[]'::jsonb,
  scheduled_at timestamptz,
  paused_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_broadcast_deliveries_v78 (
  broadcast_id uuid NOT NULL REFERENCES public.admin_broadcasts(id) ON DELETE CASCADE,
  telegram_id bigint NOT NULL,
  chat_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','skipped')),
  attempts integer NOT NULL DEFAULT 0,
  error text,
  telegram_message_id bigint,
  last_attempt_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (broadcast_id, telegram_id)
);

CREATE INDEX IF NOT EXISTS admin_broadcast_jobs_v78_state_idx
  ON public.admin_broadcast_jobs_v78(state, scheduled_at, updated_at);
CREATE INDEX IF NOT EXISTS admin_broadcast_deliveries_v78_status_idx
  ON public.admin_broadcast_deliveries_v78(broadcast_id, status);

-- A V57 media session can remain stuck forever because it never created a tracked
-- broadcast row. Safely clear only stale media_sending sessions older than 10 min.
UPDATE public.admin_broadcast_sessions
SET step='idle', source_chat_id=NULL, source_message_id=NULL, media_kind=NULL, updated_at=now()
WHERE step='media_sending' AND updated_at < now()-interval '10 minutes';
COMMIT;
SQL

echo '=== BACKEND PATCH ==='
if ! python3 "$PATCH"; then
  cp -a "$BACKUP" "$BACKEND"
  echo 'ERROR: V78 patch failed; backend restored' >&2
  exit 1
fi

if ! python3 -m py_compile "$PATCH"; then
  cp -a "$BACKUP" "$BACKEND"
  echo 'ERROR: patch script validation failed; backend restored' >&2
  exit 1
fi

if ! node --check "$BACKEND"; then
  cp -a "$BACKUP" "$BACKEND"
  echo 'ERROR: Node syntax check failed; backend restored' >&2
  exit 1
fi

for needle in \
  'WIENER ADVANCED BROADCAST CENTER V78' \
  'broadcastStart78' \
  'bc78:status:' \
  'admin_broadcast_jobs_v78' \
  'admin_broadcast_deliveries_v78'; do
  if ! grep -q "$needle" "$BACKEND"; then
    cp -a "$BACKUP" "$BACKEND"
    echo "ERROR: verification marker missing: $needle; backend restored" >&2
    exit 1
  fi
done

echo '=== RESTART ==='
pm2 restart wiener-api
sleep 2
if ! curl -fsS http://127.0.0.1:3000/health; then
  echo
  echo 'ERROR: health check failed; restoring backend' >&2
  cp -a "$BACKUP" "$BACKEND"
  pm2 restart wiener-api
  sleep 2
  curl -fsS http://127.0.0.1:3000/health || true
  exit 1
fi

echo
echo '=== DATABASE VERIFY ==='
runuser -u postgres -- psql -d "$DB" -P pager=off -c "
select
  (select count(*) from information_schema.tables where table_schema='public' and table_name='admin_broadcast_jobs_v78') as jobs_table,
  (select count(*) from information_schema.tables where table_schema='public' and table_name='admin_broadcast_deliveries_v78') as deliveries_table,
  (select count(*) from information_schema.columns where table_schema='public' and table_name='admin_broadcast_sessions' and column_name in ('audience_v78','filter_v78','broadcast_id_v78','button_text_v78')) as session_columns;
"

echo '=== BOT TARGET POOL ==='
runuser -u postgres -- psql -d "$DB" -P pager=off -c "
select 'private' target_type,count(*)::bigint targets from public.users where is_banned=false
union all
select 'groups',count(*) from public.bot_chats where active=true and can_post=true and chat_type in ('group','supergroup')
union all
select 'channels',count(*) from public.bot_chats where active=true and can_post=true and chat_type='channel';
"

pm2 save >/dev/null 2>&1 || true

echo
echo '=== V78 ADVANCED BROADCAST CENTER READY ==='
echo 'Admin commands:'
echo '  /broadcast'
echo '  /broadcast_status'
echo '  /broadcast_history'
echo '  /broadcast_retry'
echo '  /broadcast_cancel'
echo '  /broadcast_test'
echo '  /broadcast_cleanup'
echo
echo 'V78 records text/media broadcasts before delivery starts, freezes exact targets,'
echo 'shows private/group/channel counts, supports custom targeting, preview, URL buttons,'
echo 'test delivery, scheduling, pause/resume/stop, failed-only retry, and safe dead-chat cleanup.'
