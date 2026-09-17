#!/usr/bin/env bash
set -euo pipefail
cd /opt/wiener-code
DB=wiener_farm_final
BACKEND=/opt/wiener-backend/server.mjs
[[ -f "$BACKEND" ]] || BACKEND=/opt/wiener-backend/server.js
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${BACKEND}.bak-v111-${STAMP}"
echo '=== V111 STRICT MAIN ADSGRAM REWARD FIX ==='
[[ -f "$BACKEND" ]] || { echo 'ERROR: backend missing' >&2; exit 1; }
node --check "$BACKEND"
runuser -u postgres -- psql -d "$DB" -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE IF NOT EXISTS public.main_ad_reward_v109(
 session_id text PRIMARY KEY, telegram_id bigint NOT NULL, interacted boolean NOT NULL DEFAULT false,
 interaction_ms integer NOT NULL DEFAULT 0, original_reward numeric NOT NULL DEFAULT 0,
 base_reward numeric NOT NULL, bonus_reward numeric NOT NULL DEFAULT 0, final_reward numeric NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS main_ad_reward_v109_user_idx ON public.main_ad_reward_v109(telegram_id,created_at DESC);
SQL
cp -a "$BACKEND" "$BACKUP"
rollback(){ echo 'ERROR: restoring V111 backup' >&2; cp -a "$BACKUP" "$BACKEND"; node --check "$BACKEND" >/dev/null 2>&1 && pm2 restart wiener-api --update-env >/dev/null 2>&1 || true; }
trap rollback ERR
cat >/tmp/v111-main-ad-backend.py <<'PY'
from pathlib import Path
p=Path('/opt/wiener-backend/server.mjs')
if not p.exists(): p=Path('/opt/wiener-backend/server.js')
s=p.read_text()
# Idempotent cleanup: V109 may never have been deployed on this VPS.
start=s.find('// === WIENER MAIN AD UP TO 20 V109 ===')
end=s.find('// === END WIENER MAIN AD UP TO 20 V109 ===')
if start>=0 and end>=0:
 end += len('// === END WIENER MAIN AD UP TO 20 V109 ===')
 s=s[:start]+s[end:]
s=s.replace("app.use('/functions/v1/wiener-ad',mainAdRewardV109());\n",'')
# Replace an earlier V111 block too, so reruns are safe.
a=s.find('// === WIENER MAIN AD STRICT DYNAMIC V111 ===')
b=s.find('// === END WIENER MAIN AD STRICT DYNAMIC V111 ===')
if a>=0 and b>=0:
 b += len('// === END WIENER MAIN AD STRICT DYNAMIC V111 ===')
 s=s[:a]+s[b:]
s=s.replace("app.use('/functions/v1/wiener-ad',mainAdStrictV111());\n",'')
anchor="app.post('/functions/v1/wiener-ad'"
if anchor not in s: raise SystemExit('ERROR: wiener-ad route anchor missing; refusing unsafe patch')
code=r'''
// === WIENER MAIN AD STRICT DYNAMIC V111 ===
function mainAdStrictV111(){
 return async function(req,res,next){
  if(String(req.body?.action||'')!=='complete')return next();
  let id; try{({id}=await edgeUser(req.body||{}))}catch{return next()}
  const sid=String(req.body?.session_id||'').slice(0,160); if(!sid)return next();
  const interactionMs=Math.max(0,Math.min(120000,Math.floor(Number(req.body?.interaction_ms||0))));
  const visibilityQualified=req.body?.interacted===true && interactionMs>=3000;
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
      target.reward=Number(old.final_reward);target.full_reward=Number(old.original_reward);target.configured_reward=Number(old.original_reward);target.base_reward=Number(old.final_reward);target.bonus_reward=Math.max(0,Number(old.original_reward)-Number(old.final_reward));target.bonus_unlocked=!!old.interacted;target.interaction_detected=!!old.interacted;return originalJson(payload)
     }
     const configured=Math.max(0,Number(target.reward||0));
     if(!(configured>0)){await c.query('rollback');return originalJson(payload)}
     let finalReward=configured;
     if(!visibilityQualified){
      const min=configured*.30,max=configured*.60;
      if(Number.isInteger(configured)){
       const lo=Math.max(0,Math.ceil(min)),hi=Math.max(lo,Math.floor(max));
       finalReward=lo+crypto.randomInt(0,hi-lo+1);
      }else finalReward=Math.round((min+Math.random()*(max-min))*1000)/1000;
     }
     finalReward=Math.min(configured,Math.max(0,finalReward));
     const delta=finalReward-configured;
     await c.query(`insert into public.main_ad_reward_v109(session_id,telegram_id,interacted,interaction_ms,original_reward,base_reward,bonus_reward,final_reward) values($1,$2,$3,$4,$5,$6,$7,$8)`,[sid,id,visibilityQualified,interactionMs,configured,finalReward,Math.max(0,configured-finalReward),finalReward]);
     if(delta!==0){
      await c.query(`update public.users set balance=coalesce(balance,0)+$2,total_earned=greatest(0,coalesce(total_earned,0)+$2) where telegram_id=$1`,[id,delta]);
      await c.query(`insert into public.transactions(telegram_id,type,amount,description) values($1,'ad_reward_adjustment',$2,$3)`,[id,delta,`Main AdsGram V111 final reward ${finalReward} / full ${configured}`]).catch(()=>{});
     }
     await c.query('commit');
     target.reward=finalReward;target.full_reward=configured;target.configured_reward=configured;target.base_reward=finalReward;target.bonus_reward=Math.max(0,configured-finalReward);target.bonus_unlocked=visibilityQualified;target.interaction_detected=visibilityQualified;
     return originalJson(payload);
    }catch(e){await c.query('rollback').catch(()=>{});console.error('v111_main_ad',String(e?.message||e));return originalJson(payload)}finally{c.release()}
   })();
  }; return next();
 }
}
// === END WIENER MAIN AD STRICT DYNAMIC V111 ===
'''
pos=s.index(anchor)
s=s[:pos]+code+"\napp.use('/functions/v1/wiener-ad',mainAdStrictV111());\n"+s[pos:]
p.write_text(s)
print('V111 strict backend installed')
PY
python3 /tmp/v111-main-ad-backend.py
node --check "$BACKEND"
npm run build
npm run typecheck
pm2 restart wiener-api --update-env
sleep 3
curl -fsS http://127.0.0.1:3000/health || curl -fsS http://127.0.0.1:3000/
echo
pm2 save >/dev/null
grep -q 'WIENER MAIN AD STRICT DYNAMIC V111' "$BACKEND"
grep -q 'allowBlur:false,minBlurMs:3000' src/AdsPage.tsx
grep -q 'HOW TO GET FULL REWARD' src/AdsPage.tsx
! grep -q 'mainAdRewardV109' "$BACKEND"
echo 'normal=30-60% of admin reward'
echo 'full=100% only after successful callback + >=3s strict visibility loss'
echo 'popup=proof UI installed'
echo '=== V111 VERIFIED ==='
trap - ERR
