const sleep=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
import {useEffect,useState} from 'react';
import {adApi,adUsageApi,secondaryAdApi,type Snapshot} from './lib';
import {AnimatedIcon} from './icons';
import {SpinEarn} from './SpinEarn';
import {DailyLottery} from './DailyLottery';
import {PromoBox} from './PromoClaim';
import {AmbassadorHomeCard} from './Ambassador';
// Direct WATCH flow: no intermediate claim popup; ad opens after loading.

const today=()=>new Date().toISOString().slice(0,10);
const COOLDOWN_KEY='wiener_adsgram_cooldown_until_v1';
const SECOND_COOLDOWN_KEY='wiener_bonus_ads_cooldown_until_v1';
const saved=(key:string)=>{try{return Number(localStorage.getItem(key)||0)}catch{return 0}};
type Source='main'|'secondary';
type Result={source:'secondary';reward:number};


export function Ads({data,refresh,say,setTab}:{data:Snapshot;refresh:any;say:any;setTab:(t:any)=>void}){
 const initialUsed=data.user?.ads_day===today()?Number(data.user?.ads_watched_today||0):0;
 const ECONOMY_AD_REWARD=10;
 const ECONOMY_DAILY_AD_LIMIT=15;
 const [busy,setBusy]=useState<Source|null>(null),[cooldownUntil,setCooldownUntil]=useState(()=>saved(COOLDOWN_KEY)),[secondCooldownUntil,setSecondCooldownUntil]=useState(()=>saved(SECOND_COOLDOWN_KEY)),[now,setNow]=useState(Date.now()),[used,setMainUsed]=useState(initialUsed),[second,setSecond]=useState({used:0,limit:10,reward:10,full_reward:10,block_id:'int-44228'}),[adsReady,setAdsReady]=useState(false),[result,setResult]=useState<Result|null>(null);
 const s=data.settings,cooldown=Math.max(0,Math.ceil((cooldownUntil-now)/1000)),secondCooldown=Math.max(0,Math.ceil((secondCooldownUntil-now)/1000));
 const syncMain=async()=>{const st:any=await adUsageApi();setMainUsed(Number(st?.used||0));const left=Number(st?.cooldown_seconds||0);if(left>0){const until=Date.now()+left*1000;setCooldownUntil(until);try{localStorage.setItem(COOLDOWN_KEY,String(until))}catch{}}else if(saved(COOLDOWN_KEY)<=Date.now()){setCooldownUntil(0);try{localStorage.removeItem(COOLDOWN_KEY)}catch{}}return st};
 useEffect(()=>{let active=true;Promise.all([adUsageApi(),secondaryAdApi('stats')]).then(([mainStatus,bonus]:any[])=>{if(!active)return;setMainUsed(Number(mainStatus?.used||0));const left=Number(mainStatus?.cooldown_seconds||0);if(left>0){const until=Date.now()+left*1000;setCooldownUntil(until);try{localStorage.setItem(COOLDOWN_KEY,String(until))}catch{}}else if(saved(COOLDOWN_KEY)<=Date.now()){setCooldownUntil(0);try{localStorage.removeItem(COOLDOWN_KEY)}catch{}}setSecond(bonus);setAdsReady(true)}).catch(()=>{if(active){say('Unable to load ad progress');setAdsReady(true)}});return()=>{active=false}},[]);
 useEffect(()=>{if(!cooldownUntil&&!secondCooldownUntil)return;const id=setInterval(()=>{const t=Date.now();setNow(t);if(cooldownUntil&&t>=cooldownUntil){setCooldownUntil(0);try{localStorage.removeItem(COOLDOWN_KEY)}catch{}}if(secondCooldownUntil&&t>=secondCooldownUntil){setSecondCooldownUntil(0);try{localStorage.removeItem(SECOND_COOLDOWN_KEY)}catch{}}},500);return()=>clearInterval(id)},[cooldownUntil,secondCooldownUntil]);
 const setCooldown=(seconds=20)=>{const until=Date.now()+seconds*1000;setCooldownUntil(until);setNow(Date.now());try{localStorage.setItem(COOLDOWN_KEY,String(until))}catch{}};
 const setSecondCooldown=(seconds=20)=>{const until=Date.now()+seconds*1000;setSecondCooldownUntil(until);setNow(Date.now());try{localStorage.setItem(SECOND_COOLDOWN_KEY,String(until))}catch{}};
 const finishSecondary=(st:any)=>setResult({source:'secondary',reward:Number(st?.reward||0)});

 const watch=async(src:Source)=>{if(busy)return;if(src==='main'&&!s.adsgram_block_id){say('Ads are temporarily unavailable');return}if(src==='main'&&cooldown>0){say(`Next ad in ${cooldown}s`);return}if(src==='secondary'&&secondCooldown>0){say(`Next ad in ${secondCooldown}s`);return}if(src==='secondary'&&second.used>=second.limit){say('Daily ad limit reached');return}try{setBusy(src);setResult(null);if(src==='main'){const x=await adApi('start');const c=window.Adsgram?.init({blockId:String(x.block_id||s.adsgram_block_id)});if(!c)throw Error('AdsGram SDK unavailable');const shown=await c.show();if(shown&&shown.done===false)throw Error(shown.description||'Ad was not completed');await adApi('complete',{session_id:x.session_id} as any);setCooldown(20);await syncMain().catch(()=>{});}else{const x=await secondaryAdApi('start');const c=window.Adsgram?.init({blockId:String(x.block_id||'int-44228')});if(!c)throw Error('AdsGram SDK unavailable');const shown=await c.show();if(shown&&shown.done===false)throw Error(shown.description||'Ad was not completed');const st:any=await secondaryAdApi('reward',{session_id:x.session_id} as any);const stats:any=await secondaryAdApi('stats');setSecond(stats);setSecondCooldown(20);finishSecondary(st);}await refresh()}catch(e:any){say(String(e?.message||'Ad was not completed'))}finally{setBusy(null)}};
 const mainLimit=Math.max(1,Number(s.daily_ad_limit||ECONOMY_DAILY_AD_LIMIT));
 const mainReward=ECONOMY_AD_REWARD;
 const mainAtLimit=used>=mainLimit,secondAtLimit=second.used>=second.limit;
 const mainDisabled=Boolean(busy)||mainAtLimit||cooldown>0,secondDisabled=Boolean(busy)||secondAtLimit||secondCooldown>0;
 if(!adsReady)return <><div className="page-title"><h2>EARN</h2></div><div className="ads-unified-loading"><div className="card ad-card ad-skeleton"/><div className="card ad-card ad-skeleton"/></div></>;
 const done=new Set((data.completed||[]).map((x:any)=>x.task_id));
 const tasks=(data.tasks||[]).filter((t:any)=>!done.has(t.id));
 const official=tasks.filter((t:any)=>String(t.category||'official').toLowerCase()==='official');
 const taskIcon=(t:any)=>{const h=String(t.title||'')+' '+String(t.description||'');const x=h.toLowerCase();return x.includes('group')?'👥':x.includes('bio')?'🪪':x.includes('pay')?'💸':x.includes('channel')?'📢':x.includes('x')||x.includes('twitter')?'𝕏':'✓'};
 const taskRow=(t:any)=><div className="wf-earn-task" key={t.id}><div className="wf-earn-task-icon">{taskIcon(t)}</div><div className="wf-earn-task-copy"><b>{t.title}</b><small>{t.description||'Complete this task to earn WIENER'}</small></div><strong><img src="https://pixlinkhost.vercel.app/i/YZEVHOSCqA" alt="" aria-hidden="true"/>+{t.reward}</strong><button className="wf-earn-task-open" onClick={()=>{if(t.url)window.Telegram?.WebApp?.openLink?.(t.url);setTimeout(()=>refresh(),800)}} aria-label={'Open '+t.title}>›</button></div>;
 return <div className="wf-earn-page">
   <header className="wf-earn-head"><div><span>COMPLETE &amp; COLLECT</span><h2>Earn</h2></div><div className="wf-earn-counter"><b>{used}</b><small>/{mainLimit} ads</small></div></header>
   <section className="wf-earn-section"><div className="wf-earn-section-head"><span><i/>WATCH &amp; EARN</span><small>{Math.max(0,mainLimit-used)} available</small></div><div className="wf-earn-ad-grid">
     {[1,2,3].map((n,i)=>{const limit=[7,10,5][i];const watched=Math.min(used,limit);const reward=mainReward*(i===0?2:1);return <button className="wf-earn-ad" key={n} disabled={mainDisabled} onClick={()=>watch('main')}><div className="wf-earn-ad-top"><span>AD #{n}</span><b>{watched}/{limit}</b></div><img className="wf-earn-eye" src="https://pixlinkhost.vercel.app/i/dfzvtrmcvA" alt="" aria-hidden="true"/><div className="wf-earn-reward"><img src="https://pixlinkhost.vercel.app/i/YZEVHOSCqA" alt="" aria-hidden="true"/><b>{reward}</b><small>WIENER</small></div><span className="wf-earn-watch">{mainAtLimit?'DONE':busy==='main'?'WAIT':cooldown>0?cooldown+'s':'WATCH'}</span></button>})}
   </div></section>
   <section className="wf-earn-section"><div className="wf-earn-section-head"><span><i/>SOCIAL TASKS</span><small>{official.length} available</small></div><div className="wf-earn-task-list">{official.length?official.map(taskRow):<div className="wf-earn-empty">No official tasks available right now.</div>}</div></section>
   <section className="wf-earn-section"><div className="wf-earn-section-head"><span><i/>SPIN &amp; EARN</span><small>Daily + bonus spins</small></div><SpinEarn refresh={refresh} say={say}/></section>
   <section className="wf-earn-section"><div className="wf-earn-section-head"><span><i/>BONUS EARN</span><small>{Math.max(0,second.limit-second.used)} available</small></div><div className="wf-earn-task"><div className="wf-earn-task-icon">⚡</div><div className="wf-earn-task-copy"><b>Bonus Ads</b><small>{second.full_reward||10} WIENER each · {second.used}/{second.limit} today</small></div><strong><img src="https://pixlinkhost.vercel.app/i/YZEVHOSCqA" alt="" aria-hidden="true"/>+{second.full_reward||10}</strong><button className="wf-earn-task-open" disabled={secondDisabled} onClick={()=>watch('secondary')} aria-label="Watch bonus ad">{secondAtLimit?'✓':secondCooldown?(secondCooldown+'s'):'›'}</button></div></section>
   <section className="wf-earn-section wf-earn-special-section"><div className="wf-earn-section-head"><span><i/>PROMO CODE</span><small>Claim a reward</small></div><PromoBox data={data} refresh={refresh} say={say}/></section>
   <section className="wf-earn-section wf-earn-special-section"><div className="wf-earn-section-head"><span><i/>AMBASSADOR PROGRAM</span><small>Earn USDT</small></div><AmbassadorHomeCard setTab={setTab}/></section>
   <div className="wf-earn-note">Rewards are added after the task or ad is verified.</div>
   {busy&&<div className="ad-loading-backdrop"><div className="ad-loading-card"><div className="ad-loader"/><h3>OPENING AD</h3><p>Complete the sponsor ad to receive your reward.</p></div></div>}
 </div>;
}
