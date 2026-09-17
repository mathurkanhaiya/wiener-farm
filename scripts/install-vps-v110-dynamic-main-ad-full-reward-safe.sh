#!/usr/bin/env bash
set -euo pipefail
cd /opt/wiener-code
DB=wiener_farm_final
BACKEND=/opt/wiener-backend/server.mjs
[[ -f "$BACKEND" ]] || BACKEND=/opt/wiener-backend/server.js
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${BACKEND}.bak-v110-${STAMP}"

echo '=== V110 DYNAMIC MAIN ADSGRAM PARTIAL/FULL REWARD ==='
[[ -f "$BACKEND" ]] || { echo 'ERROR: backend not found' >&2; exit 1; }
node --check "$BACKEND"
grep -q 'WIENER MAIN AD UP TO 20 V109' "$BACKEND" || { echo 'ERROR: V109 backend is not installed. Install V109 first.' >&2; exit 1; }
cp -a "$BACKEND" "$BACKUP"

rollback(){
  echo 'ERROR: V110 failed; restoring backend backup.' >&2
  cp -a "$BACKUP" "$BACKEND"
  node --check "$BACKEND" >/dev/null 2>&1 && pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
}
trap rollback ERR

cat >/tmp/patch-v110-dynamic-main-ad.py <<'PY'
from pathlib import Path
p=Path('/opt/wiener-backend/server.mjs')
if not p.exists(): p=Path('/opt/wiener-backend/server.js')
s=p.read_text()
marker='// === WIENER DYNAMIC MAIN AD FULL REWARD V110 ==='
if marker in s:
    print('V110 backend already installed')
    raise SystemExit(0)
anchor='// === WIENER MAIN AD UP TO 20 V109 ==='
if anchor not in s:
    raise SystemExit('ERROR: V109 anchor missing')

# V110 replaces only V109 reward selection/response semantics. Existing AdsGram
# callback completion, session validation, daily limits and crediting remain intact.
s=s.replace("function weightedRewardV109(interacted){\n  const pool=interacted\n    ? [12,12,13,13,14,14,15,15,16,16,17,18,19,20]\n    : [5,5,5,5,6,6,6,6,7,7,7,8,8,9,10];\n  return pool[crypto.randomInt(0,pool.length)];\n}", r'''function partialRewardV110(fullReward){
  const full=Math.max(0,Number(fullReward||0));
  if(full<=0)return 0;
  // Normal successful watch receives a server-random 30%-60% of the
  // admin-configured reward. Keep useful precision for small rewards.
  const pct=crypto.randomInt(30,61)/100;
  const raw=full*pct;
  const decimals=full<1?4:full<10?2:1;
  const factor=10**decimals;
  return Math.max(0,Math.min(full,Math.round(raw*factor)/factor));
}''')

s=s.replace("// === WIENER MAIN AD UP TO 20 V109 ===", "// === WIENER DYNAMIC MAIN AD FULL REWARD V110 ===\n// Full reward is snapshotted from the existing AdsGram completion reward.\n// A successful callback is always required. Visibility >=3s only selects full vs partial.\n// === WIENER MAIN AD UP TO 20 V109 ===",1)
s=s.replace("const finalReward=weightedRewardV109(interacted);\n      const baseReward=interacted ? Math.min(finalReward,Math.max(5,Math.min(10,Math.round(original)||7))) : finalReward;\n      const bonusReward=interacted ? Math.max(0,finalReward-baseReward) : 0;", "const fullReward=original;\n      const finalReward=interacted ? fullReward : partialRewardV110(fullReward);\n      const baseReward=interacted ? partialRewardV110(fullReward) : finalReward;\n      const bonusReward=interacted ? Math.max(0,fullReward-baseReward) : 0;")
s=s.replace("target.interaction_detected=!!old.interacted;\n        return originalJson(payload);", "target.interaction_detected=!!old.interacted;\n        target.full_reward=Number(old.original_reward);\n        target.configured_reward=Number(old.original_reward);\n        return originalJson(payload);",1)
s=s.replace("target.interaction_detected=interacted;\n      return originalJson(payload);", "target.interaction_detected=interacted;\n      target.full_reward=fullReward;\n      target.configured_reward=fullReward;\n      return originalJson(payload);",1)

p.write_text(s)
print('V110 dynamic reward patch installed')
PY

python3 /tmp/patch-v110-dynamic-main-ad.py
node --check "$BACKEND"

npm run build
pm2 restart wiener-api --update-env
sleep 3
curl -fsS http://127.0.0.1:3000/health || curl -fsS http://127.0.0.1:3000/
echo
pm2 save >/dev/null

echo '=== VERIFY ==='
grep -q 'WIENER DYNAMIC MAIN AD FULL REWARD V110' "$BACKEND"
grep -q 'partialRewardV110' "$BACKEND"
grep -q 'prebuild-v110-dynamic-main-ad-full-reward.mjs' package.json
runuser -u postgres -- psql -d "$DB" -Atqc "select 'reward_table='||case when to_regclass('public.main_ad_reward_v109') is not null then 'ok' else 'missing' end"
echo 'completion_gate=existing AdsGram successful callback'
echo 'normal_reward=random 30%-60% of admin reward'
echo 'full_reward=100% of admin reward after >=3s visibility loss'
echo 'daily_limit=unchanged'
echo '=== V110 READY ==='
trap - ERR
