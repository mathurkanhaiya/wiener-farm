#!/usr/bin/env python3
from pathlib import Path
import os

p=Path(os.environ.get('WIENER_BACKEND_FILE','/opt/wiener-backend/server.mjs'))
if not p.exists():
    alt=Path('/opt/wiener-backend/server.js')
    if alt.exists(): p=alt
if not p.exists(): raise SystemExit('ERROR: Wiener backend server file not found')
s=p.read_text()
TAG='WIENER OFFERS SURVEYS V96'
if TAG in s:
    print('V96 Offers & Surveys already installed')
    raise SystemExit(0)
for need in ['edgeUser','edgeFail','const pool','crypto','app.use((_req,res)=>']:
    if need not in s: raise SystemExit('ERROR: required backend primitive missing: '+need)
marker="\napp.use((_req,res)=>\n  res.status(404).json({ok:false,error:'route_not_enabled_yet'})\n);\n"
pos=s.rfind(marker)
if pos<0:
    fallback=s.rfind('app.use((_req,res)=>')
    if fallback<0: raise SystemExit('ERROR: final fallback route not found')
    pos=s.rfind('\n',0,fallback)

code=r'''

// === WIENER OFFERS SURVEYS V96 ===
let offersSetupPromiseV96=null;
function offersSetupV96(){
  if(offersSetupPromiseV96)return offersSetupPromiseV96;
  offersSetupPromiseV96=(async()=>{
    await pool.query(`create table if not exists public.offer_provider_users(
      provider text not null,
      telegram_id bigint not null references public.users(telegram_id) on delete cascade,
      external_uid text not null,
      created_at timestamptz not null default now(),
      primary key(provider,telegram_id),
      unique(provider,external_uid)
    )`);
    await pool.query(`create table if not exists public.offer_transactions(
      id bigserial primary key,
      telegram_id bigint not null references public.users(telegram_id) on delete cascade,
      provider text not null,
      kind text not null check(kind in ('offer','survey')),
      provider_tx_id text not null,
      provider_offer_id text,
      title text,
      provider_revenue_usd numeric(24,8) not null default 0,
      user_reward_usd numeric(24,8) not null default 0,
      user_reward_wiener numeric(24,4) not null default 0,
      platform_margin_usd numeric(24,8) not null default 0,
      status text not null default 'pending',
      country text,
      raw_callback jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      confirmed_at timestamptz,
      credited_at timestamptz,
      reversed_at timestamptz,
      unique(provider,provider_tx_id)
    )`);
    await pool.query(`create index if not exists offer_transactions_user_created_idx on public.offer_transactions(telegram_id,created_at desc)`);
    await pool.query(`create index if not exists offer_transactions_provider_status_idx on public.offer_transactions(provider,status,created_at desc)`);
  })().catch(e=>{offersSetupPromiseV96=null;throw e});
  return offersSetupPromiseV96;
}
const offerNumV96=(v,d=0)=>{const n=Number(v);return Number.isFinite(n)?n:d};
const offerSafeV96=v=>String(v??'').slice(0,500);
function offerCfgV96(){
  const shareDefault=Math.max(.1,Math.min(.95,offerNumV96(process.env.WIENER_OFFERS_USER_SHARE,.70)));
  const perUsd=Math.max(1,Math.min(1000000,offerNumV96(process.env.WIENER_PER_USD,20000)));
  const maxUsd=Math.max(.01,Math.min(10000,offerNumV96(process.env.WIENER_OFFERS_MAX_PAYOUT_USD,100)));
  const lootUrl=String(process.env.LOOTABLY_OFFERWALL_URL||'').trim();
  const lootSecret=String(process.env.LOOTABLY_POSTBACK_SECRET||'').trim();
  const bitToken=String(process.env.BITLABS_APP_TOKEN||'').trim();
  const bitSecret=String(process.env.BITLABS_APP_SECRET||'').trim();
  return{
    perUsd,maxUsd,
    lootably:{ready:!!lootUrl&&!!lootSecret,url:lootUrl,secret:lootSecret,share:Math.max(.1,Math.min(.95,offerNumV96(process.env.LOOTABLY_USER_SHARE,shareDefault)))},
    bitlabs:{ready:!!bitToken&&!!bitSecret,token:bitToken,secret:bitSecret,share:Math.max(.1,Math.min(.95,offerNumV96(process.env.BITLABS_USER_SHARE,shareDefault)))}
  };
}
async function offerUidV96(provider,id){
  const old=(await pool.query(`select external_uid from public.offer_provider_users where provider=$1 and telegram_id=$2 limit 1`,[provider,id])).rows[0]?.external_uid;
  if(old)return String(old);
  for(let i=0;i<5;i++){
    const uid='wf_'+crypto.randomBytes(18).toString('hex');
    try{await pool.query(`insert into public.offer_provider_users(provider,telegram_id,external_uid) values($1,$2,$3)`,[provider,id,uid]);return uid}catch(e){if(String(e?.code||'')!=='23505')throw e}
  }
  throw new Error('offer_user_id_failed');
}
async function offerUserFromUidV96(provider,uid){return Number((await pool.query(`select telegram_id from public.offer_provider_users where provider=$1 and external_uid=$2 limit 1`,[provider,uid])).rows[0]?.telegram_id||0)}
function appendQueryV96(raw,key,val){const sep=raw.includes('?')?'&':'?';return `${raw}${sep}${encodeURIComponent(key)}=${encodeURIComponent(val)}`}
function lootUrlV96(template,uid){
  if(/\{USER_ID\}|%USER_ID%|USER_ID/.test(template))return template.replace(/\{USER_ID\}|%USER_ID%|USER_ID/g,encodeURIComponent(uid));
  return appendQueryV96(template,'userID',uid);
}
function bitUrlV96(token,uid){const q=new URLSearchParams({uid,token,display_mode:'surveys',theme:'DARK',sdk:'TAB',in_app:'true'});return `https://web.bitlabs.ai/?${q.toString()}`}
function timingEqV96(a,b){try{const x=Buffer.from(String(a||'').toLowerCase()),y=Buffer.from(String(b||'').toLowerCase());return x.length===y.length&&crypto.timingSafeEqual(x,y)}catch{return false}}
async function creditOfferV96({provider,kind,txid,uid,revenue,offerId,title,country,raw,share}){
  await offersSetupV96();
  const id=await offerUserFromUidV96(provider,uid);if(!id)throw new Error('unknown_provider_user');
  const cfg=offerCfgV96();
  const gross=offerNumV96(revenue,-1);if(!(gross>0)||gross>cfg.maxUsd)throw new Error('invalid_provider_revenue');
  const rewardUsd=Math.floor(gross*share*100000000)/100000000;
  const rewardWiener=Math.floor(rewardUsd*cfg.perUsd*10000)/10000;
  if(!(rewardWiener>0))throw new Error('reward_too_small');
  const margin=Math.max(0,gross-rewardUsd);
  const c=await pool.connect();
  try{
    await c.query('begin');
    const existing=(await c.query(`select * from public.offer_transactions where provider=$1 and provider_tx_id=$2 for update`,[provider,txid])).rows[0];
    if(existing){await c.query('commit');return{duplicate:true,row:existing}}
    const row=(await c.query(`insert into public.offer_transactions(telegram_id,provider,kind,provider_tx_id,provider_offer_id,title,provider_revenue_usd,user_reward_usd,user_reward_wiener,platform_margin_usd,status,country,raw_callback,confirmed_at,credited_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'credited',$11,$12::jsonb,now(),now()) returning *`,[id,provider,kind,txid,offerId||null,title||null,gross,rewardUsd,rewardWiener,margin,country||null,JSON.stringify(raw||{})])).rows[0];
    const u=await c.query(`update public.users set balance=coalesce(balance,0)+$2,total_earned=coalesce(total_earned,0)+$2 where telegram_id=$1 returning balance`,[id,rewardWiener]);
    if(!u.rowCount)throw new Error('user_not_found');
    await c.query('commit');return{duplicate:false,row,balance:Number(u.rows[0].balance||0)};
  }catch(e){await c.query('rollback');throw e}finally{c.release()}
}
async function reverseOfferV96(provider,txid,raw={}){
  const c=await pool.connect();try{await c.query('begin');const row=(await c.query(`select * from public.offer_transactions where provider=$1 and provider_tx_id=$2 for update`,[provider,txid])).rows[0];if(!row||row.status==='reversed'){await c.query('commit');return{ignored:true}}const amt=Number(row.user_reward_wiener||0);await c.query(`update public.users set balance=greatest(0,coalesce(balance,0)-$2) where telegram_id=$1`,[row.telegram_id,amt]);await c.query(`update public.offer_transactions set status='reversed',reversed_at=now(),raw_callback=coalesce(raw_callback,'{}'::jsonb)||$3::jsonb where id=$1`,[row.id,amt,JSON.stringify({reversal:raw})]);await c.query('commit');return{reversed:true}}catch(e){await c.query('rollback');throw e}finally{c.release()}
}

app.post('/functions/v1/wiener-offers',async(req,res)=>{
  try{
    await offersSetupV96();const b=req.body||{}, {id}=await edgeUser(b),action=String(b.action||'status'),cfg=offerCfgV96();
    if(action==='status'){
      const h=(await pool.query(`select id,provider,kind,title,provider_revenue_usd::float8 provider_revenue_usd,user_reward_usd::float8 user_reward_usd,user_reward_wiener::float8 user_reward_wiener,status,created_at,credited_at from public.offer_transactions where telegram_id=$1 order by created_at desc limit 12`,[id])).rows;
      const totals=(await pool.query(`select coalesce(sum(user_reward_wiener) filter(where status='credited'),0)::float8 wiener,coalesce(sum(user_reward_usd) filter(where status='credited'),0)::float8 usd from public.offer_transactions where telegram_id=$1`,[id])).rows[0]||{};
      return res.json({ok:true,data:{providers:{lootably:{ready:cfg.lootably.ready,name:'Lootably',kind:'offerwall'},bitlabs:{ready:cfg.bitlabs.ready,name:'BitLabs',kind:'surveys'}},rate:{wiener_per_usd:cfg.perUsd},history:h,totals}});
    }
    if(action==='open'){
      const provider=String(b.provider||'').toLowerCase();if(!['lootably','bitlabs'].includes(provider))throw new Error('invalid_offer_provider');const pc=cfg[provider];if(!pc.ready)return res.status(503).json({ok:false,error:'provider_not_configured',message:`${provider==='lootably'?'Offerwall':'Surveys'} is being connected. Please check again soon.`});const uid=await offerUidV96(provider,id);const url=provider==='lootably'?lootUrlV96(pc.url,uid):bitUrlV96(pc.token,uid);return res.json({ok:true,data:{provider,url}})
    }
    throw new Error('unsupported_action');
  }catch(e){return edgeFail(res,e)}
});

app.get('/functions/v1/wiener-offers/lootably-callback',async(req,res)=>{
  try{
    await offersSetupV96();const cfg=offerCfgV96(),q=req.query||{};if(!cfg.lootably.secret)return res.status(503).send('0');
    const uid=offerSafeV96(q.userID||q.userId||q.user_id||q.uid),ip=String(q.ip||''),revRaw=String(q.revenue??''),curRaw=String(q.currencyReward??q.currency_reward??''),hash=String(q.hash||''),txid=offerSafeV96(q.transactionID||q.transactionId||q.transaction_id||q.tx),status=String(q.status??'1');
    if(!uid||!txid||!hash)return res.status(400).send('0');const want=crypto.createHash('sha256').update(`${uid}${ip}${revRaw}${curRaw}${cfg.lootably.secret}`).digest('hex');if(!timingEqV96(hash,want))return res.status(403).send('0');
    if(status==='0'||status==='-1'||Number(revRaw)<0){await reverseOfferV96('lootably',txid,q);return res.status(200).send('1')}
    await creditOfferV96({provider:'lootably',kind:'offer',txid,uid,revenue:revRaw,offerId:offerSafeV96(q.offerID||q.offerId||q.offer_id),title:offerSafeV96(q.offerName||q.offer_name),country:offerSafeV96(q.country||q.countryCode),raw:q,share:cfg.lootably.share});return res.status(200).send('1');
  }catch(e){console.error('lootably_callback_failed',String(e?.message||e));return res.status(400).send('0')}
});

app.get('/functions/v1/wiener-offers/bitlabs-callback',async(req,res)=>{
  try{
    await offersSetupV96();const cfg=offerCfgV96(),q=req.query||{};if(!cfg.bitlabs.secret)return res.status(503).send('0');
    const hash=String(q.hash||'');if(!hash)return res.status(400).send('0');const raw=String(req.originalUrl||'');let cut=raw.lastIndexOf('&hash=');if(cut<0)cut=raw.lastIndexOf('?hash=');if(cut<0)return res.status(400).send('0');const pathNoHash=raw.slice(0,cut);const host=String(req.headers['x-forwarded-host']||req.headers.host||'api.viralaitools.xyz').split(',')[0].trim();const proto=String(req.headers['x-forwarded-proto']||'https').split(',')[0].trim()||'https';const candidates=[`${proto}://${host}${pathNoHash}`,`https://${host}${pathNoHash}`];const valid=candidates.some(url=>timingEqV96(hash,crypto.createHmac('sha1',cfg.bitlabs.secret).update(url).digest('hex')));if(!valid)return res.status(403).send('0');
    const uid=offerSafeV96(q.uid||q.UID||q.user||q.user_id),txid=offerSafeV96(q.tx||q.TX||q.txid||q.transaction_id),usd=String(q.usd??q.USD??q.payout??q.value_usd??''),type=String(q.type||q.TYPE||'COMPLETE').toUpperCase();if(!uid||!txid)return res.status(400).send('0');
    if(/REJECT|REVERSE|CHARGEBACK|CANCEL/.test(type)||Number(usd)<0){await reverseOfferV96('bitlabs',txid,q);return res.status(200).send('1')}
    await creditOfferV96({provider:'bitlabs',kind:'survey',txid,uid,revenue:usd,offerId:offerSafeV96(q.survey_id||q.offer_id),title:offerSafeV96(q.survey_name||q.offer_name||'Paid Survey'),country:offerSafeV96(q.country||q.COUNTRY),raw:q,share:cfg.bitlabs.share});return res.status(200).send('1');
  }catch(e){console.error('bitlabs_callback_failed',String(e?.message||e));return res.status(400).send('0')}
});
'''
s=s[:pos]+code+s[pos:]
p.write_text(s)
print('V96 Offers & Surveys backend patch installed')
