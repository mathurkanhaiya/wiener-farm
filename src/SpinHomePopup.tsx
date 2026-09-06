import {useEffect,useState} from 'react';
import {getInitData,hapticImpact,PUBLISHABLE_KEY,type Tab} from './lib';

const SPIN_ICON='https://pixlinkhost.vercel.app/i/UuSYd47wng';

type SpinStatus={free_left?:number;available_spins?:number};

export function SpinHomePopup({tab,setTab}:{tab:Tab;setTab:(t:Tab)=>void}){
 const [status,setStatus]=useState<SpinStatus|null>(null),[show,setShow]=useState(false);
 useEffect(()=>{
  if(tab!=='home')return;
  let alive=true;
  const timer=window.setTimeout(async()=>{
   try{
    if(sessionStorage.getItem('wiener_spin_home_prompt_seen_v2')==='1')return;
    const r=await fetch('/functions/v1/wiener-spin',{method:'POST',headers:{'Content-Type':'application/json','apikey':PUBLISHABLE_KEY,'cache-control':'no-cache'},cache:'no-store',body:JSON.stringify({action:'status',initData:getInitData()})});
    const raw=await r.text();let x:any={};try{x=raw?JSON.parse(raw):{}}catch{}
    const st=x?.data??x;
    if(!alive||!r.ok||x?.ok===false)return;
    if(Number(st?.available_spins||0)<=0)return;
    sessionStorage.setItem('wiener_spin_home_prompt_seen_v2','1');
    setStatus(st);setShow(true);
   }catch{}
  },650);
  return()=>{alive=false;window.clearTimeout(timer)};
 },[tab]);
 if(!show||tab!=='home'||!status||Number(status.available_spins||0)<=0)return null;
 const daily=Number(status.free_left||0)>0,count=Number(status.available_spins||0);
 const go=()=>{setShow(false);hapticImpact('medium');setTab('ads');window.setTimeout(()=>window.dispatchEvent(new Event('wiener-open-spin')),80)};
 return <><style>{`
 .spin-home-alert{position:fixed;inset:0;z-index:10250;display:flex;align-items:flex-end;justify-content:center;padding:18px 18px calc(20px + env(safe-area-inset-bottom));background:rgba(3,2,6,.72);backdrop-filter:blur(13px);-webkit-backdrop-filter:blur(13px)}
 .spin-home-alert-card{position:relative;width:min(100%,420px);padding:24px 20px 20px;border-radius:28px;background:radial-gradient(circle at 50% 0,rgba(255,98,38,.16),transparent 42%),linear-gradient(180deg,rgba(39,19,52,.99),rgba(16,8,25,.99));border:1px solid rgba(255,112,43,.44);box-shadow:0 -20px 60px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.08)}
 .spin-home-alert-card:before{content:'';position:absolute;top:0;left:18px;right:18px;height:3px;border-radius:999px;background:linear-gradient(90deg,#ffaf19,#ff4c26);box-shadow:0 0 18px rgba(255,91,34,.52)}
 .spin-home-alert-x{position:absolute;right:14px;top:14px;width:38px;height:38px;border-radius:50%;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#fff;font-size:22px}
 .spin-home-alert-icon{display:block;width:88px;height:88px;margin:1px auto 12px;object-fit:contain;border-radius:50%;filter:drop-shadow(0 10px 24px rgba(255,91,34,.26))}
 .spin-home-alert-card h3{margin:0;text-align:center;font-size:25px;line-height:1.15}.spin-home-alert-card h3 span{color:#ffb63c}
 .spin-home-alert-card p{margin:10px auto 18px;max-width:315px;text-align:center;font-size:13px;line-height:1.5;color:rgba(255,255,255,.67)}
 .spin-home-alert-cta{width:100%;min-height:56px;border:0;border-radius:18px;background:linear-gradient(100deg,#ffad16,#ff4b20);color:#fff;font-size:17px;font-weight:950;box-shadow:0 13px 30px rgba(255,79,29,.24),inset 0 1px 0 rgba(255,255,255,.28)}
 .spin-home-alert-later{width:100%;margin-top:12px;border:0;background:transparent;color:rgba(255,255,255,.43);font-weight:850;font-size:12px}
 .spin-home-alert-count{display:inline-flex;align-items:center;justify-content:center;min-width:30px;height:23px;padding:0 7px;margin-left:5px;border-radius:999px;background:rgba(255,255,255,.14);font-size:11px}
 `}</style><div className="spin-home-alert"><div className="spin-home-alert-card"><button className="spin-home-alert-x" onClick={()=>setShow(false)}>×</button><img className="spin-home-alert-icon" src={SPIN_ICON} alt=""/><h3>{daily?<>Your <span>Daily Spin</span> is ready!</>:<>You have a <span>Spin</span> available!</>}</h3><p>{daily?'Your free daily spin is waiting. Spin now and try to win WIENER, TON or bonus spins.':<>You have <b>{count}</b> spin{count===1?'':'s'} ready. Use it now and try your luck.</>}</p><button className="spin-home-alert-cta" onClick={go}>SPIN NOW → <span className="spin-home-alert-count">{count}</span></button><button className="spin-home-alert-later" onClick={()=>setShow(false)}>Maybe later</button></div></div></>;
}
