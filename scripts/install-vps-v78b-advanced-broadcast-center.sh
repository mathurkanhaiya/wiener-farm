#!/usr/bin/env bash
set -euo pipefail

cd /opt/wiener-code

echo '=== FETCH V78B ADVANCED BROADCAST CENTER ==='
git fetch origin main
mkdir -p scripts
git show origin/main:scripts/patch-vps-v78-advanced-broadcast-center.py > scripts/patch-vps-v78-advanced-broadcast-center.py
git show origin/main:scripts/install-vps-v78-advanced-broadcast-center.sh > /tmp/v78-base.sh
git show origin/main:scripts/patch-vps-v78b-broadcast-hardening.py > /tmp/v78b-hardening.py
chmod +x /tmp/v78-base.sh

# The base installer is additive, takes its own backend backup, migrates the DB,
# syntax-checks the result, restarts wiener-api and verifies health.
bash /tmp/v78-base.sh

echo
echo '=== V78B HARDENING ==='
BACKEND=/opt/wiener-backend/server.mjs
BACKUP="${BACKEND}.pre-v78b-hardening-$(date +%Y%m%d-%H%M%S).bak"
cp -a "$BACKEND" "$BACKUP"

if ! python3 /tmp/v78b-hardening.py; then
  cp -a "$BACKUP" "$BACKEND"
  echo 'ERROR: V78B hardening failed; restored post-V78 backend' >&2
  exit 1
fi

if ! python3 -m py_compile /tmp/v78b-hardening.py; then
  cp -a "$BACKUP" "$BACKEND"
  echo 'ERROR: V78B Python validation failed; restored post-V78 backend' >&2
  exit 1
fi

if ! node --check "$BACKEND"; then
  cp -a "$BACKUP" "$BACKEND"
  echo 'ERROR: V78B Node syntax check failed; restored post-V78 backend' >&2
  exit 1
fi

grep -q 'WIENER ADVANCED BROADCAST CENTER V78B HARDENING' "$BACKEND" || {
  cp -a "$BACKUP" "$BACKEND"
  echo 'ERROR: V78B marker missing; restored post-V78 backend' >&2
  exit 1
}

pm2 restart wiener-api
sleep 2
if ! curl -fsS http://127.0.0.1:3000/health; then
  echo
  echo 'ERROR: health failed after V78B; restoring post-V78 backend' >&2
  cp -a "$BACKUP" "$BACKEND"
  pm2 restart wiener-api
  sleep 2
  curl -fsS http://127.0.0.1:3000/health || true
  exit 1
fi
pm2 save >/dev/null 2>&1 || true

echo
echo '=== V78B LIVE DATABASE CHECK ==='
runuser -u postgres -- psql -d wiener_farm_final -P pager=off <<'SQL'
select
  (select count(*) from public.users where is_banned=false) as private_users,
  (select count(*) from public.bot_chats where active=true and can_post=true and chat_type in ('group','supergroup')) as groups,
  (select count(*) from public.bot_chats where active=true and can_post=true and chat_type='channel') as channels;

select admin_id,step,media_kind,updated_at
from public.admin_broadcast_sessions
where admin_id=2139807311;
SQL

echo
echo '=== V78B ADVANCED BROADCAST CENTER READY ==='
echo 'Use /broadcast in the admin bot.'
echo 'Other commands: /broadcast_status /broadcast_history /broadcast_retry /broadcast_cancel /broadcast_test /broadcast_cleanup'
echo 'Text/photo/video/GIF/sticker/document are tracked before delivery starts.'
echo 'Exact private/group/channel targets are frozen at preview time.'
echo 'Supports preview, URL buttons, test send, scheduling, pause/resume/stop, failed-only retry, and safe dead-chat cleanup.'
