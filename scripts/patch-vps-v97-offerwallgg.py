#!/usr/bin/env python3
from pathlib import Path
import os

p=Path(os.environ.get('WIENER_BACKEND_FILE','/opt/wiener-backend/server.mjs'))
if not p.exists():
    alt=Path('/opt/wiener-backend/server.js')
    if alt.exists(): p=alt
if not p.exists(): raise SystemExit('ERROR: Wiener backend server file not found')
s=p.read_text()
TAG='WIENER OFFERWALLGG V97'
if TAG in s:
    print('V97 Offerwall.GG already installed')
    raise SystemExit(0)
if 'WIENER OFFERS SURVEYS V96' not in s:
    raise SystemExit('ERROR: V96 offers backend is required first')
for need in ['offersSetupV96','offerUidV96','offerUserFromUidV96','timingEqV96','offerSafeV96']:
    if need not in s: raise SystemExit('ERROR: V96 primitive missing: '+need)

# Add Offerwall.GG to status payload.
old_status="providers:{lootably:{ready:cfg.lootably.ready,name:'Lootably',kind:'offerwall'},bitlabs:{ready:cfg.bitlabs.ready,name:'BitLabs',kind:'surveys'}}"
new_status="providers:{offerwallgg:{ready:offerwallGgCfgV97().ready,name:'Offerwall.GG',kind:'offerwall'},lootably:{ready:cfg.lootably.ready,name:'Lootably',kind:'offerwall'},bitlabs:{ready:cfg.bitlabs.ready,name:'BitLabs',kind:'surveys'}}"
if old_status not in s:
    raise SystemExit('ERROR: V96 provider status anchor not found')
s=s.replace(old_status,new_status,1)

# Add a special secure open path before legacy provider handling.
old_open="""if(action==='open'){
      const provider=String(b.provider||'').toLowerCase();if(!['lootably','bitlabs'].includes(provider))throw new Error('invalid_offer_provider');const pc=cfg[provider];if(!pc.ready)return res.status(503).json({ok:false,error:'provider_not_configured',message:`${provider==='lootably'?'Offerwall':'Surveys'} is being connected. Please check again soon.`});const uid=await offerUidV96(provider,id);const url=provider==='lootably'?lootUrlV96(pc.url,uid):bitUrlV96(pc.token,uid);return res.json({ok:true,data:{provider,url}})
    }"""
new_open="""if(action==='open'){
      const provider=String(b.provider||'').toLowerCase();
      if(provider==='offerwallgg'){
        const pc=offerwallGgCfgV97();
        if(!pc.ready)return res.status(503).json({ok:false,error:'provider_not_configured',message:'Offerwall.GG is being connected. Please check again soon.'});
        const uid=await offerUidV96('offerwallgg',id);
        return res.json({ok:true,data:{provider,url:offerwallGgUrlV97(pc,uid)}});
      }
      if(!['lootably','bitlabs'].includes(provider))throw new Error('invalid_offer_provider');const pc=cfg[provider];if(!pc.ready)return res.status(503).json({ok:false,error:'provider_not_configured',message:`${provider==='lootably'?'Offerwall':'Surveys'} is being connected. Please check again soon.`});const uid=await offerUidV96(provider,id);const url=provider==='lootably'?lootUrlV96(pc.url,uid):bitUrlV96(pc.token,uid);return res.json({ok:true,data:{provider,url}})
    }"""
if old_open not in s:
    raise SystemExit('ERROR: V96 open-provider anchor not found')
s=s.replace(old_open,new_open,1)

# Insert helpers + callback immediately before the V96 API route.
anchor="app.post('/functions/v1/wiener-offers',async(req,res)=>{"
pos=s.find(anchor)
if pos<0: raise SystemExit('ERROR: V96 API route anchor not found')

