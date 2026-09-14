#!/usr/bin/env bash
set -euo pipefail
cd /opt/wiener-code
git fetch origin main
git reset --hard origin/main
SERVER=/opt/wiener-backend/server.mjs
[ -f "$SERVER" ] || SERVER=/opt/wiener-backend/server.js
cp "$SERVER" "$SERVER.v103-$(date +%Y%m%d-%H%M%S).bak"
runuser -u postgres -- psql -d wiener_farm_final -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
CREATE TABLE IF NOT EXISTS public.usl_ad_sessions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), telegram_id bigint NOT NULL,
 status text NOT NULL DEFAULT 'started' CHECK(status IN('started','credited','expired','rejected')),
 reward numeric NOT NULL DEFAULT 5, started_at timestamptz NOT NULL DEFAULT now(),
 eligible_at timestamptz NOT NULL, credited_at timestamptz, reward_day date NOT NULL DEFAULT CURRENT_DATE
);
CREATE UNIQUE INDEX IF NOT EXISTS usl_one_open_per_user ON public.usl_ad_sessions(telegram_id) WHERE status='started';
CREATE INDEX IF NOT EXISTS usl_daily_idx ON public.usl_ad_sessions(telegram_id,reward_day,status);
COMMIT;
SQL
python3 - <<'PY'
from pathlib import Path
p=Path('/opt/wiener-backend/server.mjs')
if not p.exists(): p=Path('/opt/wiener-backend/server.js')
s=p.read_text()
marker='// V103 USL ADS SECURE ROUTE'
if marker not in s:
    code=r'''

// V103 USL ADS SECURE ROUTE
app.post('/functions/v1/wiener-usl-ad',async(req,res)=>{
 try{
  const b=req.body||{}, action=String(b.action||'status');
  const auth=await requireTelegram(req,res); if(!auth)return;
  const id=Number(auth.id||auth.telegram_id||0); if(!id)return res.status(401).json({ok:false,error:'telegram_required'});
  if(!['status','start','complete'].includes(action))return res.status(400).json({ok:false,error:'invalid_request'});
  const count=async()=>Number((await pool.query(`select count(*) n from public.usl_ad_sessions where telegram_id=$1 and reward_day=current_date and status='credited'`,[id])).rows[0]?.n||0);
  if(action==='status')return res.json({ok:true,data:{used:await count(),limit:100,reward:5}});
  if(action==='start'){
   if(await count()>=100)return res.status(429).json({ok:false,error:'daily_limit_reached'});
   const old=(await pool.query(`select id,extract(epoch from greatest(eligible_at-now(),interval '0'))::int wait_seconds from public.usl_ad_sessions where telegram_id=$1 and status='started' order by started_at desc limit 1`,[id])).rows[0];
   if(old)return res.json({ok:true,data:{session_id:old.id,wait_seconds:Number(old.wait_seconds||0),reward:5,limit:100}});
   const wait=10+Math.floor(Math.random()*11);
   const r=(await pool.query(`insert into public.usl_ad_sessions(telegram_id,eligible_at) values($1,now()+($2||' seconds')::interval) returning id`,[id,wait])).rows[0];
   return res.json({ok:true,data:{session_id:r.id,wait_seconds:wait,reward:5,limit:100}});
  }
  const sid=String(b.session_id||''); if(!/^[0-9a-f-]{36}$/i.test(sid))return res.status(400).json({ok:false,error:'invalid_request'});
  const c=await pool.connect();try{
   await c.query('begin');
   const q=(await c.query(`select * from public.usl_ad_sessions where id=$1 and telegram_id=$2 for update`,[sid,id])).rows[0];
   if(!q){await c.query('rollback');return res.status(404).json({ok:false,error:'session_not_found'})}
   if(q.status==='credited'){await c.query('commit');return res.json({ok:true,data:{status:'credited',reward:Number(q.reward)}})}
   if(q.status!=='started'||Date.now()-new Date(q.started_at).getTime()>30*60*1000){await c.query(`update public.usl_ad_sessions set status='expired' where id=$1 and status='started'`,[sid]);await c.query('commit');return res.status(409).json({ok:false,error:'session_expired'})}
   if(new Date(q.eligible_at).getTime()>Date.now()){await c.query('rollback');return res.status(409).json({ok:false,error:'ad_timer_incomplete'})}
   const n=Number((await c.query(`select count(*) n from public.usl_ad_sessions where telegram_id=$1 and reward_day=current_date and status='credited'`,[id])).rows[0]?.n||0);
   if(n>=100){await c.query('rollback');return res.status(429).json({ok:false,error:'daily_limit_reached'})}
   const u=await c.query(`update public.usl_ad_sessions set status='credited',credited_at=now() where id=$1 and status='started' returning reward`,[sid]);
   if(!u.rowCount){await c.query('rollback');return res.status(409).json({ok:false,error:'already_processed'})}
   await c.query(`update public.users set balance=coalesce(balance,0)+5,total_earned=coalesce(total_earned,0)+5 where telegram_id=$1`,[id]);
   await c.query(`insert into public.transactions(telegram_id,type,amount,description) values($1,'ad_reward',5,'USL Ads reward')`,[id]).catch(()=>{});
   await c.query('commit');return res.json({ok:true,data:{status:'credited',reward:5,used:n+1,limit:100}});
  }catch(e){await c.query('rollback').catch(()=>{});throw e}finally{c.release()}
 }catch(e){console.error('usl-ad',e);return res.status(500).json({ok:false,error:'temporary_error'})}
});
'''
    # Insert before server listen when possible, otherwise append.
    needles=['app.listen(','server.listen(']
    pos=-1
    for n in needles:
        pos=s.rfind(n)
        if pos>=0: break
    s=s[:pos]+code+'\n'+s[pos:] if pos>=0 else s+code
    p.write_text(s)
PY
node --check "$SERVER"
pm --prefix /opt/wiener-code run build
pm2 restart wiener-api --update-env
sleep 2
curl -fsS http://127.0.0.1:3000/health
echo
echo 'V103 backend installed. Frontend build ready.'