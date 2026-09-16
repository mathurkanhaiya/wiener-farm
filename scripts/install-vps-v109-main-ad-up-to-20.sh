#!/usr/bin/env bash
set -euo pipefail

cd /opt/wiener-code
DB=wiener_farm_final
BACKEND=/opt/wiener-backend/server.mjs
[[ -f "$BACKEND" ]] || BACKEND=/opt/wiener-backend/server.js
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${BACKEND}.bak-v109-${STAMP}"

echo '=== V109 MAIN ADSGRAM UP-TO-20 INSTALL ==='
[[ -f "$BACKEND" ]] || { echo 'ERROR: backend server not found' >&2; exit 1; }
node --check "$BACKEND"

runuser -u postgres -- psql -d "$DB" -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
CREATE TABLE IF NOT EXISTS public.main_ad_reward_v109(
  session_id text PRIMARY KEY,
  telegram_id bigint NOT NULL,
  interacted boolean NOT NULL DEFAULT false,
  interaction_ms integer NOT NULL DEFAULT 0,
  original_reward numeric NOT NULL DEFAULT 0,
  base_reward numeric NOT NULL,
  bonus_reward numeric NOT NULL DEFAULT 0,
  final_reward numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS main_ad_reward_v109_user_idx
  ON public.main_ad_reward_v109(telegram_id,created_at DESC);
COMMIT;
SQL

cp -a "$BACKEND" "$BACKUP"
rollback(){
  echo 'ERROR: V109 failed; restoring backend.' >&2
  cp -a "$BACKUP" "$BACKEND"
  node --check "$BACKEND" >/dev/null 2>&1 && pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
}
trap rollback ERR

cat >/tmp/patch-v109-main-ad.py <<'PY'
from pathlib import Path
p=Path('/opt/wiener-backend/server.mjs')
if not p.exists(): p=Path('/opt/wiener-backend/server.js')
s=p.read_text()
marker='// === WIENER MAIN AD UP TO 20 V109 ==='
if marker in s:
    print('V109 backend already installed')
    raise SystemExit(0)
anchor="app.post('/functions/v1/wiener-ad'"
if anchor not in s:
    raise SystemExit('ERROR: main wiener-ad route anchor missing; refusing unsafe patch')
helper=r'''
// === WIENER MAIN AD UP TO 20 V109 ===
// The existing wiener-ad route still owns ad validation, daily limits, session
// crediting and anti-abuse. This middleware only replaces the credited amount
// after a successful completion, once per session.
function weightedRewardV109(interacted){
  const pool=interacted
    ? [12,12,13,13,14,14,15,15,16,16,17,18,19,20]
    : [5,5,5,5,6,6,6,6,7,7,7,8,8,9,10];
  return pool[crypto.randomInt(0,pool.length)];
}
function mainAdRewardV109(){
 return async function(req,res,next){
  if(String(req.body?.action||'')!=='complete')return next();
  let id;
  try{({id}=await edgeUser(req.body||{}))}catch{return next()}
  const sid=String(req.body?.session_id||'').slice(0,160);
  if(!sid)return next();
  const interactionMs=Math.max(0,Math.min(120000,Math.floor(Number(req.body?.interaction_ms||0))));
  // AdsGram does not expose a publisher CTA-click callback. 3s visibility loss
  // is therefore treated as engagement eligibility, never stored as a claimed click.
  const interacted=req.body?.interacted===true && interactionMs>=3000;
  const originalJson=res.json.bind(res);
  res.json=function(payload){
   const target=payload&&payload.data&&typeof payload.data==='object'?payload.data:payload;
   if(!payload||payload.ok!==true||!target||String(target.status||'')!=='credited')return originalJson(payload);
   return (async()=>{
    const c=await pool.connect();
    try{
      await c.query('begin');
      const old=(await c.query(`select * from public.main_ad_reward_v109 where session_id=$1 for update`,[sid])).rows[0];
      if(old){
        await c.query('commit');
        target.reward=Number(old.final_reward);
        target.base_reward=Number(old.base_reward);
        target.bonus_reward=Number(old.bonus_reward);
        target.bonus_unlocked=Number(old.bonus_reward)>0;
        target.interaction_detected=!!old.interacted;
        return originalJson(payload);
      }
      const original=Math.max(0,Number(target.reward||0));
      const finalReward=weightedRewardV109(interacted);
      const baseReward=interacted ? Math.min(finalReward,Math.max(5,Math.min(10,Math.round(original)||7))) : finalReward;
      const bonusReward=interacted ? Math.max(0,finalReward-baseReward) : 0;
      const delta=finalReward-original;
      await c.query(`insert into public.main_ad_reward_v109(session_id,telegram_id,interacted,interaction_ms,original_reward,base_reward,bonus_reward,final_reward) values($1,$2,$3,$4,$5,$6,$7,$8)`,[sid,id,interacted,interactionMs,original,baseReward,bonusReward,finalReward]);
      if(delta!==0){
        await c.query(`update public.users set balance=coalesce(balance,0)+$2,total_earned=greatest(0,coalesce(total_earned,0)+$2) where telegram_id=$1`,[id,delta]);
        await c.query(`insert into public.transactions(telegram_id,type,amount,description) values($1,'ad_reward_adjustment',$2,$3)`,[id,delta,`Main AdsGram V109 final reward ${finalReward}`]).catch(()=>{});
      }
      await c.query('commit');
      target.reward=finalReward;
      target.base_reward=baseReward;
      target.bonus_reward=bonusReward;
      target.bonus_unlocked=bonusReward>0;
      target.interaction_detected=interacted;
      return originalJson(payload);
    }catch(e){
      await c.query('rollback').catch(()=>{});
      console.error('v109_main_ad_reward',String(e?.message||e));
      // Fail safe: preserve the already-credited original reward.
      return originalJson(payload);
    }finally{c.release()}
   })();
  };
  return next();
 }
}
// === END WIENER MAIN AD UP TO 20 V109 ===

'''
pos=s.index(anchor)
s=s[:pos]+helper+"app.use('/functions/v1/wiener-ad',mainAdRewardV109());\n"+s[pos:]
p.write_text(s)
print('V109 backend reward middleware installed')
PY

python3 /tmp/patch-v109-main-ad.py
node --check "$BACKEND"

# Build now applies the V109 frontend after V102, so V102 cannot strip it again.
npm run build
pm2 restart wiener-api --update-env
sleep 3
curl -fsS http://127.0.0.1:3000/health || curl -fsS http://127.0.0.1:3000/
echo
pm2 save >/dev/null

echo '=== VERIFY ==='
grep -q 'WIENER MAIN AD UP TO 20 V109' "$BACKEND"
grep -q 'prebuild-v109-main-ad-up-to-20.mjs' package.json
runuser -u postgres -- psql -d "$DB" -Atqc "select 'v109_reward_table='||case when to_regclass('public.main_ad_reward_v109') is not null then 'ok' else 'missing' end"
echo 'normal_reward=5-10'
echo 'engagement_eligible_reward=12-20'
echo 'visibility_threshold=3s'
echo 'daily_limit=existing main AdsGram limit unchanged'
echo '=== V109 READY ==='
trap - ERR
