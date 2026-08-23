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

      // Validate promo first and create a one-time claim session.
      const start=await promoApi('start',{code:c});

      // Show a normal AdsGram Rewarded ad using the official SDK.
      const controller=window.Adsgram?.init({blockId:String(start.block_id)});
      if(!controller)throw new Error('AdsGram rewarded ad unavailable');

      let rewarded=false;
      const onReward=()=>{rewarded=true};
      controller.addEventListener?.('onReward',onReward);

      try{
        const result=await controller.show();
        rewarded=rewarded||result?.done===true;
      } finally {
        controller.removeEventListener?.('onReward',onReward);
      }

      if(!rewarded){
        setRetry(true);
        say('Watch the full ad to unlock this promo reward.');
        return;
      }

      // Tell the backend only after AdsGram confirms the rewarded view client-side.
      await promoApi('client_complete',{session_id:start.session_id});

      let credited:any=null;
      for(let i=0;i<12;i++){
        const st=await promoApi('status',{session_id:start.session_id});
        if(st?.status==='credited'){credited=st;break}
        await new Promise(r=>setTimeout(r,1250));
      }
      if(!credited){setRetry(true);say('Ad completed — reward verification is still pending.');return}

      say(`Promo claimed · +${Number(credited.reward_snapshot||credited.result?.reward||start.reward)} WIENER`);
      setCode(''); await refresh();
    }catch(e:any){
      const m=String(e?.message||'Promo claim failed');
      if(/already_claimed/i.test(m))say('Promo already claimed');
      else if(/invalid_code/i.test(m))say('Invalid promo code');
      else {setRetry(true);say(m)}
    }finally{setBusy(false)}
  };

  return <section className="card promo promo-v2"><div className="section-head"><div className="square mint"><AnimatedIcon name="ticket" active/></div><div><h3>Promo Code</h3><p>Watch one rewarded ad to claim</p></div></div><div className="promo-row"><input placeholder="ENTER CODE" value={code} disabled={busy} onChange={e=>setCode(e.target.value.toUpperCase())}/><button className="primary small" disabled={busy||!code.trim()} onClick={claim}>{busy?'SHOWING AD…':retry?'CLAIM AGAIN':'CLAIM'}</button></div>{retry&&<div className="tiny center">Complete the rewarded ad, then your promo reward will be credited.</div>}</section>
}

export function HomeWithPromo({data,run,setTab,refresh,say}:{data:Snapshot;run:any;setTab:any;refresh:any;say:any}){
  return <><style>{`.card.promo:not(.promo-v2){display:none!important}`}</style><Home data={data} run={run} setTab={setTab}/><PromoBox data={data} refresh={refresh} say={say}/></>;
}
