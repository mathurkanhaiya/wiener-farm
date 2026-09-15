#!/usr/bin/env bash
set -euo pipefail
cd /opt/wiener-code
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/opt/wiener-code-v108-backup-$STAMP"
cp -a /opt/wiener-code "$BACKUP"
echo "Backup: $BACKUP"

git fetch origin admin-v108-safe-upgrade
git checkout -B admin-v108-safe-upgrade origin/admin-v108-safe-upgrade
npm ci
npm run build

echo "Build passed. Installing frontend only; backend server.mjs is untouched."
[[ -d dist && -f dist/index.html ]] || { echo "dist missing"; exit 1; }
RELEASE="/opt/wiener-app/releases/${STAMP}-v108-admin"
mkdir -p "$RELEASE"
cp -a dist/. "$RELEASE/"
ln -sfn "$RELEASE" /opt/wiener-app/current
nginx -t
systemctl reload nginx

echo "V108 ADMIN LIVE"
echo "Backend unchanged and should remain running."
pm2 status wiener-api || true
