#!/usr/bin/env python3
from pathlib import Path
import sys,re
p=Path(sys.argv[1]);s=p.read_text()
# Normalize the existing referral engine to one fixed two-stage reward while preserving
# its existing active/anti-abuse qualification and required-ad logic.
s=s.replace("const REF_JOIN_V98=100;","const REF_JOIN_V98=125;")
s=re.sub(r"\{tier:1,label:'Diamond',total:600,requiredAds:", "{tier:1,label:'Diamond',total:375,requiredAds:", s)
s=re.sub(r"\{tier:2,label:'Premium',total:500,requiredAds:", "{tier:2,label:'Premium',total:375,requiredAds:", s)
s=re.sub(r"\{tier:3,label:'Plus',total:400,requiredAds:", "{tier:3,label:'Plus',total:375,requiredAds:", s)
s=re.sub(r"\{tier:4,label:'Base',total:300,requiredAds:", "{tier:4,label:'Base',total:375,requiredAds:", s)

marker="// === WIENER WITHDRAW AD UNLOCK V24 ==="
if marker in s:
    start=s.index(marker)
    anchor="if(a==='withdraw'){const amount=num(b.amount_wiener);"
    pos=s.find(anchor,start)
    if pos<0: raise SystemExit("withdraw anchor missing")
    s=s[:start]+s[pos:]
s=re.sub(r"if\(a==='withdraw'\)\{const withdrawAdCount(?:V95|V24)?=.*?throw new Error\([^;]+;\s*\}\s*",
         "if(a==='withdraw'){",s,count=1)