code=r'''// === WIENER OFFERWALLGG V97 ===
function offerwallGgCfgV97(){
  const publicKey=String(process.env.OFFERWALLGG_PUBLIC_KEY||'b8fc059c43b0558c2fb457aab937c3e1').trim();
  const secretKey=String(process.env.OFFERWALLGG_SECRET_KEY||'').trim();
  const perUsd=Math.max(1,Math.min(1000000,Number(process.env.WIENER_PER_USD||20000)||20000));
  return{publicKey,secretKey,perUsd,ready:!!publicKey&&!!secretKey};
}
function offerwallGgUrlV97(cfg,uid){
  const canonical=`appId=${cfg.publicKey}&userId=${uid}`;
  const signature=crypto.createHmac('sha256',cfg.secretKey).update(canonical).digest('hex');
  const q=new URLSearchParams({userId:uid,signature});
  return `https://offerwall.gg/wall/${encodeURIComponent(cfg.publicKey)}?${q.toString()}`;
}
async function offerwallGgCallbackV97(req,res){
  try{
    await offersSetupV96();
    const cfg=offerwallGgCfgV97(),q=req.query||{};
    if(!cfg.secretKey)return res.status(503).send('NOT_CONFIGURED');
    const uid=offerSafeV96(q.userId||q.user||q.user_id||q.subid);
    const txid=offerSafeV96(q.transactionId||q.tx||q.txid||q.trans_id);
    const amountRaw=String(q.currencyAmount??q.amount??q.points??q.reward??'');
    const sig=String(q.signature||q.sig||q.hash||'');
    const test=String(q.test||'0')==='1';
    if(!uid||!txid||!amountRaw||!sig)return res.status(400).send('BAD_REQUEST');
    const expected=crypto.createHmac('sha256',cfg.secretKey).update(`${uid}:${txid}:${amountRaw}`).digest('hex');
    if(!timingEqV96(sig,expected))return res.status(403).send('FORBIDDEN');
    if(test)return res.status(200).send('OK');
    const amount=Number(amountRaw),payoutUsd=Number(q.payoutUsd??q.payout_usd??0);
    if(!Number.isFinite(amount)||amount===0||Math.abs(amount)>100000000)return res.status(400).send('BAD_AMOUNT');
    const id=await offerUserFromUidV96('offerwallgg',uid);if(!id)return res.status(400).send('UNKNOWN_USER');
    const c=await pool.connect();
    try{
      await c.query('begin');
      const dup=(await c.query(`select id from public.offer_transactions where provider='offerwallgg' and provider_tx_id=$1 for update`,[txid])).rows[0];
      if(dup){await c.query('commit');return res.status(200).send('OK')}
      const status=String(q.status||'credited').toLowerCase();
      const reversed=status==='reversed'||amount<0;
      const userUsd=amount/cfg.perUsd;
      const grossUsd=Number.isFinite(payoutUsd)?payoutUsd:0;
      const marginUsd=grossUsd-userUsd;
      await c.query(`insert into public.offer_transactions(telegram_id,provider,kind,provider_tx_id,provider_offer_id,title,provider_revenue_usd,user_reward_usd,user_reward_wiener,platform_margin_usd,status,country,raw_callback,confirmed_at,credited_at,reversed_at) values($1,'offerwallgg','offer',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,now(),case when $9='credited' then now() else null end,case when $9='reversed' then now() else null end)`,[
        id,txid,offerSafeV96(q.offerId||q.offer_id)||null,offerSafeV96(q.offerName||q.offer_name)||'Offerwall.GG Offer',grossUsd,userUsd,amount,marginUsd,reversed?'reversed':'credited',offerSafeV96(q.country||q.countryCode)||null,JSON.stringify(q)
      ]);
      await c.query(`update public.users set balance=coalesce(balance,0)+$2,total_earned=greatest(0,coalesce(total_earned,0)+$2) where telegram_id=$1`,[id,amount]);
      await c.query('commit');
      return res.status(200).send('OK');
    }catch(e){await c.query('rollback');throw e}finally{c.release()}
  }catch(e){console.error('offerwallgg_callback_failed',String(e?.message||e));return res.status(400).send('ERROR')}
}
app.get('/functions/v1/wiener-offers/offerwallgg-callback',offerwallGgCallbackV97);

'''
s=s[:pos]+code+s[pos:]
p.write_text(s)
print('V97 Offerwall.GG backend patch installed')
