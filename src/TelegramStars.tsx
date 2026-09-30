import {useEffect,useState} from 'react';
import {hapticImpact,hapticNotify,money,type Snapshot} from './lib';

const BIG_TEDDY='https://pixlinkhost.vercel.app/i/H6gKj6gN2A';
const SMALL_TEDDY='https://pixlinkhost.vercel.app/i/95rEFUqyrQ';
const AXE='https://pixlinkhost.vercel.app/i/XKKUtWdxLQ';
const DOG='https://pixlinkhost.vercel.app/i/DTBrE-73Ag';

const num=(s:any,keys:string[],fallback=0)=>{for(const k of keys){const n=Number(s?.[k]);if(Number.isFinite(n)&&n>0)return n}return fallback};
const txt=(s:any,keys:string[])=>{for(const k of keys){const v=String(s?.[k]??'').trim();if(v)return v}return ''};
const duration=(sec:number)=>{if(!sec)return '—';const m=Math.floor(sec/60),h=Math.floor(m/60),mm=m%60;return h?(mm?h+'h '+String(mm).padStart(2,'0')+'m':h+'h'):m+'m'};
const today=()=>new Date().toISOString().slice(0,10);
const progressKey=()=>{const id=String((window.Telegram?.WebApp as any)?.initDataUnsafe?.user?.id||'guest');return 'wiener_stars_cycle_v3_'+id};
const readCycle=()=>{try{const x=JSON.parse(localStorage.getItem(progressKey())||'{}');return x?.day===today()?{progress:Number(x.progress||0),nextMineAt:Number(x.nextMineAt||0)}:{progress:0,nextMineAt:0}}catch{return {progress:0,nextMineAt:0}}};
const saveCycle=(progress:number,nextMineAt:number)=>{try{localStorage.setItem(progressKey(),JSON.stringify({day:today(),progress,nextMineAt}))}catch{}};

