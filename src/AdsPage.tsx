import {useEffect,useState} from 'react';
import {adApi,type Snapshot} from './lib';
import {AnimatedIcon} from './icons';

const today=()=>new Date().toISOString().slice(0,10);
const COOLDOWN_KEY='wiener_adsgram_cooldown_until_v1';
const savedCooldown=()=>{try{return Number(localStorage.getItem(COOLDOWN_KEY)||0)}catch{return 0}};

type ClaimState='ready'|'showing'|'crediting'|'success'|'failed';

export function Ads({data,refresh,say}:{data:Snapshot;refresh:any;say:any}){
  const [busy,setBusy]=useState(false),[session,setSession]=useState(''),[cooldownUntil,setCooldownUntil]=useState(savedCooldown),[now,setNow]=useState(Date.now());
  const [claimOpen,setClaimOpen]=useState(false),[claimState,setClaimState]=useState<ClaimState>('ready');
  const [claimReward,setClaimReward]=useState(Number(data.settings.ad_reward||0)),[claimBalance,setClaimBalance]=useState<number|null>(null),[claimError,setClaimError]=useState('');
  const s=data.settings,u=data.user,used=u.ads_day===today()?Number(u.ads_watched_today):0;
  const cooldown=Math.max(0,Math.ceil((cooldownUntil-now)/1000));

  useEffect(()=>{
    let active=true;
    adApi('status').then((x:any)=>{
      if(!active)return;
      const left=Number(x?.cooldown_seconds||0);
      if(left>0){
        const until=Date.now()+left*1000;
        setCooldownUntil(until);
        try{localStorage.setItem(COOLDOWN_KEY,String(until))}catch{}
      }else if(savedCooldown()<=Date.now()){
        setCooldownUntil(0);
        try{localStorage.removeItem(COOLDOWN_KEY)}catch{}
      }
    }).catch(()=>{});
    return()=>{active=false};
  },[]);

  useEffect(()=>{
    if(!cooldownUntil)return;
    const id=setInterval(()=>{
      const t=Date.now();
      setNow(t);
      if(t>=cooldownUntil){
        setCooldownUntil(0);
        try{localStorage.removeItem(COOLDOWN_KEY)}catch{}
      }
    },500);
    return()=>clearInterval(id);
  },[cooldownUntil]);

  useEffect(()=>setClaimReward(Number(s.ad_reward||0)),[s.ad_reward]);

  const setCooldown=(seconds=20)=>{
    const until=Date.now()+seconds*1000;
    setCooldownUntil(until);
    setNow(Date.now());
    try{localStorage.setItem(COOLDOWN_KEY,String(until))}catch{}
  };

  const openClaim=()=>{
    if(!s.adsgram_block_id){say('Add AdsGram Block ID in Admin Settings');return}
    if(cooldown>0){say(`Next ad in ${cooldown}s`);return}
    if(used>=Number(s.daily_ad_limit||0)){say('Daily ad limit reached');return}
    setClaimState('ready');
    setClaimError('');
    setClaimBalance(null);
    setClaimReward(Number(s.ad_reward||0));
    setClaimOpen(true);
  };

  const closeClaim=()=>{
    if(busy)return;
    setClaimOpen(false);
    setClaimState('ready');
    setClaimError('');
  };

  const watch=async()=>{
    if(busy)return;
    if(!s.adsgram_block_id){say('Add AdsGram Block ID in Admin Settings');return}
    if(cooldown>0){say(`Next ad in ${cooldown}s`);return}
    try{
      setBusy(true);
      setClaimError('');
      setClaimState('showing');
      const x=await adApi('start');
      setSession(x.session_id);
      const c=window.Adsgram?.init({blockId:String(x.block_id||s.adsgram_block_id)});
      if(!c)throw Error('AdsGram SDK unavailable');
      const result=await c.show();
      if(result&&result.done===false)throw Error(result.description||'Ad was not completed');

      setClaimState('crediting');
      const st=await adApi('complete',{session_id:x.session_id});
      if(st?.status!=='credited')throw Error('Reward could not be credited');
      setClaimReward(Number(st.reward||s.ad_reward||0));
      setClaimBalance(st.balance==null?null:Number(st.balance));
      setClaimState('success');
      setCooldown(Number(st.cooldown_seconds||20));
      await refresh();
    }catch(e:any){
      setClaimError(String(e?.message||'Ad was not completed'));
      setClaimState('failed');
    }finally{
      setBusy(false);
    }
  };

  const retry=()=>{
    if(busy)return;
    setClaimError('');
    setClaimState('ready');
    setSession('');
  };

  const disabled=busy||used>=s.daily_ad_limit||cooldown>0;
  const buttonText=busy?'WAIT…':cooldown>0?`${cooldown}s`:'WATCH';

  return <>
    <div className="page-title"><h2>ADS TASK <span>{used}/{s.daily_ad_limit}</span></h2></div>
    <section className="card ad-card">
      <div className="square play"><AnimatedIcon name="ads" active={!disabled}/></div>
      <div className="grow"><h3>AdsGram — {s.daily_ad_limit} ads</h3><p>+{s.ad_reward} WIENER each · {used}/{s.daily_ad_limit} today</p></div>
      <button className="primary small" disabled={disabled} onClick={openClaim}>{buttonText}</button>
    </section>
    <div className="info-box">ⓘ Watch the rewarded ad to receive WIENER. After a successful ad, the next ad unlocks in 20 seconds.</div>

    {claimOpen&&<div className="ad-claim-overlay" role="dialog" aria-modal="true" aria-label="Claim ad reward">
      <style>{`
        .ad-claim-overlay{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(4,8,10,.72);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}
        .ad-claim-modal{width:min(100%,420px);padding:22px;border:1px solid rgba(255,255,255,.12);border-radius:28px;background:linear-gradient(155deg,rgba(20,28,30,.94),rgba(8,13,15,.92));box-shadow:0 22px 70px rgba(0,0,0,.48),inset 0 1px rgba(255,255,255,.06)}
        .ad-claim-head{text-align:center;margin-bottom:16px}.ad-claim-icon{width:62px;height:62px;margin:0 auto 13px;display:grid;place-items:center;border-radius:20px;background:rgba(255,255,255,.06);box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)}
        .ad-claim-head h3{margin:0;font-size:22px;letter-spacing:-.3px}.ad-claim-head p{margin:7px 0 0;font-size:13px;opacity:.62}
        .ad-claim-reward{margin:14px 0;padding:16px;text-align:center;border:1px solid rgba(255,255,255,.09);border-radius:20px;background:rgba(255,255,255,.035)}
        .ad-claim-reward span{display:block;font-size:11px;opacity:.55;margin-bottom:4px}.ad-claim-reward strong{font-size:25px}
        .ad-claim-note{display:flex;gap:12px;align-items:flex-start;margin:14px 0;padding:15px;border:1px solid rgba(255,255,255,.1);border-radius:20px;background:rgba(255,255,255,.045)}
        .ad-claim-hand{font-size:23px;line-height:1}.ad-claim-note strong{display:block;font-size:14px;margin-bottom:4px}.ad-claim-note small{display:block;line-height:1.45;opacity:.62}
        .ad-claim-actions{display:grid;gap:10px}.ad-claim-actions button{width:100%;min-height:48px;border-radius:16px}
        .ad-claim-cancel{border:1px solid rgba(255,255,255,.1);background:transparent;color:inherit;opacity:.75}
        .ad-claim-status{text-align:center;padding:22px 8px 10px}.ad-claim-status .big{font-size:36px;margin-bottom:9px}.ad-claim-status h3{margin:0 0 7px}.ad-claim-status p{margin:0 0 16px;font-size:13px;opacity:.65;line-height:1.5}.ad-claim-success strong{display:block;font-size:28px;margin:7px 0}.ad-claim-success small{opacity:.6}
        .ad-claim-spinner{width:42px;height:42px;margin:4px auto 16px;border:3px solid rgba(255,255,255,.12);border-top-color:currentColor;border-radius:50%;animation:adClaimSpin .8s linear infinite}@keyframes adClaimSpin{to{transform:rotate(360deg)}}
      `}</style>
      <div className="ad-claim-modal">
        {(claimState==='ready'||claimState==='showing')&&<>
          <div className="ad-claim-head">
            <div className="ad-claim-icon"><AnimatedIcon name="ads" active/></div>
            <h3>CLAIM AD REWARD</h3>
            <p>Watch the rewarded ad to receive your WIENER.</p>
          </div>
          <div className="ad-claim-reward"><span>REWARD</span><strong>+{claimReward} WIENER</strong></div>
          <div className="ad-claim-note"><div className="ad-claim-hand">▶️</div><div><strong>Complete the ad</strong><small>Keep the ad open until AdsGram reports it as completed.</small></div></div>
          <div className="ad-claim-actions">
            <button className="primary" disabled={busy} onClick={watch}>{busy?'SHOWING AD…':'WATCH AD TO CLAIM'}</button>
            <button className="ad-claim-cancel" disabled={busy} onClick={closeClaim}>Cancel</button>
          </div>
        </>}

        {claimState==='crediting'&&<div className="ad-claim-status">
          <div className="ad-claim-spinner"/>
          <h3>CREDITING REWARD…</h3>
          <p>Adding your completed ad reward.</p>
        </div>}

        {claimState==='success'&&<div className="ad-claim-status ad-claim-success">
          <div className="big">✅</div>
          <h3>REWARD CLAIMED</h3>
          <strong>+{claimReward} WIENER</strong>
          {claimBalance!=null&&<small>Balance: {claimBalance.toLocaleString()} WIENER</small>}
          <p style={{marginTop:12}}>Next ad unlocks in 20 seconds.</p>
          <div className="ad-claim-actions"><button className="primary" onClick={closeClaim}>DONE</button></div>
        </div>}

        {claimState==='failed'&&<div className="ad-claim-status">
          <div className="big">⚠️</div>
          <h3>AD NOT COMPLETED</h3>
          <p>{claimError||'Complete the rewarded ad and try again.'}</p>
          <div className="ad-claim-actions"><button className="primary" onClick={retry}>TRY AGAIN</button><button className="ad-claim-cancel" onClick={closeClaim}>Cancel</button></div>
        </div>}
      </div>
    </div>}
  </>;
}
