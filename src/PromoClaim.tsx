import {useState} from 'react';
import {getInitData,SUPABASE_URL,type Snapshot} from './lib';
import {Home} from './pages';
import {AnimatedIcon} from './icons';

const PROMO_API=`${SUPABASE_URL}/functions/v1/wiener-promo`;
async function promoApi(action:string,body:any={}){
  const r=await fetch(PROMO_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,initData:getInitData(),...body})});
  const x=await r.json().catch(()=>({ok:false,error:'invalid_response'}));
  if(!r.ok||!x.ok)throw new Error(x.message||x.error||'Request failed');
  return x.data??x;
}

function PromoBox({data,refresh,say}:{data:Snapshot;refresh:any;say:any}){
  const [code,setCode]=useState(''),[busy,setBusy]=useState(false),[retry,setRetry]=useState(false);
  const claim=async()=>{
    const c=code.trim().toUpperCase(); if(!c||busy)return;
    try{
      setBusy(true);setRetry(false);
      const start=await promoApi('start',{code:c});
      const controller=window.Adsgram?.init({blockId:String(start.block_id)});
      if(!controller)throw new Error('AdsGram unavailable');
      await controller.show();
      await promoApi('client_complete',{session_id:start.session_id});
      let credited:any=null;
      for(let i=0;i<12;i++){
        const st=await promoApi('status',{session_id:start.session_id});
        if(st?.status==='credited'){credited=st;break}
        await new Promise(r=>setTimeout(r,1250));
      }
      if(!credited){setRetry(true);say('Ad not verified. Claim again.');return}
      say(`Promo claimed · +${Number(credited.reward_snapshot||credited.result?.reward||start.reward)} WIENER`);
      setCode(''); await refresh();
    }catch(e:any){
      const m=String(e?.message||'Promo claim failed');
      if(/already_claimed/i.test(m))say('Promo already claimed');
      else if(/invalid_code/i.test(m))say('Invalid promo code');
      else {setRetry(true);say(m)}
    }finally{setBusy(false)}
  };
  return <section className="card promo promo-v2"><div className="section-head"><div className="square mint"><AnimatedIcon name="ticket" active/></div><div><h3>Promo Code</h3><p>Watch the ad to unlock your reward</p></div></div><div className="promo-row"><input placeholder="ENTER CODE" value={code} disabled={busy} onChange={e=>setCode(e.target.value.toUpperCase())}/><button className="primary small" disabled={busy||!code.trim()} onClick={claim}>{busy?'VERIFYING…':retry?'CLAIM AGAIN':'CLAIM'}</button></div>{retry&&<div className="tiny center">Complete the rewarded ad, then your promo is credited automatically.</div>}</section>
}

export function HomeWithPromo({data,run,setTab,refresh,say}:{data:Snapshot;run:any;setTab:any;refresh:any;say:any}){
  return <><style>{`.card.promo:not(.promo-v2){display:none!important}`}</style><Home data={data} run={run} setTab={setTab}/><PromoBox data={data} refresh={refresh} say={say}/></>;
}
