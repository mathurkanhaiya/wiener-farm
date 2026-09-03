#!/usr/bin/env bash
set -euo pipefail
cd /opt/wiener-code
BACKEND=/opt/wiener-backend/server.mjs
STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP="${BACKEND}.v22-${STAMP}.bak"
cp -a "$BACKEND" "$BACKUP"
rollback(){
  rc=$?
  if [ "$rc" -ne 0 ]; then
    echo 'ERROR: V22 install failed; restoring working backend backup.' >&2
    cp -a "$BACKUP" "$BACKEND"
    node --check "$BACKEND" >/dev/null 2>&1 || true
    pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
  fi
  exit "$rc"
}
trap rollback EXIT

echo '=== VERIFY CURRENT BACKEND ==='
node --check "$BACKEND"
grep -Fq 'WIENER VPS SUPABASE ADMIN PARITY V19' "$BACKEND" || { echo 'ERROR: V19 admin parity missing' >&2; exit 1; }

echo '=== WITHDRAWAL ARCHIVE AUDIT COLUMNS ==='
runuser -u postgres -- psql -d wiener_farm_final -v ON_ERROR_STOP=1 <<'SQL'
alter table public.withdrawals add column if not exists admin_archived boolean not null default false;
alter table public.withdrawals add column if not exists admin_archived_at timestamptz;
alter table public.withdrawals add column if not exists admin_archived_by bigint;
alter table public.withdrawals add column if not exists admin_archive_reason text;
create index if not exists withdrawals_admin_archived_idx on public.withdrawals(admin_archived,created_at desc);
SQL

echo '=== INSTALL SILENT ARCHIVE CONTROL ==='
python3 scripts/patch-vps-v22-withdraw-archive.py

echo '=== PRE-RESTART SAFETY GATE ==='
node --check "$BACKEND"
grep -Fq 'WIENER VPS SILENT WITHDRAW ARCHIVE V22' "$BACKEND"
grep -Fq 'reject_withdrawal_v2' "$BACKEND"
grep -Fq 'withdrawal_payout_already_started' "$BACKEND"
grep -Fq '/functions/v1/wiener-withdraw-archive' "$BACKEND"

echo '=== RESTART VPS API/BOT ==='
pm2 restart wiener-api --update-env
pm2 save
sleep 2
code=$(curl -sS -o /tmp/v22-archive.out -w '%{http_code}' -X POST -H 'content-type: application/json' -d '{}' http://127.0.0.1:3000/functions/v1/wiener-withdraw-archive || true)
echo "wiener-withdraw-archive -> HTTP $code"
[[ "$code" != "000" && "$code" != "404" && "$code" != "502" ]] || { echo 'ERROR: archive route smoke failed' >&2; exit 1; }

pending=$(runuser -u postgres -- psql -d wiener_farm_final -Atqc "select count(*) from public.withdrawals where status='pending'")
echo "pending_withdrawals=$pending"
echo '=== V22 SILENT WITHDRAW ARCHIVE INSTALLED ==='
echo 'Use: /archivewithdraw <withdrawal ID or unique prefix>'
echo 'Archived requests leave Pending without a user Telegram notification.'
echo 'The existing rejection/refund path is reused; financial and audit history remain preserved.'
echo 'Any withdrawal with a payout already in flight is refused.'
echo 'No withdrawal was modified by this installer.'
trap - EXIT
