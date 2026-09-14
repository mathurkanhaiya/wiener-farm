#!/usr/bin/env python3
from pathlib import Path
p=Path('/opt/wiener-backend/server.mjs')
s=p.read_text()
anchor="app.use('/functions/v1/wiener-ad',cooldownGuardV67('main','start','complete'));"
if 'WIENER SECURITY HARDENING V100' not in s:
    guard=r'''// === WIENER SECURITY HARDENING V100 ===
const UUID_V100=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function actionGuardV100(path,allowed,{uuidField=null,allowEmpty=false}={}){
  app.use(path,(req,res,next)=>{if(req.method!=='POST')return next();const a=String(req.body?.action||'');if((!a&&!allowEmpty)||(a&&!allowed.includes(a)))return res.status(400).json({ok:false,error:'unsupported_action',message:'Unsupported action'});if(uuidField&&req.body?.[uuidField]&&!UUID_V100.test(String(req.body[uuidField])))return res.status(400).json({ok:false,error:'invalid_request',message:'Invalid request'});next()});
}
function uuidGuardV100(path,field){app.use(path,(req,res,next)=>{if(req.method==='POST'&&req.body?.[field]&&!UUID_V100.test(String(req.body[field])))return res.status(400).json({ok:false,error:'invalid_request',message:'Invalid request'});next()})}
function sanitizeErrorsV100(path){app.use(path,(req,res,next)=>{const j=res.json.bind(res);res.json=(x)=>{if(x&&x.ok===false){const e=String(x.error||'');if(/syntax|postgres|sql|uuid|relation|column|constraint|duplicate key|invalid input/i.test(e))x={ok:false,error:'invalid_request',message:'Invalid request'}}return j(x)};next()})}
actionGuardV100('/functions/v1/wiener-ad',['status','start','complete'],{uuidField:'session_id'});
actionGuardV100('/functions/v1/wiener-tads',['stats','start','reward'],{uuidField:'session_id'});
actionGuardV100('/functions/v1/wiener-adsgram-task',['start','reward','status'],{uuidField:'session_id'});
uuidGuardV100('/functions/v1/wiener-task-api','task_id');
actionGuardV100('/functions/v1/wiener-ad-usage',['status']);
actionGuardV100('/functions/v1/wiener-referral-v2',['status'],{allowEmpty:true});
actionGuardV100('/functions/v1/wiener-device',['register'],{allowEmpty:true});
actionGuardV100('/functions/v1/wiener-offers',['status','open']);
sanitizeErrorsV100('/functions/v1/wiener-task-api');sanitizeErrorsV100('/functions/v1/wiener-offers');

app.post('/functions/v1/wiener-spin',async(req,res,next)=>{
  try{const b=req.body||{},a=String(b.action||'');if(a==='spin_start'){const {id}=await edgeUser(b);const token=crypto.randomBytes(32).toString('hex');await pool.query(`insert into public.wiener_spin_tokens(token,telegram_id,expires_at) values($1,$2,now()+interval '60 seconds')`,[token,id]);return res.json({ok:true,data:{spin_token:token,expires_in:60}})}if(a!=='spin')return next();const {id}=await edgeUser(b),token=String(b.spin_token||'');if(!/^[0-9a-f]{64}$/i.test(token))return res.status(400).json({ok:false,error:'invalid_spin_token',message:'Spin authorization expired'});const take=await pool.query(`update public.wiener_spin_tokens set consumed_at=now() where token=$1 and telegram_id=$2 and consumed_at is null and expires_at>now() returning token`,[token,id]);if(!take.rowCount){const old=await pool.query(`select 1 from public.wiener_spin_events where idempotency_key=$1 and telegram_id=$2 limit 1`,[token,id]);if(!old.rowCount)return res.status(409).json({ok:false,error:'spin_token_used',message:'Spin authorization expired'})}req.body.idempotency_key=token;const j=res.json.bind(res);res.json=function(x){if(!x||x.ok!==true)pool.query(`update public.wiener_spin_tokens t set consumed_at=null where token=$1 and telegram_id=$2 and not exists(select 1 from public.wiener_spin_events e where e.idempotency_key=$1 and e.telegram_id=$2)`,[token,id]).catch(()=>{});return j(x)};next()}catch(e){console.error('v100_spin_guard',String(e?.message||e));return res.status(400).json({ok:false,error:'invalid_request',message:'Invalid request'})}
});
// === END WIENER SECURITY HARDENING V100 ===

'''
    if anchor not in s: raise SystemExit('V100 anchor missing: wiener-ad')
    s=s.replace(anchor,guard+anchor,1)

s=s.replace("        !!b.interacted\n      ]);","        false\n      ]);",1)
needle="""      const data=await rpc('credit_tads_ad_interaction',[\n        id,\n        sid,\n        !!b.interacted\n      ]);"""
repl="""      const data=await rpc('credit_tads_ad_interaction',[\n        id,\n        sid,\n        false\n      ]);"""
if needle in s:s=s.replace(needle,repl,1)
old="""    if(action==='start'){
      const ins=await pool.query(`
        insert into public.adsgram_task_sessions(
          telegram_id,block_id,reward,status
        )
        values($1,$2,3.75,'started')
        returning id,block_id,reward,created_at
      `,[id,blockId]);

      return res.json({
        ok:true,
        data:{
          session_id:ins.rows[0].id,
          block_id:ins.rows[0].block_id,
          reward:num(ins.rows[0].reward),
          created_at:ins.rows[0].created_at
        }
      });
    }"""
new="""    if(action==='start'){
      const used=num((await pool.query(`select count(*)::int n from public.adsgram_task_sessions where telegram_id=$1 and status='credited' and credited_at>=current_date and credited_at<current_date+interval '1 day'`,[id])).rows[0]?.n);
      if(used>=20)throw new Error('adsgram_task_daily_limit');
      await pool.query(`update public.adsgram_task_sessions set status='expired' where telegram_id=$1 and status='started' and created_at<now()-interval '30 minutes'`,[id]);
      let row=(await pool.query(`select id,block_id,reward,created_at from public.adsgram_task_sessions where telegram_id=$1 and status='started' order by created_at desc limit 1`,[id])).rows[0];
      if(!row)row=(await pool.query(`insert into public.adsgram_task_sessions(telegram_id,block_id,reward,status) values($1,$2,3.75,'started') returning id,block_id,reward,created_at`,[id,blockId])).rows[0];
      return res.json({ok:true,data:{session_id:row.id,block_id:row.block_id,reward:num(row.reward),created_at:row.created_at}});
    }"""
if old not in s: raise SystemExit('V100 anchor missing: adsgram task start')
s=s.replace(old,new,1)
p.write_text(s)
print('V100 server patch applied')
