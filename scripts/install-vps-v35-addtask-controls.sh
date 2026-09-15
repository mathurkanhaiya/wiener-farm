#!/usr/bin/env bash
set -euo pipefail
cd /opt/wiener-code
git fetch origin main
git show origin/main:scripts/patch-vps-v35-addtask-controls.py > /tmp/v35-addtask.py
python3 -m py_compile /tmp/v35-addtask.py
cp /opt/wiener-backend/server.mjs /opt/wiener-backend/server.mjs.pre-v35-addtask
python3 /tmp/v35-addtask.py
node --check /opt/wiener-backend/server.mjs
pm2 restart wiener-api --update-env
sleep 2
pm2 save >/dev/null
echo '=== V35 READY ==='
echo '/addtask buttons fixed + clean Task Studio'
