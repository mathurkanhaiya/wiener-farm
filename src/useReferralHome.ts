import {useEffect,useRef} from 'react';
import {getInitData} from './lib';

// Only mounted Home time counts. Leaving, hiding, or blurring starts a fresh proof.
export function useReferralHome(enabled:boolean){
 const done=useRef(false);
 useEffect(()=>{
  if(!enabled||done.current)return;
  let disposed=false,epoch=0,token='',sequence=0,timer=0,controller:AbortController|null=null;
  const active=()=>!disposed&&document.visibilityState==='visible'&&document.hasFocus();
  const call=async(action:string,body:Record<string,unknown>={},signal?:AbortSignal)=>{
   const r=await fetch('/functions/v1/wiener-referral-home',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',signal,body:JSON.stringify({action,initData:getInitData(),...body})});
   const x=await r.json();if(!r.ok||x.ok!==true)throw Error('referral_verification_pending');return x.data;
  };
  const stop=()=>{
   epoch++;window.clearTimeout(timer);controller?.abort();controller=null;
   const old=token;token='';sequence=0;
   if(old)void fetch('/functions/v1/wiener-referral-home',{method:'POST',headers:{'Content-Type':'application/json'},keepalive:true,body:JSON.stringify({action:'home_cancel',initData:getInitData(),token:old})}).catch(()=>{});
  };
  const pulse=async(run:number)=>{
   if(run!==epoch||!active()){stop();return}
   try{
    const result=await call('home_pulse',{token,sequence:sequence+1},controller?.signal);
    if(run!==epoch||!active())return;
    if(result?.done){done.current=true;token='';return}
    sequence=Number(result.sequence);timer=window.setTimeout(()=>void pulse(run),2000);
   }catch{if(run===epoch)stop()}
  };
  const start=async()=>{
   if(!active()||done.current||controller)return;
   const run=epoch;controller=new AbortController();
   try{
    const result=await call('home_start',{},controller.signal);
    if(run!==epoch||!active())return;
    if(result?.done){done.current=true;return}
    if(!/^[a-f0-9]{64}$/.test(String(result?.token||'')))throw Error('invalid_home_proof');
    token=result.token;sequence=0;timer=window.setTimeout(()=>void pulse(run),2000);
   }catch{if(run===epoch)stop()}
  };
  const visibility=()=>{if(active())void start();else stop()};
  const blur=()=>stop();
  document.addEventListener('visibilitychange',visibility);
  window.addEventListener('focus',visibility);window.addEventListener('blur',blur);window.addEventListener('pagehide',blur);
  void start();
  return()=>{disposed=true;stop();document.removeEventListener('visibilitychange',visibility);window.removeEventListener('focus',visibility);window.removeEventListener('blur',blur);window.removeEventListener('pagehide',blur)};
 },[enabled]);
}
