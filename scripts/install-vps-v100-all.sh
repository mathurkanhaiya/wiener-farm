#!/usr/bin/env bash
set -Eeuo pipefail
cd /opt/wiener-code

echo '=== V100 backend + database ==='
bash scripts/install-vps-v100-security-hardening.sh

echo '=== V100 anti-stacking indexes ==='
runuser -u postgres -- psql -v ON_ERROR_STOP=1 -d wiener_farm_final <<'SQL'
BEGIN;
WITH r AS (SELECT id,row_number() over(partition by telegram_id order by started_at desc,id desc) n FROM public.ad_sessions WHERE network='adsgram' AND status IN('started','verified')) UPDATE public.ad_sessions a SET status='expired' FROM r WHERE a.id=r.id AND r.n>1;
CREATE UNIQUE INDEX IF NOT EXISTS ad_sessions_one_open_adsgram_user_v100 ON public.ad_sessions(telegram_id) WHERE network='adsgram' AND status IN('started','verified');
WITH r AS (SELECT id,row_number() over(partition by telegram_id,widget_id order by started_at desc,id desc) n FROM public.tads_ad_sessions WHERE status='started') UPDATE public.tads_ad_sessions a SET status='expired' FROM r WHERE a.id=r.id AND r.n>1;
CREATE UNIQUE INDEX IF NOT EXISTS tads_one_open_user_widget_v100 ON public.tads_ad_sessions(telegram_id,widget_id) WHERE status='started';
COMMIT;
SQL

echo '=== V100 frontend ==='
python3 scripts/patch-frontend-v100-security.py
npm run build

# Commit only the intended V100 frontend files; leave unrelated local changes alone.
git add src/AdsPage.tsx src/SpinEarn.tsx src/TasksPage.tsx
if ! git diff --cached --quiet; then
  git commit -m 'V100: enforce server-authorized reward and spin flows'
  git push origin main
else
  echo 'Frontend V100 already applied; nothing to commit.'
fi

echo '=== FINAL HEALTH ==='
node --check /opt/wiener-backend/server.mjs
pm2 restart wiener-api --update-env >/dev/null
sleep 2
curl -fsS http://127.0.0.1:3000/health
echo
echo 'V100 FULL SECURITY ROLLOUT COMPLETE'
