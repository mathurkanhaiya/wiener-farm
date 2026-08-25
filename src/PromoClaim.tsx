import {useState} from 'react';
import {getInitData,SUPABASE_URL,type Snapshot} from './lib';
import {Home} from './pages';
import {AnimatedIcon} from './icons';
import {HomeMissionCard} from './Missions';

const PROMO_API=`${SUPABASE_URL}/functions/v1/wiener-promo`;
async function promoApi(action:string,body:any={}){
  const r=await fetch(PROMO_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,initData:getInitData(),...body})});
  const x=await r.json().catch(()=>({ok:false,error:'invalid_response'}));
  if(!r.ok||!x.ok)throw new Error(x.message||x.error||'Request failed');
  return x.data??x;
}

function PromoBox({data,refresh,say}:{data:Snapshot;refresh:any;say:any}){
  const [code,setCode]=useState(''),[busy,setBusy]=useState(false),[retry,setRetry]=useState(false);
  const claim=async()=>{const c=code.trim().toUpperCase();if(!c||busy)return;try{setBusy(true);setRetry(false);const start=await promoApi('start',{code:c});const controller=window.Adsgram?.init({blockId:String(start.block_id||data.settings.adsgram_block_id)});if(!controller)throw new Error('AdsGram SDK unavailable');const result=await controller.show();if(result&&result.done===false)throw new Error(result.description||'Ad was not completed');const credited=await promoApi('client_complete',{session_id:start.session_id});if(credited?.status!=='credited')throw new Error('Promo reward confirmation failed');say(`Promo claimed · +${Number(credited.reward||start.reward)} WIENER`);setCode('');await refresh()}catch(e:any){const m=String(e?.message||e?.description||'Promo claim failed');if(/already_claimed/i.test(m))say('Promo already claimed');else if(/invalid_code/i.test(m))say('Invalid promo code');else if(/skip|not completed/i.test(m))say('Complete the rewarded ad to claim this promo.');else say(m);setRetry(true)}finally{setBusy(false)}};
  return <section className="card promo promo-v2"><div className="section-head"><div className="square mint"><AnimatedIcon name="ticket" active/></div><div><h3>Promo Code</h3><p>Watch one rewarded ad to claim</p></div></div><div className="promo-row"><input placeholder="ENTER CODE" value={code} disabled={busy} onChange={e=>setCode(e.target.value.toUpperCase())}/><button className="primary small" disabled={busy||!code.trim()} onClick={claim}>{busy?'SHOWING AD…':retry?'CLAIM AGAIN':'CLAIM'}</button></div>{retry&&<div className="tiny center">Complete the rewarded ad to unlock your promo reward.</div>}</section>;
}

export function HomeWithPromo({data,run,setTab,refresh,say}:{data:Snapshot;run:any;setTab:any;refresh:any;say:any}){
  return <div className="home-stack"><style>{`.home-stack{display:flex;flex-direction:column;min-width:0}.home-stack>.hero{order:1}.home-stack>.daily{order:2}.home-stack>.mission-home{order:3}.home-stack>.promo:not(.promo-v2){display:none!important}.home-stack>.promo-v2{order:4}.home-stack>.quick-grid{order:5}.home-stack>*{flex:0 0 auto}`}</style><Home data={data} run={run} setTab={setTab}/><HomeMissionCard setTab={setTab}/><PromoBox data={data} refresh={refresh} say={say}/></div>;
}
