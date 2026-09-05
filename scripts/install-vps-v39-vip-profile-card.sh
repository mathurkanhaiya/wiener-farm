#!/usr/bin/env bash
set -euo pipefail

cd /opt/wiener-code
git fetch origin main

BACKEND=/opt/wiener-backend/server.mjs
BACKUP=/opt/wiener-backend/server.mjs.pre-v39-profile-card
V35=/tmp/v35b-addtask.py
V36=/tmp/v36-sponsored.py
V37=/tmp/v37-sponsored-mini-app.py
V38=/tmp/v38-fixed-reward.py
V39=/tmp/v39-profile-card.py
V39B64=/tmp/v39-profile-card.b64

git show origin/main:scripts/patch-vps-v35b-addtask-fix.py > "$V35"
git show origin/main:scripts/patch-vps-v36-sponsored-insights.py > "$V36"
git show origin/main:scripts/patch-vps-v37-sponsored-mini-app.py > "$V37"
git show origin/main:scripts/patch-vps-v38-fixed-sponsored-reward.py > "$V38"
: > "$V39B64"
for n in 01 02 03 04 05 06 07 08; do
  git show "origin/main:scripts/v39-profile-card/part-${n}.b64" >> "$V39B64"
done
base64 -d "$V39B64" > "$V39"

python3 -m py_compile "$V35"
python3 -m py_compile "$V36"
python3 -m py_compile "$V37"
python3 -m py_compile "$V38"
python3 -m py_compile "$V39"

cd /opt/wiener-backend
node -e "import('sharp').then(()=>console.log('sharp: ok')).catch(e=>{console.error('sharp missing:',e.message);process.exit(1)})"

cp "$BACKEND" "$BACKUP"

rollback() {
  cp "$BACKUP" "$BACKEND"
  pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
}
trap rollback ERR

if ! grep -q "WIENER ADDTASK V35B" "$BACKEND"; then
  python3 "$V35"
fi
if ! grep -q "WIENER SPONSORED INSIGHTS V36" "$BACKEND"; then
  python3 "$V36"
fi
if ! grep -q "WIENER SPONSORED MINI APP V37" "$BACKEND"; then
  python3 "$V37"
fi
if ! grep -q "WIENER SPONSORED FIXED REWARD V38" "$BACKEND"; then
  python3 "$V38"
fi

python3 "$V39"

node --check "$BACKEND"
grep -q "WIENER VIP PROFILE CARDS V39" "$BACKEND"

runuser -u postgres -- psql -d wiener_farm_final -v ON_ERROR_STOP=1 <<'SQL'
create table if not exists public.wiener_profile_card_preferences(
  telegram_id bigint primary key,
  style text not null default 'red',
  updated_at timestamptz not null default now()
);
SQL

pm2 restart wiener-api --update-env
sleep 2
pm2 save >/dev/null

trap - ERR

echo "=== V39 READY ==="
echo "/profile and /card now create VIP image cards in private chats and groups"
echo "Sticker, refresh, full stats and VIP card styles enabled"
