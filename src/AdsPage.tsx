import {useEffect,useRef,useState} from 'react';
import {TadsWidget,renderTadsWidget} from 'react-tads-widget';
import {adApi,getInitData,SUPABASE_URL,type Snapshot} from './lib';
import {AnimatedIcon} from './icons';

const today=()=>new Date().toISOString().slice(0,10);
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const TADS_API=`${SUPABASE_URL}/functions/v1/wiener-tads`;
const TADS_WIDGET='11691';

async function tadsApi(action:string,body:any={}){
  const r=await fetch(TADS_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,initData:getInitData(),...body})});
  const x=await r.json().catch(()=>({ok:false,error:'invalid_response'}));
  if(!r.ok||!x.ok)throw new Error(x.message||x.error||'TADS request failed');
  return x.data??x;
}

export function Ads({data,refresh,say}:{data:Snapshot;refresh:any;say:any}){
  const [busy,setBusy]=useState(false),[session,setSession]=useState(''),[cooldownUntil,setCooldownUntil]=useState(0),[now,setNow]=useState(Date.now());
  const [tadsBusy,setTadsBusy]=useState(false),[tadsUsed,setTadsUsed]=useState(0);
  const tadsSession=useRef('');
  const s=data.settings,u=data.user,used=u.ads_day===today()?Number(u.ads_watched_today):0;
  const cooldown=Math.max(0,Math.ceil((cooldownUntil-now)/1000));

  useEffect(()=>{
    tadsApi('stats').then(x=>setTadsUsed(Number(x.used||0))).catch(()=>{});
  },[]);

  useEffect(()=>{
    if(!cooldownUntil)return;
    const id=setInterval(()=>setNow(Date.now()),500);
    return()=>clearInterval(id);
  },[cooldownUntil]);

  const waitForVerification=async(sessionId:string)=>{
    for(let i=0;i<12;i++){
      const st=await adApi('status',{session_id:sessionId});
      if(st?.status==='verified'||st?.status==='credited')return st;
      await sleep(750);
    }
    throw new Error('AdsGram verification not received. Please try again.');
  };

  const watch=async()=>{
    if(!s.adsgram_block_id){say('Add AdsGram Block ID in Admin Settings');return}
    if(cooldown>0){say(`Next ad in ${cooldown}s`);return}
    try{
      setBusy(true);
      const x=await adApi('start');
      setSession(x.session_id);
      const c=window.Adsgram?.init({blockId:String(x.block_id||s.adsgram_block_id)});
      if(!c)throw Error('AdsGram SDK unavailable');
      const result=await c.show();
      if(result&&result.done===false)throw Error(result.description||'Ad was not completed');
      await waitForVerification(x.session_id);
      const st=await adApi('complete',{session_id:x.session_id});
      if(st?.status!=='credited')throw Error('Reward confirmation failed');
      say(`+${st.reward||s.ad_reward} WIENER`);
      setCooldownUntil(Date.now()+20000);
      setNow(Date.now());
      await refresh();
    }catch(e:any){
      say(e?.message||'Ad failed');
    }finally{
      setBusy(false);
    }
  };

  const watchTads=async()=>{
    if(tadsBusy||tadsUsed>=10)return;
    try{
      setTadsBusy(true);
      const x=await tadsApi('start');
      tadsSession.current=String(x.session_id);
      renderTadsWidget({id:TADS_WIDGET,type:'static'});
    }catch(e:any){
      setTadsBusy(false);
      const m=String(e?.message||'TADS unavailable');
      say(/daily_limit/i.test(m)?'TADS daily limit reached':m);
    }
  };

  const rewardTads=async()=>{
    const sid=tadsSession.current;
    if(!sid){setTadsBusy(false);return}
    tadsSession.current='';
    try{
      const x=await tadsApi('reward',{session_id:sid});
      if(x?.status!=='credited')throw new Error('TADS reward confirmation failed');
      setTadsUsed(v=>Math.min(10,v+1));
      say(`+${Number(x.reward||5)} WIENER`);
      await refresh();
    }catch(e:any){say(e?.message||'TADS reward failed')}
    finally{setTadsBusy(false)}
  };

  const noTads=()=>{
    tadsSession.current='';
    setTadsBusy(false);
    say('No TADS ad available right now');
  };

  const disabled=busy||used>=s.daily_ad_limit||cooldown>0;
  const buttonText=busy?'VERIFYING…':cooldown>0?`${cooldown}s`:'WATCH';

  return <>
    <div className="page-title"><h2>ADS TASK <span>{used}/{s.daily_ad_limit}</span></h2></div>
    <section className="card ad-card">
      <div className="square play"><AnimatedIcon name="ads" active={!disabled}/></div>
      <div className="grow"><h3>AdsGram — {s.daily_ad_limit} ads</h3><p>+{s.ad_reward} WIENER each · {used}/{s.daily_ad_limit} today</p></div>
      <button className="primary small" disabled={disabled} onClick={watch}>{buttonText}</button>
    </section>
    <div className="info-box">ⓘ Reward is credited only after the server receives AdsGram verification. After a successful ad, the next ad unlocks in 20 seconds.</div>
    {session&&<div className="tiny center">Ad session: {session.slice(0,8)}…</div>}

    <section className="card ad-card">
      <div className="square play"><AnimatedIcon name="ads" active={!tadsBusy&&tadsUsed<10}/></div>
      <div className="grow"><h3>TADS TGB — 10 ads</h3><p>+5 WIENER per click · {tadsUsed}/10 today</p></div>
      <button className="primary small" disabled={tadsBusy||tadsUsed>=10} onClick={watchTads}>{tadsBusy?'LOADING…':tadsUsed>=10?'DONE':'SHOW AD'}</button>
    </section>
    <TadsWidget id={TADS_WIDGET} type="static" debug={false} onClickReward={rewardTads} onAdsNotFound={noTads}/>
    <div className="info-box">ⓘ TADS TGB · Widget #11691 · 5 WIENER after a rewarded ad click · maximum 10 per day.</div>
  </>;
}
