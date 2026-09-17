#!/usr/bin/env bash
set -euo pipefail
cd /opt/wiener-code

echo '=== V111 STRICT MAIN AD VISIBILITY FIX ==='
git fetch origin main fix/v111-main-ad-visibility-reward
BEFORE="$(git rev-parse HEAD)"
trap 'echo "V111 failed; restoring checkout"; git reset --hard "$BEFORE" >/dev/null 2>&1 || true' ERR

git reset --hard origin/fix/v111-main-ad-visibility-reward

grep -q 'prebuild-v111-main-ad-strict-visibility-popup.mjs' package.json
npm run build

grep -q 'allowBlur:false,minBlurMs:3000' src/AdsPage.tsx
grep -q 'HOW TO GET FULL REWARD' src/AdsPage.tsx

# Backend V110 remains unchanged: AdsGram successful callback is mandatory and
# it trusts only the interaction_ms/visibility-qualified signal supplied by UI.
pm2 restart wiener-api --update-env
sleep 2
curl -fsS http://127.0.0.1:3000/health || curl -fsS http://127.0.0.1:3000/
pm2 save >/dev/null

echo
echo 'full_reward_signal=document visibility/pagehide/freeze only; window blur disabled'
echo 'threshold=3000ms'
echo 'completion_gate=existing AdsGram successful callback'
echo 'popup=v111 clear partial/full instructions'
echo '=== V111 READY ==='
trap - ERR
