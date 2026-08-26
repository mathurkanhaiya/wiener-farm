import {useEffect,useState} from 'react';
import {adApi,secondaryAdApi,type Snapshot} from './lib';
import {AnimatedIcon} from './icons';
import {trackAdInteraction} from './adInteraction';

const today=()=>new Date().toISOString().slice(0,10);
const COOLDOWN_KEY='wiener_adsgram_cooldown_until_v1';
const SECOND_COOLDOWN_KEY='wiener_bonus_ads_cooldown_until_v1';
const saved=(key:string)=>{try{return Number(localStorage.getItem(key)||0)}catch{return 0}};
type Source='main'|'secondary';

export function Ads({data,refresh,say}:{data:Snapshot;refresh:any;say:any}){
 const [busy,setBusy]=useState<Source|null>(null);
 const [cooldownUntil,setCooldownUntil]=useState(()=>saved(COOLDOWN_KEY));
 const [secondCooldownUntil,setSecondCooldownUntil]=useState(()=>saved(SECOND_COOLDOWN_KEY));
 const [now,setNow]=useState(Date.now());
 const [second,setSecond]=useState({used:0,limit:10,reward:5,block_id:'int-44228'});
 const [adsReady,setAdsReady]=useState(false);
 const [warningOpen,setWarningOpen]=useState(false);

 const s=data.settings,u=data.user;
 const used=u.ads_day===today()?Number(u.ads_watched_today):0;
 const cooldown=Math.max(0,Math.ceil((cooldownUntil-now)/1000));
 const secondCooldown=Math.max(0,Math.ceil((secondCooldownUntil-now)/1000));

 useEffect(()=>{
   let active=true;
   Promise.all([adApi('status').catch(()=>({cooldown_seconds:0})),secondaryAdApi('stats')]).then(([mainStatus,bonus]:any[])=>{
     if(!active)return;
     const left=Number(mainStatus?.cooldown_seconds||0);
     if(left>0){const until=Date.now()+left*1000;setCooldownUntil(until);try{localStorage.setItem(COOLDOWN_KEY,String(until))}catch{}}
     else if(saved(COOLDOWN_KEY)<=Date.now()){setCooldownUntil(0);try{localStorage.removeItem(COOLDOWN_KEY)}catch{}}
     setSecond(bonus);setAdsReady(true);
   }).catch(()=>{if(active){say('Unable to load ad progress');setAdsReady(true)}});
   return()=>{active=false};
 },[]);

 useEffect(()=>{
   if(!cooldownUntil&&!secondCooldownUntil)return;
   const id=setInterval(()=>{const t=Date.now();setNow(t);if(cooldownUntil&&t>=cooldownUntil){setCooldownUntil(0);try{localStorage.removeItem(COOLDOWN_KEY)}catch{}}if(secondCooldownUntil&&t>=secondCooldownUntil){setSecondCooldownUntil(0);try{localStorage.removeItem(SECOND_COOLDOWN_KEY)}catch{}}},500);
   return()=>clearInterval(id);
 },[cooldownUntil,secondCooldownUntil]);

 const setCooldown=(seconds=20)=>{const until=Date.now()+seconds*1000;setCooldownUntil(until);setNow(Date.now());try{localStorage.setItem(COOLDOWN_KEY,String(until))}catch{}};
 const setSecondCooldown=(seconds=20)=>{const until=Date.now()+seconds*1000;setSecondCooldownUntil(until);setNow(Date.now());try{localStorage.setItem(SECOND_COOLDOWN_KEY,String(until))}catch{}};

 const watch=async(source:Source)=>{
   if(busy)return;
   if(source==='main'&&!s.adsgram_block_id){say('Add AdsGram Block ID in Admin Settings');return}
   if(source==='main'&&cooldown>0){say(`Next ad in ${cooldown}s`);return}
   if(source==='secondary'&&secondCooldown>0){say(`Next ad in ${secondCooldown}s`);return}
   if(source==='main'&&used>=Number(s.daily_ad_limit||0)){say('Daily ad limit reached');return}
   if(source==='secondary'&&second.used>=second.limit){say('Daily ad limit reached');return}
   const interaction=trackAdInteraction();
   try{
     setBusy(source);setWarningOpen(false);
     if(source==='main'){
       const x=await adApi('start');const c=window.Adsgram?.init({blockId:String(x.block_id||s.adsgram_block_id)});if(!c)throw Error('AdsGram SDK unavailable');interaction.start();const result=await c.show();if(result&&result.done===false)throw Error(result.description||'Ad was not completed');if(!interaction.interacted()){setWarningOpen(true);return}const st=await adApi('complete',{session_id:x.session_id});if(st?.status!=='credited')throw Error('Reward could not be credited');setCooldown(Number(st.cooldown_seconds||20));say(`+${Number(st.reward||s.ad_reward||0)} WIENER`);
     }else{
       const x=await secondaryAdApi('start');const c=window.Adsgram?.init({blockId:String(x.block_id||'int-44228')});if(!c)throw Error('AdsGram SDK unavailable');interaction.start();const result=await c.show();if(result&&result.done===false)throw Error(result.description||'Ad was not completed');if(!interaction.interacted()){setWarningOpen(true);return}const st:any=await secondaryAdApi('reward',{session_id:x.session_id});const stats:any=await secondaryAdApi('stats');setSecond(stats);setSecondCooldown(20);say(`+${Number(st?.reward||5)} WIENER`);
     }
     await refresh();
   }catch(e:any){say(String(e?.message||'Ad was not completed'))}finally{interaction.stop();setBusy(null)}
 };

 const mainDisabled=Boolean(busy)||used>=Number(s.daily_ad_limit||0)||cooldown>0;
 const secondDisabled=Boolean(busy)||second.used>=second.limit||secondCooldown>0;
 if(!adsReady)return <><div className="page-title"><h2>ADS TASK</h2></div><div className="ads-unified-loading"><div className="card ad-card ad-skeleton"/><div className="card ad-card ad-skeleton"/></div><style>{`.ads-unified-loading{display:grid;gap:10px}.ad-skeleton{min-height:74px;position:relative;overflow:hidden}.ad-skeleton:after{content:'';position:absolute;inset:0;transform:translateX(-100%);background:linear-gradient(90deg,transparent,rgba(255,255,255,.06),transparent);animation:adShimmer 1s infinite}@keyframes adShimmer{to{transform:translateX(100%)}}`}</style></>;
 return <><div className="page-title"><h2>ADS TASK</h2></div><section className="card ad-card"><div className="square play"><AnimatedIcon name="ads" active={!mainDisabled}/></div><div className="grow"><h3>AdsGram — {s.daily_ad_limit} ads</h3><p>+{s.ad_reward} WIENER each · {used}/{s.daily_ad_limit} today</p></div><button className="primary small" disabled={mainDisabled} onClick={()=>watch('main')}>{busy==='main'?'…':cooldown>0?`${cooldown}s`:'WATCH'}</button></section><section className="card ad-card"><div className="square play"><AnimatedIcon name="ads" active={!secondDisabled}/></div><div className="grow"><h3>Bonus Ads — {second.limit} ads</h3><p>+5 WIENER each · {second.used}/{second.limit} today</p></div><button className="primary small" disabled={secondDisabled} onClick={()=>watch('secondary')}>{busy==='secondary'?'…':secondCooldown>0?`${secondCooldown}s`:'WATCH'}</button></section><div className="info-box">ⓘ Tap Visit, Play or Open inside the ad to unlock the reward.</div>
 {warningOpen&&<div className="cta-warning-overlay" role="dialog" aria-modal="true"><style>{`.cta-warning-overlay{position:fixed;inset:0;z-index:10050;display:grid;place-items:center;padding:28px;background:rgba(0,22,12,.72);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}.cta-warning-card{width:min(100%,300px);padding:18px 16px 16px;text-align:center;border:1.5px solid #ffd91a;border-radius:18px;background:linear-gradient(180deg,rgba(25,79,54,.98),rgba(11,61,39,.98));box-shadow:0 16px 45px rgba(0,0,0,.45)}.cta-warning-icon{width:44px;height:44px;margin:0 auto 13px;display:grid;place-items:center;border:1.5px solid rgba(255,217,26,.45);border-radius:12px;font-size:25px;color:#ffd91a}.cta-warning-title{margin:0 auto 16px;max-width:245px;font-size:16px;line-height:1.28;font-weight:900;letter-spacing:.15px;color:#ffd91a;text-transform:uppercase}.cta-warning-close{width:100%;min-height:42px;border:0;border-radius:11px;background:linear-gradient(180deg,#ffe54d,#ffc900);color:#211b00;font-size:14px;font-weight:900;letter-spacing:.3px;box-shadow:0 7px 18px rgba(255,205,0,.15)}`}</style><div className="cta-warning-card"><div className="cta-warning-icon">⚠</div><div className="cta-warning-title">YOU MUST CLICK ON ADS BANNER TO CLAIM REWARD</div><button className="cta-warning-close" onClick={()=>setWarningOpen(false)}>CLOSE</button></div></div>}
 </>;
}
