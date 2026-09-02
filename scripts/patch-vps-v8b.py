from pathlib import Path

p=Path('/opt/wiener-backend/server.mjs')
s=p.read_text()

if 'WIENER VPS CRON V8B' in s:
    print('WIENER VPS CRON V8B already installed')
    raise SystemExit(0)

old="""async function tgV8(method,payload){
  const r=await fetch(`https://api.telegram.org/bot${BOT}/${method}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
  const x=await r.json().catch(()=>({ok:false,description:'telegram_invalid_response'}));
  if(!x.ok) throw new Error(x.description||method);
  return x.result;
}"""
new="""// === WIENER VPS CRON V8B ===
async function tgV8(method,payload){
  const r=await fetch(`https://api.telegram.org/bot${BOT}/${method}`,{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify(payload),
    signal:AbortSignal.timeout(8000)
  });
  const x=await r.json().catch(()=>({ok:false,description:'telegram_invalid_response'}));
  if(!x.ok) throw new Error(x.description||method);
  return x.result;
}"""
if old not in s:
    raise SystemExit('ERROR: tgV8 block not found')
s=s.replace(old,new,1)

# First-run safety: process farm reminders in small batches, not up to 1000 Telegram calls.
s=s.replace("notification_unreachable_at is null and farm_started_at is not null and farm_started_at + (($1::int||' seconds')::interval) <= now() limit 1000`", "notification_unreachable_at is null and farm_started_at is not null and farm_started_at + (($1::int||' seconds')::interval) <= now() order by farm_started_at limit 50`",1)

old_route="""app.post('/internal/cron',async(req,res)=>{
  try{
    const sec=await cronSecretV8();
    if(!sec||String(req.headers['x-wiener-cron-secret']||'')!==sec) return res.status(403).send('forbidden');
    const [proof,farm,amb,giveaways]=await Promise.all([runProofRemindersV8(),runFarmRemindersV8(),runAmbassadorV8(),runGiveawaysV8()]);
    return res.json({ok:true,proof_reminders:proof,farm_reminders:farm,ambassador:amb,giveaways});
  }catch(e){console.error('cron v8',e);return res.status(500).json({ok:false,error:String(e?.message||e)});}
});"""
new_route="""app.post('/internal/cron',async(req,res)=>{
  let lockClient=null;
  try{
    const sec=await cronSecretV8();
    if(!sec||String(req.headers['x-wiener-cron-secret']||'')!==sec) return res.status(403).send('forbidden');

    lockClient=await pool.connect();
    const lk=await lockClient.query(`select pg_try_advisory_lock(88442026) as locked`);
    if(!lk.rows[0]?.locked){
      lockClient.release(); lockClient=null;
      return res.json({ok:true,busy:true,message:'previous_cron_still_running'});
    }

    const [proof,farm,amb,giveaways]=await Promise.all([
      runProofRemindersV8(),runFarmRemindersV8(),runAmbassadorV8(),runGiveawaysV8()
    ]);
    return res.json({ok:true,busy:false,proof_reminders:proof,farm_reminders:farm,ambassador:amb,giveaways});
  }catch(e){
    console.error('cron v8',e);
    return res.status(500).json({ok:false,error:String(e?.message||e)});
  }finally{
    if(lockClient){
      try{await lockClient.query(`select pg_advisory_unlock(88442026)`)}catch{}
      lockClient.release();
    }
  }
});"""
if old_route not in s:
    raise SystemExit('ERROR: V8 cron route not found')
s=s.replace(old_route,new_route,1)

p.write_text(s)
print('Installed WIENER VPS CRON V8B')
