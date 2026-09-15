#!/usr/bin/env bash
set -euo pipefail

cd /opt/wiener-code
git fetch origin main

BACKEND=/opt/wiener-backend/server.mjs
if [ ! -f "$BACKEND" ] && [ -f /opt/wiener-backend/server.js ]; then
  BACKEND=/opt/wiener-backend/server.js
fi

if ! grep -q "WIENER SPONSORED FIXED REWARD V38" "$BACKEND"; then
  git show origin/main:scripts/install-vps-v38-fixed-sponsored-reward.sh > /tmp/v38.sh
  bash /tmp/v38.sh
fi

V39=/tmp/v39-profile.py
V40=/tmp/v40-profile.py
MODULE=/opt/wiener-backend/profile-v39.mjs
BACKUP="$BACKEND.pre-v40-profile"

git show origin/main:scripts/patch-vps-v39-vip-profile-card.py > "$V39"
git show origin/main:scripts/patch-vps-v40-profile-experience.py > "$V40"
git show origin/main:scripts/v40-profile-module.mjs > "$MODULE"

python3 -m py_compile "$V39"
python3 -m py_compile "$V40"

cp "$BACKEND" "$BACKUP"

rollback() {
  cp "$BACKUP" "$BACKEND"
  pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
}
trap rollback ERR

if ! grep -q "WIENER VIP PROFILE CARD V39" "$BACKEND"; then
  WIENER_BACKEND_FILE="$BACKEND" python3 "$V39"
fi
WIENER_BACKEND_FILE="$BACKEND" python3 "$V40"

node --check "$BACKEND"
node --check "$MODULE"
grep -q "WIENER VIP PROFILE EXPERIENCE V40" "$BACKEND"

runuser -u postgres -- psql -d wiener_farm_final -v ON_ERROR_STOP=1 <<'SQL'
create table if not exists public.wiener_profile_card_preferences(
  telegram_id bigint primary key,
  style text not null default 'auto',
  updated_at timestamptz not null default now()
);
alter table public.wiener_profile_card_preferences
  alter column style set default 'auto';

create table if not exists public.wiener_profile_card_verifications(
  id bigserial primary key,
  card_code text not null unique,
  telegram_id bigint not null,
  generated_by bigint not null,
  theme text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_wiener_profile_card_verify_uid
  on public.wiener_profile_card_verifications(telegram_id,created_at desc);
SQL

cd /opt/wiener-backend
if ! node -e "import('sharp').then(()=>process.exit(0)).catch(()=>process.exit(1))"; then
  npm install --no-save sharp
fi

pm2 restart wiener-api --update-env
sleep 2
pm2 save >/dev/null

trap - ERR

echo "=== V40 READY ==="
echo "/profile works for self, reply, @username or UID"
echo "Themes + VIP progress + achievements + weekly rank + verified cards enabled"
