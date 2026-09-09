#!/usr/bin/env bash
set -euo pipefail

cd /opt/wiener-code
DB=wiener_farm_final
BACKEND=/opt/wiener-backend/server.mjs
[[ -f "$BACKEND" ]] || BACKEND=/opt/wiener-backend/server.js
[[ -f "$BACKEND" ]] || { echo 'ERROR: Wiener backend not found' >&2; exit 1; }
STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP="${BACKEND}.pre-v80-limited-gram-${STAMP}.bak"

echo '=== FETCH V80 LIMITED GRAM TASK ==='
git fetch origin main
git show origin/main:scripts/patch-vps-v80-limited-gram-task.py > /tmp/v80-limited-gram.py
python3 -m py_compile /tmp/v80-limited-gram.py
node --check "$BACKEND"
cp -a "$BACKEND" "$BACKUP"

rollback(){
  echo 'ERROR: V80 install failed; restoring backend.' >&2
  cp -a "$BACKUP" "$BACKEND"
  pm2 restart wiener-api >/dev/null 2>&1 || true
}
trap rollback ERR

echo '=== DATABASE ==='
runuser -u postgres -- psql -d "$DB" -v ON_ERROR_STOP=1 <<'SQL'
create table if not exists public.wiener_limited_gram_tasks(
  telegram_id bigint primary key references public.users(telegram_id) on delete cascade,
  task1_ads integer not null default 0,
  task2_ads integer not null default 0,
  claimed boolean not null default false,
  withdrawal_id bigint references public.wiener_spin_withdrawals(id) on delete set null,
  claimed_at timestamptz,
  updated_at timestamptz not null default now()
);
create table if not exists public.wiener_limited_gram_sessions(
  session_id text primary key,
  telegram_id bigint not null references public.users(telegram_id) on delete cascade,
  task_no integer not null check(task_no in (1,2)),
  status text not null default 'started',
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists wiener_limited_gram_sessions_user_idx on public.wiener_limited_gram_sessions(telegram_id,created_at desc);

-- Give the same application roles that already use public.users access to the new task tables.
do $$
declare r record;
begin
  for r in select distinct grantee from information_schema.role_table_grants where table_schema='public' and table_name='users' and privilege_type in ('SELECT','UPDATE','INSERT') and grantee not in ('postgres','PUBLIC') loop
    execute format('grant select,insert,update,delete on public.wiener_limited_gram_tasks to %I',r.grantee);
    execute format('grant select,insert,update,delete on public.wiener_limited_gram_sessions to %I',r.grantee);
  end loop;
end $$;
SQL

WIENER_BACKEND_FILE="$BACKEND" python3 /tmp/v80-limited-gram.py
node --check "$BACKEND"
grep -Fq 'WIENER LIMITED GRAM TASK V80' "$BACKEND"
pm2 restart wiener-api
sleep 2
curl -fsS http://127.0.0.1:3000/health >/dev/null
pm2 save >/dev/null 2>&1 || true
trap - ERR

echo '=== V80 LIVE CHECK ==='
runuser -u postgres -- psql -d "$DB" -P pager=off -c "select count(*) as users_started,count(*) filter(where claimed) as claimed from public.wiener_limited_gram_tasks;"
echo '=== V80 LIMITED GRAM TASK READY ==='
echo 'Task 1: 35 ads = 0.015 GRAM share'
echo 'Task 2: 35 ads = 0.015 GRAM share'
echo 'Both complete -> confirm -> 0.03 GRAM pending withdrawal request'