export function TelegramStarsPage({data,setTab,refresh,say}:{data:Snapshot;setTab:any;refresh?:any;say?:any}){
 const s:any=data.settings||{},u:any=data.user||{},per=Number(s.token_per_usdt||0),balance=Math.floor(Number(u.balance||0));
 const taps=num(s,['telegram_stars_mine_taps','stars_mine_taps','mine_taps'],26);
 const cooldownSeconds=num(s,['telegram_stars_mine_cooldown_seconds','stars_mine_cooldown_seconds','mine_cooldown_seconds'],2400);
 const step=num(s,['telegram_stars_mine_progress_percent','stars_mine_progress_percent','mine_progress_percent'],4);
 const gift=txt(s,['telegram_stars_gift_name','stars_gift_name','mine_gift_name'])||'Teddy Bear';
 const giftText=txt(s,['telegram_stars_gift_description','stars_gift_description','mine_gift_description']);
 const blockId=String(s.adsgram_block_id||'');
 const initialCycle=readCycle();
 const [progress,setProgress]=useState(initialCycle.progress),[busy,setBusy]=useState(false),[cooldownUntil,setCooldownUntil]=useState(initialCycle.nextMineAt),[now,setNow]=useState(Date.now());
 const cooldown=Math.max(0,Math.ceil((cooldownUntil-now)/1000));
 const remaining=Math.max(0,Math.ceil((100-progress)/step));
 const configured=Boolean(blockId&&taps&&cooldownSeconds&&step);
 const cycleDone=progress>=100;
 const minesDone=Math.min(taps,Math.ceil(progress/step));
 const miningInProgress=progress>0&&!cycleDone;

 useEffect(()=>{saveCycle(progress,cooldownUntil)},[progress,cooldownUntil]);
 useEffect(()=>{const id=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(id)},[]);
 useEffect(()=>{if(cooldownUntil&&now>=cooldownUntil)setCooldownUntil(0)},[now,cooldownUntil]);

 const mine=async()=>{
   if(busy||cooldown>0||cycleDone||!configured)return;
   try{
     setBusy(true);hapticImpact('medium');
     const controller=window.Adsgram?.init({blockId});
     if(!controller)throw Error('AdsGram is not ready. Please reload the app.');
     const result:any=await controller.show();
     if(!result?.done)throw Error(result?.description||'Please complete the rewarded ad.');
     const next=Math.min(100,progress+step);
     const nextMineAt=next>=100?0:Date.now()+cooldownSeconds*1000;
     setProgress(next);
     setCooldownUntil(nextMineAt);
     hapticNotify('success');
     say?.(next>=100?'Gift mining complete. Claim is ready.':'Mining +'+step+'% complete.');
     await refresh?.();
   }catch(e:any){hapticNotify('error');say?.(String(e?.message||'Ad could not be completed.'))}
   finally{setBusy(false)}
 };
 const claim=()=>{if(cycleDone&&!busy)say?.('Gift claim is ready for the configured backend delivery flow.')};

 return <div className="wf-stars-page">
  <div className="wf-stars-top">
   <button className="wf-stars-back" onClick={()=>setTab('home')} aria-label="Back">‹</button>
   <div><span className="wf-stars-kicker">FARM GIFTS</span><h1>Mine Telegram Stars</h1></div>
  </div>
  <section className="wf-stars-balance">
   <div className="wf-stars-balance-label">TOTAL BALANCE</div>
   <div className="wf-stars-balance-number">{money(balance)}</div>
   <div className="wf-stars-balance-meta"><span>◆ WIENER</span><span className="wf-stars-usd">{per?'≈ '+money(balance/per,4)+' USDT':'—'}</span></div>
   <img src={DOG} className="wf-stars-balance-art" alt="" aria-hidden="true"/>
  </section>
  <section className="wf-stars-mine">
   <div className="wf-stars-mine-art"><img src={BIG_TEDDY} className="wf-stars-big-teddy" alt="" aria-hidden="true"/></div>
   <h2>{cycleDone?'Mining complete':miningInProgress?'Your mining is about to finish':'Mining '+gift}</h2>
   <div className="wf-stars-sub">{minesDone}/{taps} mines · {duration(cooldownSeconds)} cooldown · ~{duration(taps*cooldownSeconds)} total</div>
   <div className="wf-stars-progress-head"><span>PROGRESS</span><b>{Math.min(100,progress)}%</b></div>
   <div className="wf-stars-track"><i style={{width:Math.min(100,progress)+'%'}}/></div>
   <div className="wf-stars-remaining">{cycleDone?'100% complete · claim your gift':cooldown>0?`Mining in progress · next mine in ${String(Math.floor(cooldown/3600)).padStart(2,'0')}:${String(Math.floor(cooldown%3600/60)).padStart(2,'0')}:${String(cooldown%60).padStart(2,'0')}`:remaining+' mines left · +'+step+'% each'}</div>
   <button className="wf-stars-action" disabled={!configured||busy||cooldown>0||cycleDone} onClick={mine}>
    <img src={AXE} alt="" aria-hidden="true"/>{busy?'OPENING AD…':cooldown>0&&!cycleDone?'MINING IN PROGRESS':cycleDone?'MINING COMPLETE':'WATCH AD · MINE +'+step+'%'}
   </button>
   {cycleDone&&<button className="wf-stars-claim" disabled={busy} onClick={claim}>🎁 CLAIM {gift.toUpperCase()}</button>}
   {!blockId&&<div className="wf-stars-config">AdsGram rewarded block is not configured in backend settings.</div>}
  </section>
  <section className="wf-stars-reward"><img src={SMALL_TEDDY} alt="" aria-hidden="true"/><div><h3>YOU'LL GET THIS {gift.toUpperCase()}</h3><p>{giftText||'Sent to you on Telegram once you finish this cycle.'}</p></div></section>
  <div className="wf-stars-how-title"><i/>HOW IT WORKS</div>
  <section className="wf-stars-how">
   <div><b>1</b><span>Watch one AdsGram rewarded ad to mine +{step}%.</span></div>
   <div><b>2</b><span>Wait for the {duration(cooldownSeconds)} cooldown, then mine again.</span></div>
   <div><b>3</b><span>Reach 100%, then claim the configured Telegram gift.</span></div>
  </section>
 </div>
}
