#!/usr/bin/env python3
from pathlib import Path
import os

p=Path(os.environ.get('WIENER_BACKEND_FILE','/opt/wiener-backend/server.mjs'))
if not p.exists():
    alt=Path('/opt/wiener-backend/server.js')
    if alt.exists(): p=alt
if not p.exists(): raise SystemExit('ERROR: Wiener backend server file not found')
s=p.read_text()
TAG='WIENER REFERRAL COUNTRY REWARDS V98'
if TAG in s:
    print('V98 referral country rewards already installed')
    raise SystemExit(0)
for need in ['edgeUser','const pool','telegramApi','app.use((_req,res)=>']:
    if need not in s: raise SystemExit('ERROR: required backend primitive missing: '+need)

# Hook the existing device registration so every genuine app open can refresh referral risk.
needle="const data=await rpc('register_device_for_user',[id,deviceId,fp||null]);"
if needle not in s:
    raise SystemExit('ERROR: wiener-device registration anchor not found')
s=s.replace(needle,needle+"\n    let referralRiskV98=null;try{referralRiskV98=await referralDeviceCheckV98(req,id)}catch(e){console.error('v98_referral_risk_nonblocking',String(e?.message||e))}",1)

# Expose VPN state to newer clients without changing the existing multi-account flags.
ret="return res.json({ok:true,data:{...(data||{}),blocked:!!data?.blocked,device_blocked:!!data?.device_blocked,access_blocked:!!data?.access_blocked,same_device:!!data?.same_device,referral_eligible:data?.referral_eligible!==false}});"
if ret in s:
    s=s.replace(ret,"return res.json({ok:true,data:{...(data||{}),blocked:!!data?.blocked,device_blocked:!!data?.device_blocked,access_blocked:!!data?.access_blocked,same_device:!!data?.same_device,referral_eligible:data?.referral_eligible!==false,vpn_blocked:!!referralRiskV98?.vpn_blocked,vpn_message:referralRiskV98?.vpn_blocked?'Turn off VPN or proxy and reopen WIENER Farm.':null}});",1)

marker="\napp.use((_req,res)=>\n  res.status(404).json({ok:false,error:'route_not_enabled_yet'})\n);\n"
pos=s.rfind(marker)
if pos<0:
    fallback=s.rfind('app.use((_req,res)=>')
    if fallback<0: raise SystemExit('ERROR: final fallback route not found')
    pos=s.rfind('\n',0,fallback)

