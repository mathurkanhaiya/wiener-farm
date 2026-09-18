import {useEffect,useState} from 'react';
import {adApi,adUsageApi,secondaryAdApi,type Snapshot} from './lib';
import {AnimatedIcon} from './icons';
import {SpinEarn} from './SpinEarn';
import {DailyLottery} from './DailyLottery';
// Direct WATCH flow: no intermediate claim popup; ad opens after loading.

const today=()=>new Date().toISOString().slice(0,10);
const COOLDOWN_KEY='wiener_adsgram_cooldown_until_v1';
const SECOND_COOLDOWN_KEY='wiener_bonus_ads_cooldown_until_v1';
const saved=(key:string)=>{try{return Number(localStorage.getItem(key)||0)}catch{return 0}};
type Source='main'|'secondary';
type Result={source:'secondary';reward:number};


export function Ads({data,refresh,say}:{data:Snapshot;refresh:any;say:any}){
 const initialUsed=data.user?.ads_day===today()?Number(data.user?.ads_watched_today||0):0;
 const [busy,setBusy]=useState<Source|null>(null),[cooldownUntil,setCooldownUntil]=useState(()=>saved(COOLDOWN_KEY)),[secondCooldownUntil,setSecondCooldownUntil]=useState(()=>saved(SECOND_COOLDOWN_KEY)),[now,setNow]=useState(Date.now()),[mainUsed,setMainUsed]=useState(initialUsed),[second,setSecond]=useState({used:0,limit:10,reward:10,full_reward:10,block_id:'int-44228'}),[adsReady,setAdsReady]=useState(false),[result,setResult]=useState<Result|null>(null);
 const s=data.settings,used=mainUsed,cooldown=Math.max(0,Math.ceil((cooldownUntil-now)/1000)),secondCooldown=Math.max(0,Math.ceil((secondCooldownUntil-now)/1000));
 const syncMain=async()=>{const st:any=await adUsageApi();setMainUsed(Number(st?.used||0));const left=Number(st?.cooldown_seconds||0);if(left>0){const until=Date.now()+left*1000;setCooldownUntil(until);try{localStorage.setItem(COOLDOWN_KEY,String(until))}catch{}}else if(saved(COOLDOWN_KEY)<=Date.now()){setCooldownUntil(0);try{localStorage.removeItem(COOLDOWN_KEY)}catch{}}return st};
 useEffect(()=>{let active=true;Promise.all([adUsageApi(),secondaryAdApi('stats')]).then(([mainStatus,bonus]:any[])=>{if(!active)return;setMainUsed(Number(mainStatus?.used||0));const left=Number(mainStatus?.cooldown_seconds||0);if(left>0){const until=Date.now()+left*1000;setCooldownUntil(until);try{localStorage.setItem(COOLDOWN_KEY,String(until))}catch{}}else if(saved(COOLDOWN_KEY)<=Date.now()){setCooldownUntil(0);try{localStorage.removeItem(COOLDOWN_KEY)}catch{}}setSecond(bonus);setAdsReady(true)}).catch(()=>{if(active){say('Unable to load ad progress');setAdsReady(true)}});return()=>{active=false}},[]);
 useEffect(()=>{if(!cooldownUntil&&!secondCooldownUntil)return;const id=setInterval(()=>{const t=Date.now();setNow(t);if(cooldownUntil&&t>=cooldownUntil){setCooldownUntil(0);try{localStorage.removeItem(COOLDOWN_KEY)}catch{}}if(secondCooldownUntil&&t>=secondCooldownUntil){setSecondCooldownUntil(0);try{localStorage.removeItem(SECOND_COOLDOWN_KEY)}catch{}}},500);return()=>clearInterval(id)},[cooldownUntil,secondCooldownUntil]);
 const setCooldown=(seconds=20)=>{const until=Date.now()+seconds*1000;setCooldownUntil(until);setNow(Date.now());try{localStorage.setItem(COOLDOWN_KEY,String(until))}catch{}};
 const setSecondCooldown=(seconds=20)=>{const until=Date.now()+seconds*1000;setSecondCooldownUntil(until);setNow(Date.now());try{localStorage.setItem(SECOND_COOLDOWN_KEY,String(until))}catch{}};
 const finishSecondary=(st:any)=>setResult({source:'secondary',reward:Number(st?.reward||0)});

 const watch=async(src:Source)=>{if(busy)return;if(src==='main'&&!s.adsgram_block_id){say('Ads are temporarily unavailable');return}if(src==='main'&&cooldown>0){say(`Next ad in ${cooldown}s`);return}if(src==='secondary'&&secondCooldown>0){say(`Next ad in ${secondCooldown}s`);return}if(src==='secondary'&&second.used>=second.limit){say('Daily ad limit reached');return}try{setBusy(src);setResult(null);if(src==='main'){const x=await adApi('start');const c=window.Adsgram?.init({blockId:String(x.block_id||s.adsgram_block_id)});if(!c)throw Error('AdsGram SDK unavailable');const shown=await c.show();if(shown&&shown.done===false)throw Error(shown.description||'Ad was not completed');await adApi('complete',{session_id:x.session_id} as any);setCooldown(20);await syncMain().catch(()=>{});}else{const x=await secondaryAdApi('start');const c=window.Adsgram?.init({blockId:String(x.block_id||'int-44228')});if(!c)throw Error('AdsGram SDK unavailable');const shown=await c.show();if(shown&&shown.done===false)throw Error(shown.description||'Ad was not completed');const st:any=await secondaryAdApi('reward',{session_id:x.session_id} as any);const stats:any=await secondaryAdApi('stats');setSecond(stats);setSecondCooldown(20);finishSecondary(st);}await refresh()}catch(e:any){say(String(e?.message||'Ad was not completed'))}finally{setBusy(null)}};
 const mainAtLimit=false,secondAtLimit=second.used>=second.limit;
 const mainDisabled=Boolean(busy)||mainAtLimit||cooldown>0,secondDisabled=Boolean(busy)||secondAtLimit||secondCooldown>0;
 if(!adsReady)return <><div className="wf-section-head"><h2>Ads Task</h2><span>Daily rewards</span></div><div className="ads-unified-loading"><div className="card ad-card ad-skeleton"/></div></>;
 const limit=Math.max(1,Number(s.daily_ad_limit||50));
 const progress=Math.min(100,(used/limit)*100);
 return <><style>{`
.wf-section-head{display:flex;align-items:center;justify-content:space-between;margin:22px 2px 14px;padding-left:16px;position:relative}.wf-section-head:before{content:"";position:absolute;left:0;width:5px;height:31px;border-radius:5px;background:#ff9d12;box-shadow:0 0 12px rgba(255,157,18,.35)}.wf-section-head h2{margin:0;font-size:24px;text-transform:none}.wf-section-head span{font-size:13px;opacity:.62}
.wf-main-ad{padding:22px 20px 20px!important;border-radius:27px!important;background:radial-gradient(circle at 82% 8%,rgba(255,171,33,.10),transparent 40%),linear-gradient(145deg,rgba(51,38,18,.90),rgba(18,27,20,.96))!important;border:1px solid rgba(255,171,33,.20)!important}
.wf-ad-top{display:flex;gap:16px;align-items:center}.wf-ad-icon{width:72px;height:72px;display:grid;place-items:center;flex:0 0 72px}.wf-ad-icon .square{width:72px;height:72px;background:transparent!important;border:0!important}.wf-ad-copy h3{margin:0 0 4px;font-size:24px}.wf-ad-copy p{margin:0;font-size:14px;opacity:.62}.wf-reward-pill{display:inline-flex;margin:18px 0 20px;padding:10px 14px;border-radius:14px;border:1px solid rgba(255,178,52,.22);background:rgba(86,58,18,.22);font-weight:900;color:#ffd079}.wf-progress-row{display:flex;justify-content:space-between;font-size:13px;margin-bottom:8px;opacity:.72}.wf-progress-row b{opacity:1;color:#fff}.wf-progress{height:8px;border-radius:20px;background:rgba(255,255,255,.07);overflow:hidden;margin-bottom:18px}.wf-progress>i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#ff9700,#ffd56b)}.wf-watch{width:100%;min-height:58px!important;border-radius:18px!important;font-size:17px!important}.wf-earn-head{margin-top:26px}.wf-spin-wrap .spin-earn-card{margin-top:0!important}.ad-loading-backdrop{position:fixed;inset:0;z-index:10060;display:grid;place-items:center;padding:28px;background:rgba(4,12,9,.76);backdrop-filter:blur(12px)}.ad-loading-card{width:min(100%,310px);padding:22px 18px 18px;border:1px solid rgba(255,255,255,.12);border-radius:22px;background:linear-gradient(160deg,rgba(24,62,45,.98),rgba(7,38,27,.98));text-align:center}.ad-loader{width:42px;height:42px;margin:0 auto 14px;border:4px solid rgba(255,255,255,.15);border-top-color:#ffe33b;border-radius:50%;animation:adSpin .8s linear infinite}@keyframes adSpin{to{transform:rotate(360deg)}}.ads-unified-loading{display:grid;gap:10px}.ad-skeleton{min-height:250px}
`}</style>
 <div className="wf-section-head"><h2>Ads Task</h2><span>Daily rewards</span></div>
 <section className="card wf-main-ad">
  <div className="wf-ad-top"><div className="wf-ad-icon"><div className="square play"><AnimatedIcon name="ads" active={!mainDisabled}/></div></div><div className="wf-ad-copy"><h3>Adsgram Ad</h3><p>Watch an ad. Collect WIENER.</p></div></div>
  <div className="wf-reward-pill">+{Number(s.ad_reward||10)} WIENER per ad</div>
  <div className="wf-progress-row"><span>Today's progress</span><b>{used} / {limit}</b></div>
  <div className="wf-progress"><i style={{width:`${progress}%`}}/></div>
  <button className="primary wf-watch" type="button" disabled={mainDisabled} onClick={()=>watch('main')}>{busy==='main'?'OPENING…':cooldown>0?`${cooldown}s`:mainAtLimit?'DONE':'WATCH AD'}</button>
 </section>
 <div className="wf-section-head wf-earn-head"><h2>Earn</h2><span>Try your luck</span></div>
 <div className="wf-spin-wrap"><SpinEarn refresh={refresh} say={say}/></div>
 <DailyLottery refresh={refresh} say={say}/>
 {busy&&<div className="ad-loading-backdrop"><div className="ad-loading-card"><div className="ad-loader"/><h3>OPENING AD</h3><p>Complete the sponsor ad to receive your reward.</p></div></div>}
 </>;
}
