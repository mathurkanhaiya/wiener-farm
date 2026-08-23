import {useEffect,useState} from 'react';
import {adApi,type Snapshot} from './lib';
import {AnimatedIcon} from './icons';

const today=()=>new Date().toISOString().slice(0,10);

export function Ads({data,refresh,say}:{data:Snapshot;refresh:any;say:any}){
  const [busy,setBusy]=useState(false),[session,setSession]=useState(''),[cooldownUntil,setCooldownUntil]=useState(0),[now,setNow]=useState(Date.now());
  const s=data.settings,u=data.user,used=u.ads_day===today()?Number(u.ads_watched_today):0;
  const cooldown=Math.max(0,Math.ceil((cooldownUntil-now)/1000));

  useEffect(()=>{
    if(!cooldownUntil)return;
    const id=setInterval(()=>setNow(Date.now()),500);
    return()=>clearInterval(id);
  },[cooldownUntil]);

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

  const disabled=busy||used>=s.daily_ad_limit||cooldown>0;
  const buttonText=busy?'VERIFYING…':cooldown>0?`${cooldown}s`:'WATCH';

  return <>
    <div className="page-title"><h2>ADS TASK <span>{used}/{s.daily_ad_limit}</span></h2></div>
    <section className="card ad-card">
      <div className="square play"><AnimatedIcon name="ads" active={!disabled}/></div>
      <div className="grow"><h3>AdsGram — {s.daily_ad_limit} ads</h3><p>+{s.ad_reward} WIENER each · {used}/{s.daily_ad_limit} today</p></div>
      <button className="primary small" disabled={disabled} onClick={watch}>{buttonText}</button>
    </section>
    <div className="info-box">ⓘ Complete an ad to receive WIENER. After a successful ad, the next ad unlocks in 20 seconds.</div>
    {session&&<div className="tiny center">Ad session: {session.slice(0,8)}…</div>}
  </>;
}