if "WIENER PROVIDER ADS V120" not in s:
    pos=s.find("app.post('/functions/v1/wiener-ad'")
    if pos<0: raise SystemExit("wiener-ad route missing")
    code=r'''
// === WIENER PROVIDER ADS V120 ===
async function providerConfigV120(){
 const q=await pool.query("select monetag_zone_id,adexium_widget_id,monetag_ad_reward,monetag_daily_limit,adexium_ad_reward,adexium_daily_limit from public.app_settings where id=true limit 1");
 const x=q.rows[0]||{};
 return {
  monetag:{id:String(x.monetag_zone_id||process.env.MONETAG_ZONE_ID||""),reward:Number(x.monetag_ad_reward||30),limit:Number(x.monetag_daily_limit||10)},
  adexium:{id:String(x.adexium_widget_id||process.env.ADEXIUM_WIDGET_ID||""),reward:Number(x.adexium_ad_reward||50),limit:Number(x.adexium_daily_limit||5)}
 };
}
async function providerUserV120(body){const x=await edgeUser(body||{});return Number(x?.id||x)}
async function creditProviderV120(id,sid,provider){
 const cfg=(await providerConfigV120())[provider],c=await pool.connect();
 try{
  await c.query("begin");
  const q=await c.query("select * from public.provider_ad_sessions where id=$1 for update",[sid]),row=q.rows[0];
  if(!row)throw new Error("provider_ad_session_invalid");
  if(row.credited_at){await c.query("commit");return{credited:true,already:true,reward:Number(row.reward_wiener)}}
  const n=Number((await c.query("select count(*)::int c from public.provider_ad_sessions where provider=$1 and telegram_id=$2 and day=(now() at time zone 'utc')::date and credited_at is not null",[provider,id])).rows[0]?.c||0);
  if(n>=cfg.limit)throw new Error("daily_ad_limit_reached");
  const reward=Number(cfg.reward);
  await c.query("update public.users set balance=coalesce(balance,0)+$2,total_earned=greatest(0,coalesce(total_earned,0)+$2) where telegram_id=$1",[id,reward]);
  await c.query("insert into public.transactions(telegram_id,type,amount,description) values($1,'ad_provider_reward',$2,$3)",[id,reward,provider+" rewarded ad +"+reward+" WIENER"]).catch(()=>{});
  await c.query("update public.provider_ad_sessions set status='credited',provider_verified_at=coalesce(provider_verified_at,now()),credited_at=now(),updated_at=now() where id=$1",[sid]);
  await c.query("commit");return{credited:true,already:false,reward};
 }catch(e){await c.query("rollback").catch(()=>{});throw e}finally{c.release()}
}
app.post("/functions/v1/wiener-provider-ad",async(req,res)=>{
 try{
  const b=req.body||{},a=String(b.action||""),p=String(b.provider||""),id=await providerUserV120(b),cfg=await providerConfigV120();
  if(a==="status"){
   const out={adsgram:{used:0,limit:15,reward:50},monetag:{used:0,limit:cfg.monetag.limit,reward:cfg.monetag.reward},adexium:{used:0,limit:cfg.adexium.limit,reward:cfg.adexium.reward}};
   const aq=await pool.query("select count(*)::int c from public.ad_sessions where telegram_id=$1 and network='adsgram' and credited_at is not null and (started_at at time zone 'utc')::date=(now() at time zone 'utc')::date",[id]);out.adsgram.used=Number(aq.rows[0]?.c||0);
   for(const x of ["monetag","adexium"]){const q=await pool.query("select count(*) filter(where credited_at is not null)::int used from public.provider_ad_sessions where provider=$1 and telegram_id=$2 and day=(now() at time zone 'utc')::date",[x,id]);out[x].used=Number(q.rows[0]?.used||0)}
   return res.json({ok:true,data:{providers:out}});
  }
  if(!["monetag","adexium"].includes(p))throw new Error("provider_not_supported");
  if(!cfg[p].id)throw new Error(p+"_not_configured");
  if(p==="monetag"&&String(b.zone_id||"")!==cfg[p].id)throw new Error("monetag_zone_mismatch");
  if(p==="adexium"&&String(b.widget_id||"")!==cfg[p].id)throw new Error("adexium_widget_mismatch");
  if(a==="start"){
   const q=await pool.query("select count(*)::int c from public.provider_ad_sessions where provider=$1 and telegram_id=$2 and day=(now() at time zone 'utc')::date and credited_at is not null",[p,id]);
   if(Number(q.rows[0]?.c||0)>=cfg[p].limit)throw new Error("daily_ad_limit_reached");
   const y=p==="monetag"?String(id)+"_"+crypto.randomUUID():null;
   const ins=await pool.query("insert into public.provider_ad_sessions(provider,telegram_id,day,ymid,zone_id,widget_id,reward_wiener) values($1,$2,(now() at time zone 'utc')::date,$3,$4,$5,$6) returning id,ymid",[p,id,y,p==="monetag"?cfg[p].id:null,p==="adexium"?cfg[p].id:null,cfg[p].reward]);
   return res.json({ok:true,data:{session_id:ins.rows[0].id,ymid:ins.rows[0].ymid,provider:p,reward:cfg[p].reward,limit:cfg[p].limit}});
  }
  if(a==="complete"){
   const sid=String(b.session_id||""),q=await pool.query("select * from public.provider_ad_sessions where id=$1 and telegram_id=$2 and provider=$3",[sid,id,p]),row=q.rows[0];
   if(!row)throw new Error("provider_ad_session_invalid");
   if(p==="monetag"){await pool.query("update public.provider_ad_sessions set client_completed_at=now(),updated_at=now() where id=$1 and credited_at is null",[sid]);return res.json({ok:true,data:{status:"awaiting_provider_confirmation"}})}
   const task=String(b.task_id||"");if(!task)throw new Error("adexium_task_required");
   const check=await fetch("https://bid.tgads.live/task/check/"+encodeURIComponent(cfg[p].id)+"/"+encodeURIComponent(task));
   const data=await check.json().catch(()=>({done:false}));if(data.done!==true)throw new Error("adexium_not_verified");
   await pool.query("update public.provider_ad_sessions set task_id=$2,client_completed_at=now(),provider_verified_at=now(),updated_at=now() where id=$1",[sid,task]);
   return res.json({ok:true,data:await creditProviderV120(id,sid,p)});
  }
  throw new Error("provider_action_not_supported");
 }catch(e){const m=String(e?.message||e);return res.status(400).json({ok:false,error:m,message:m.replace(/_/g," ")})}
});
app.get("/functions/v1/wiener-monetag-postback",async(req,res)=>{
 try{
  const secret=String(process.env.MONETAG_POSTBACK_SECRET||"");if(secret&&String(req.query?.secret||"")!==secret)return res.status(403).send("forbidden");
  const y=String(req.query?.ymid||""),e=String(req.query?.event||req.query?.event_type||""),v=String(req.query?.value||req.query?.reward_event_type||""),z=String(req.query?.zone||req.query?.zone_id||"");
  if(!y||(e&&e!=="impression")||v!=="valued")return res.status(200).send("ignored");
  const q=await pool.query("select id,telegram_id,zone_id from public.provider_ad_sessions where ymid=$1 and provider='monetag'",[y]),row=q.rows[0];
  if(!row||String(row.zone_id)!==z)return res.status(200).send("ignored");
  await pool.query("update public.provider_ad_sessions set provider_verified_at=now(),updated_at=now() where id=$1 and credited_at is null",[row.id]);
  await creditProviderV120(Number(row.telegram_id),row.id,"monetag");
  return res.status(200).send("ok");
 }catch(e){console.error("monetag_postback_v120",String(e?.message||e));return res.status(200).send("retry-safe")}
});
// === END WIENER PROVIDER ADS V120 ===
'''
    s=s[:pos]+code+s[pos:]
p.write_text(s)
print("V120 backend patch installed")