code=r'''

// === WIENER REFERRAL COUNTRY REWARDS V98 ===
const REF_JOIN_V98=100;
const REF_TIERS_V98=[
  {tier:1,label:'Diamond',total:600,requiredAds:10,countries:['US','GB','CA','AU','DE','CH','NL','NO','SE','DK']},
  {tier:2,label:'Premium',total:500,requiredAds:10,countries:['FR','IT','ES','AT','BE','FI','IE','JP','KR','SG','AE']},
  {tier:3,label:'Plus',total:400,requiredAds:5,countries:['BR','MX','TR','PL','RO','PT','MY','SA','AR']},
  {tier:4,label:'Base',total:300,requiredAds:5,countries:[]}
];
function refTierV98(country){const cc=String(country||'').trim().toUpperCase().slice(0,2);return REF_TIERS_V98.find(x=>x.countries.includes(cc))||REF_TIERS_V98[3]}
function refIpV98(req){return String(req.headers['x-wiener-client-ip']||req.headers['cf-connecting-ip']||String(req.headers['x-forwarded-for']||'').split(',')[0]||req.socket?.remoteAddress||'').trim().replace(/^::ffff:/,'').slice(0,96)}
function refCountryHeaderV98(req){return String(req.headers['x-wiener-country']||req.headers['cf-ipcountry']||'').trim().toUpperCase().slice(0,2)}
function refIpHashV98(ip){const key=String(process.env.DEVICE_HASH_SECRET||process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.BOT_TOKEN||'wiener-v98');return crypto.createHmac('sha256',key).update(String(ip||'')).digest('hex')}
async function refIpRiskV98(req){
  const ip=refIpV98(req),headerCountry=refCountryHeaderV98(req),key=String(process.env.IPAPI_IS_KEY||'').trim();
  if(!ip||!key)return{checked:false,country:headerCountry||null,is_vpn:false,is_proxy:false,is_tor:false,is_datacenter:false};
  const hash=refIpHashV98(ip);
  const cached=(await pool.query(`select country_code,is_vpn,is_proxy,is_tor,is_datacenter from public.referral_v2_ip_cache where ip_hash=$1 and checked_at>now()-interval '24 hours' limit 1`,[hash])).rows[0];
  if(cached)return{checked:true,country:String(cached.country_code||headerCountry||'').toUpperCase()||null,is_vpn:!!cached.is_vpn,is_proxy:!!cached.is_proxy,is_tor:!!cached.is_tor,is_datacenter:!!cached.is_datacenter};
  let timer=null;
  try{
    const ctl=new AbortController();timer=setTimeout(()=>ctl.abort(),3500);
    const r=await fetch(`https://api.ipapi.is/?q=${encodeURIComponent(ip)}&key=${encodeURIComponent(key)}`,{signal:ctl.signal});
    if(!r.ok)throw new Error('ip_risk_http_'+r.status);
    const x=await r.json();
    const out={checked:true,country:String(x?.location?.country_code||x?.country_code||headerCountry||'').toUpperCase().slice(0,2)||null,is_vpn:x?.is_vpn===true,is_proxy:x?.is_proxy===true,is_tor:x?.is_tor===true,is_datacenter:x?.is_datacenter===true};
    await pool.query(`insert into public.referral_v2_ip_cache(ip_hash,country_code,is_vpn,is_proxy,is_tor,is_datacenter,checked_at) values($1,$2,$3,$4,$5,$6,now()) on conflict(ip_hash) do update set country_code=excluded.country_code,is_vpn=excluded.is_vpn,is_proxy=excluded.is_proxy,is_tor=excluded.is_tor,is_datacenter=excluded.is_datacenter,checked_at=now()`,[hash,out.country,out.is_vpn,out.is_proxy,out.is_tor,out.is_datacenter]);
    return out;
  }catch(e){console.error('v98_ip_risk_failed',String(e?.message||e));return{checked:false,country:headerCountry||null,is_vpn:false,is_proxy:false,is_tor:false,is_datacenter:false}}finally{if(timer)clearTimeout(timer)}
}
async function refStartedV98(){return (await pool.query(`select started_at from public.referral_v2_config where id=true limit 1`)).rows[0]?.started_at}
async function refUserV98(id){return (await pool.query(`select telegram_id,referred_by,total_ads,is_banned,device_blocked,referral_reward_eligible,referral_ineligible_reason,created_at from public.users where telegram_id=$1 limit 1`,[id])).rows[0]||null}
async function refBanV98(id,reason){await pool.query(`update public.users set is_banned=true,device_blocked=true,ban_reason=$2 where telegram_id=$1`,[id,reason]);await pool.query(`update public.referral_v2 set status='banned',ban_reason=$2,updated_at=now() where referred_user_id=$1`,[id,reason])}
async function refEnsureRowV98(user,country=null){
  if(!user?.referred_by)return null;
  const started=await refStartedV98();if(started&&new Date(user.created_at)<new Date(started))return null;
  const existing=(await pool.query(`select * from public.referral_v2 where referred_user_id=$1 limit 1`,[user.telegram_id])).rows[0];if(existing)return existing;
  const tier=refTierV98(country),completion=tier.total-REF_JOIN_V98;
  return (await pool.query(`insert into public.referral_v2(referred_user_id,inviter_user_id,country_code,tier,required_ads,join_reward_wiener,completion_reward_wiener,total_reward_wiener,status) values($1,$2,$3,$4,$5,$6,$7,$8,'pending') on conflict(referred_user_id) do nothing returning *`,[user.telegram_id,user.referred_by,country||null,tier.tier,tier.requiredAds,REF_JOIN_V98,completion,tier.total])).rows[0]||(await pool.query(`select * from public.referral_v2 where referred_user_id=$1`,[user.telegram_id])).rows[0]
}
async function refCreditStageV98(row,stage,amount){
  const c=await pool.connect();try{await c.query('begin');
    const ins=await c.query(`insert into public.referral_v2_ledger(inviter_user_id,referred_user_id,stage,amount_wiener) values($1,$2,$3,$4) on conflict(referred_user_id,stage) do nothing returning id`,[row.inviter_user_id,row.referred_user_id,stage,amount]);
    if(ins.rowCount){const q=await c.query(`update public.users set balance=coalesce(balance,0)+$2,total_earned=coalesce(total_earned,0)+$2,referral_earnings=coalesce(referral_earnings,0)+$2 where telegram_id=$1`,[row.inviter_user_id,amount]);if(!q.rowCount)throw new Error('inviter_not_found')}
    if(stage==='join')await c.query(`update public.referral_v2 set join_rewarded_at=coalesce(join_rewarded_at,now()),status=case when status='pending' then 'active' else status end,updated_at=now() where referred_user_id=$1`,[row.referred_user_id]);
    else await c.query(`update public.referral_v2 set qualified_at=coalesce(qualified_at,now()),completion_rewarded_at=coalesce(completion_rewarded_at,now()),status='rewarded',updated_at=now() where referred_user_id=$1`,[row.referred_user_id]);
    await c.query('commit');return !!ins.rowCount
  }catch(e){await c.query('rollback');throw e}finally{c.release()}
}
async function refReconcileV98(id,{country=null,risk=null}={}){
  const u=await refUserV98(id);if(!u?.referred_by)return null;
  if(Number(u.referred_by)===Number(u.telegram_id)){await refBanV98(id,'self_referral');return{banned:true,reason:'self_referral'}}
  const badReason=String(u.referral_ineligible_reason||'').toLowerCase();
  if(u.device_blocked===true||u.referral_reward_eligible===false&&/(same.?device|multi|device|self)/.test(badReason)){await refBanV98(id,'multi_account_referral');return{banned:true,reason:'multi_account_referral'}}
  let row=await refEnsureRowV98(u,country);if(!row)return null;
  if(risk?.checked){
    const vpn=!!(risk.is_vpn||risk.is_proxy||risk.is_tor);
    await pool.query(`update public.referral_v2 set vpn_blocked=$2,proxy_detected=$3,tor_detected=$4,risk_checked_at=now(),status=case when $2 then 'vpn_blocked' when status='vpn_blocked' then 'pending' else status end,updated_at=now() where referred_user_id=$1`,[id,vpn,!!risk.is_proxy,!!risk.is_tor]);
    row=(await pool.query(`select * from public.referral_v2 where referred_user_id=$1`,[id])).rows[0];
  }
  if(row.vpn_blocked)return{vpn_blocked:true,row};
  if(!row.join_rewarded_at){await refCreditStageV98(row,'join',Number(row.join_reward_wiener||REF_JOIN_V98));row=(await pool.query(`select * from public.referral_v2 where referred_user_id=$1`,[id])).rows[0]}
  if(Number(u.total_ads||0)>=Number(row.required_ads||5)&&!row.completion_rewarded_at){await refCreditStageV98(row,'qualified',Number(row.completion_reward_wiener||0));row=(await pool.query(`select * from public.referral_v2 where referred_user_id=$1`,[id])).rows[0]}
  return{vpn_blocked:!!row.vpn_blocked,row}
}
async function referralDeviceCheckV98(req,id){const u=await refUserV98(id);if(!u?.referred_by)return null;const risk=await refIpRiskV98(req);return await refReconcileV98(id,{country:risk.country||refCountryHeaderV98(req)||null,risk})}
async function refSweepV98(){
  const started=await refStartedV98();if(!started)return;
  const q=await pool.query(`select u.telegram_id from public.users u left join public.referral_v2 r on r.referred_user_id=u.telegram_id where u.referred_by is not null and u.created_at>=$1 and (r.referred_user_id is null or (r.status not in ('rewarded','banned','vpn_blocked') and coalesce(u.total_ads,0)>=coalesce(r.required_ads,0))) order by u.created_at asc limit 250`,[started]);
  for(const x of q.rows){try{await refReconcileV98(Number(x.telegram_id),{})}catch(e){console.error('v98_referral_sweep_item',x.telegram_id,String(e?.message||e))}}
}
setTimeout(()=>refSweepV98().catch(e=>console.error('v98_referral_sweep',String(e?.message||e))),15000);
setInterval(()=>refSweepV98().catch(e=>console.error('v98_referral_sweep',String(e?.message||e))),60000).unref?.();

app.post('/functions/v1/wiener-referral-v2',async(req,res)=>{
  try{
    const b=req.body||{}, {id}=await edgeUser(b);await refSweepV98();
    const refs=(await pool.query(`select u.telegram_id,u.username,u.first_name,u.photo_url,u.total_ads,u.created_at,u.referral_reward_eligible,u.referral_ineligible_reason,r.country_code,r.tier,r.required_ads,r.join_reward_wiener,r.completion_reward_wiener,r.total_reward_wiener,r.status,r.vpn_blocked,r.ban_reason,r.join_rewarded_at,r.completion_rewarded_at from public.users u left join public.referral_v2 r on r.referred_user_id=u.telegram_id where u.referred_by=$1 order by u.created_at desc limit 100`,[id])).rows;
    const stats=(await pool.query(`select count(*)::int invited,count(*) filter(where r.completion_rewarded_at is not null)::int qualified,count(*) filter(where r.referred_user_id is not null and r.completion_rewarded_at is null and r.status not in ('banned'))::int pending,coalesce(sum(l.amount_wiener),0)::float8 earned from public.users u left join public.referral_v2 r on r.referred_user_id=u.telegram_id left join public.referral_v2_ledger l on l.referred_user_id=u.telegram_id and l.inviter_user_id=$1 where u.referred_by=$1`,[id])).rows[0]||{};
    const viewer=(await pool.query(`select vpn_blocked,status from public.referral_v2 where referred_user_id=$1 limit 1`,[id])).rows[0]||null;
    let leaderboard=null;try{leaderboard=await rpc('get_wiener_invite_leaderboards',[id])}catch{}
    return res.json({ok:true,data:{referrals:refs,stats:{invited:Number(stats.invited||0),qualified:Number(stats.qualified||0),pending:Number(stats.pending||0),earned:Number(stats.earned||0)},tiers:REF_TIERS_V98.map(x=>({tier:x.tier,label:x.label,total_wiener:x.total,required_ads:x.requiredAds,join_wiener:REF_JOIN_V98,completion_wiener:x.total-REF_JOIN_V98})),security:{vpn_detection_enabled:!!String(process.env.IPAPI_IS_KEY||'').trim(),viewer_vpn_blocked:!!viewer?.vpn_blocked},leaderboard}})
  }catch(e){console.error('v98_referral_status_failed',String(e?.message||e));return edgeFail(res,e)}
});

// Update the prepared Telegram share copy to match the new country-tier referral program.
const oldShareV98="caption:'💰 Earn up to $0.01 per referral\\n💸 Min withdraw $0.05\\n\\n👇 Click below to join WIENER Farm'";
// === END WIENER REFERRAL COUNTRY REWARDS V98 ===
'''
s=s[:pos]+code+s[pos:]
# Update existing prepared-share caption if present.
s=s.replace("caption:'💰 Earn up to $0.01 per referral\\n💸 Min withdraw $0.05\\n\\n👇 Click below to join WIENER Farm'","caption:'🌍 Earn $0.015–$0.03 per valid referral\\n✅ 100 WIENER after a verified join\\n🎯 Full reward after 5–10 valid ads\\n\\n👇 Join WIENER Farm'",1)
p.write_text(s)
print('V98 referral country rewards backend patch installed')
