#!/usr/bin/env bash
set -euo pipefail

cd /opt/wiener-code
git fetch origin main

if ! grep -q "WIENER SPONSORED FIXED REWARD V38" /opt/wiener-backend/server.mjs; then
  git show origin/main:scripts/install-vps-v38-fixed-sponsored-reward.sh > /tmp/v38.sh
  bash /tmp/v38.sh
fi

BACKEND=/opt/wiener-backend/server.mjs
BACKUP=/opt/wiener-backend/server.mjs.pre-v39-profile
PATCH=/tmp/v39-profile.py
MODULE=/opt/wiener-backend/profile-v39.mjs

git show origin/main:scripts/patch-vps-v39-vip-profile-card.py > "$PATCH"
git show origin/main:scripts/v39-profile-module.mjs > "$MODULE"
python3 -m py_compile "$PATCH"

cp "$BACKEND" "$BACKUP"

rollback() {
  cp "$BACKUP" "$BACKEND"
  pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
}
trap rollback ERR

cd /opt/wiener-backend
if ! node -e "import('sharp').then(()=>process.exit(0)).catch(()=>process.exit(1))"; then
  npm install --no-save sharp
fi

cd /opt/wiener-code
python3 "$PATCH"

node --check "$BACKEND"
node --check "$MODULE"
grep -q "WIENER VIP PROFILE CARD V39" "$BACKEND"

pm2 restart wiener-api --update-env
sleep 2
pm2 save >/dev/null

trap - ERR

echo "=== V39 READY ==="
echo "/profile works in private + groups · VIP image card · sticker · stats"
