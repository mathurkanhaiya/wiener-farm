#!/usr/bin/env python3
from pathlib import Path
import os

p=Path(os.environ.get('WIENER_BACKEND_FILE','/opt/wiener-backend/server.mjs'))
if not p.exists():
    alt=Path('/opt/wiener-backend/server.js')
    if alt.exists(): p=alt
s=p.read_text()
TAG='WIENER LIMITED GRAM TASK V80'
if TAG in s:
    print('V80 limited GRAM task already installed')
    raise SystemExit(0)
for need in ['edgeUser','const pool','app.use((_req,res)=>']:
    if need not in s: raise SystemExit('ERROR: required backend primitive missing: '+need)
pos=s.rfind('app.use((_req,res)=>')
if pos<0: raise SystemExit('ERROR: final fallback route missing')
line=s.rfind('\n',0,pos)

code=r'''

// === WIENER LIMITED GRAM TASK V80 ===
const LIMITED_GRAM_REQUIRED_V80=35;
const LIMITED_GRAM_REWARD_V80=0.03;
async function limitedGramStatusV80(id){
  const [q,w]=await Promise.all([
    pool.query(`select task1_ads,task2_ads,claimed,withdrawal_id,claimed_at from public.wiener_limited_gram_tasks where telegram_id=$1`,[id]),
    pool.query(`select id,status from public.wiener_spin_withdrawals where telegram_id=$1 order by id desc limit 1`,[id])
  ]);
  const x=q.rows[0]||{};
  const wid=x.withdrawal_id==null?null:Number(x.withdrawal_id);
  const wr=wid==null?null:w.rows.find?.(r=>Number(r.id)===wid)||((await pool.query(`select id,status from public.wiener_spin_withdrawals where id=$1 and telegram_id=$2`,[wid,id])).rows[0]||null);
  return{enabled:true,required:LIMITED_GRAM_REQUIRED_V80,reward_gram:LIMITED_GRAM_REWARD_V80,task1_ads:Number(x.task1_ads||0),task2_ads:Number(x.task2_ads||0),claimed:!!x.claimed,claimed_at:x.claimed_at||null,withdrawal_id:wid,withdrawal_status:wr?.status||null};
}
async function limitedGramBlockV80(task){
  if(Number(task)===2)return String(process.env.WIENER_LIMITED_GRAM_TASK2_BLOCK_ID||'int-44228');
  const x=(await pool.query(`select adsgram_block_id from public.app_settings where id=true limit 1`)).rows[0]||{};
  return String(process.env.WIENER_LIMITED_GRAM_TASK1_BLOCK_ID||x.adsgram_block_id||'');
}
app.post('/functions/v1/wiener-limited-gram-task',async(req,res)=>{
  try{
    const b=req.body||{}, {id}=await edgeUser(b),action=String(b.action||'status');
    if(action==='status')return res.json({ok:true,data:await limitedGramStatusV80(id)});
    if(action==='start'){
      const task=Number(b.task);if(task!==1&&task!==2)throw new Error('invalid_task');
      const st=await limitedGramStatusV80(id);if(st.claimed)throw new Error('Limited GRAM task already claimed');
      if((task===1?st.task1_ads:st.task2_ads)>=LIMITED_GRAM_REQUIRED_V80)throw new Error(`Task ${task} already completed`);
      const recent=(await pool.query(`select created_at from public.wiener_limited_gram_sessions where telegram_id=$1 order by created_at desc limit 1`,[id])).rows[0];
      if(recent&&Date.now()-new Date(recent.created_at).getTime()<8000)return res.status(429).json({ok:false,error:'limited_gram_ad_cooldown',message:'Please wait a few seconds before opening another ad.'});
      const block=await limitedGramBlockV80(task);if(!block)throw new Error('Ads are temporarily unavailable');
      const sid=crypto.randomBytes(18).toString('hex');
      await pool.query(`insert into public.wiener_limited_gram_sessions(session_id,telegram_id,task_no) values($1,$2,$3)`,[sid,id,task]);
      return res.json({ok:true,data:{session_id:sid,block_id:block,task}});
    }
    if(action==='complete'){
      const task=Number(b.task),sid=String(b.session_id||'');if((task!==1&&task!==2)||!/^[a-f0-9]{36}$/.test(sid))throw new Error('invalid_limited_gram_session');
      const c=await pool.connect();
      try{
        await c.query('begin');
        const a=(await c.query(`select * from public.wiener_limited_gram_sessions where session_id=$1 and telegram_id=$2 and task_no=$3 for update`,[sid,id,task])).rows[0];
        if(!a)throw new Error('limited_gram_session_not_found');
        if(a.status==='completed'){await c.query('commit');return res.json({ok:true,data:await limitedGramStatusV80(id),already_completed:true})}
        const age=Date.now()-new Date(a.created_at).getTime();if(age<2500)throw new Error('limited_gram_ad_too_fast');if(age>20*60*1000)throw new Error('limited_gram_session_expired');
        await c.query(`insert into public.wiener_limited_gram_tasks(telegram_id) values($1) on conflict(telegram_id) do nothing`,[id]);
        const st=(await c.query(`select * from public.wiener_limited_gram_tasks where telegram_id=$1 for update`,[id])).rows[0];if(st.claimed)throw new Error('Limited GRAM task already claimed');
        const current=task===1?Number(st.task1_ads||0):Number(st.task2_ads||0);if(current>=LIMITED_GRAM_REQUIRED_V80)throw new Error(`Task ${task} already completed`);
        await c.query(`update public.wiener_limited_gram_sessions set status='completed',completed_at=now() where session_id=$1`,[sid]);
        if(task===1)await c.query(`update public.wiener_limited_gram_tasks set task1_ads=least($2,task1_ads+1),updated_at=now() where telegram_id=$1`,[id,LIMITED_GRAM_REQUIRED_V80]);
        else await c.query(`update public.wiener_limited_gram_tasks set task2_ads=least($2,task2_ads+1),updated_at=now() where telegram_id=$1`,[id,LIMITED_GRAM_REQUIRED_V80]);
        await c.query('commit');
      }catch(e){await c.query('rollback');throw e}finally{c.release()}
      return res.json({ok:true,data:await limitedGramStatusV80(id)});
    }
    if(action==='claim'){
      const wallet=String(b.wallet_address||'').trim();if(wallet.length<40||wallet.length>80||!/^[A-Za-z0-9_:-]+$/.test(wallet))throw new Error('Connect your TON wallet first');
      const c=await pool.connect();
      try{
        await c.query('begin');
        await c.query(`insert into public.wiener_limited_gram_tasks(telegram_id) values($1) on conflict(telegram_id) do nothing`,[id]);
        const st=(await c.query(`select * from public.wiener_limited_gram_tasks where telegram_id=$1 for update`,[id])).rows[0];
        if(st.claimed){await c.query('commit');return res.json({ok:true,data:await limitedGramStatusV80(id),already_claimed:true})}
        if(Number(st.task1_ads||0)<LIMITED_GRAM_REQUIRED_V80||Number(st.task2_ads||0)<LIMITED_GRAM_REQUIRED_V80)throw new Error('Complete both 35-ad tasks first');
        const pending=(await c.query(`select id from public.wiener_spin_withdrawals where telegram_id=$1 and status='pending' limit 1`,[id])).rows[0];if(pending)throw new Error('You already have a pending GRAM withdrawal');
        const w=(await c.query(`insert into public.wiener_spin_withdrawals(telegram_id,amount_ton,wallet_address) values($1,$2,$3) returning id,status`,[id,LIMITED_GRAM_REWARD_V80,wallet])).rows[0];
        await c.query(`update public.wiener_limited_gram_tasks set claimed=true,withdrawal_id=$2,claimed_at=now(),updated_at=now() where telegram_id=$1`,[id,w.id]);
        await c.query('commit');
      }catch(e){await c.query('rollback');throw e}finally{c.release()}
      return res.json({ok:true,data:await limitedGramStatusV80(id)});
    }
    return res.status(400).json({ok:false,error:'invalid_action'});
  }catch(e){
    const msg=String(e?.message||e||'limited_gram_task_failed');
    return res.status(/already|Complete|pending/.test(msg)?409:400).json({ok:false,error:msg.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,''),message:msg});
  }
});
'''

s=s[:line]+code+s[line:]
p.write_text(s)
print('V80 limited GRAM task backend installed')
