import {useEffect,useMemo,useRef,useState} from 'react';
import createAdHandler from 'monetag-tg-sdk';
import {adApi,adUsageApi,providerAdApi,type Snapshot} from './lib';
import {AD_PROVIDERS,providerConfig,type AdProvider} from './economy';
import {SpinEarn} from './SpinEarn';
import {PromoBox} from './PromoClaim';
import {AmbassadorHomeCard} from './Ambassador';
import './styles-earn-cards.css';

type ProviderState={used:number;pending?:number};
type States=Record<AdProvider,ProviderState>;
const emptyStates=():States=>({adsgram:{used:0},monetag:{used:0},adexium:{used:0}});
const uid=()=>String((window.Telegram?.WebApp as any)?.initDataUnsafe?.user?.id||'');
const today=()=>new Date().toISOString().slice(0,10);

export function Ads({data,refresh,say,setTab}:{data:Snapshot;refresh:any;say:any;setTab:(t:any)=>void}){
 const settings:any=data.settings||{};
 const [states,setStates]=useState<States>(emptyStates);
 const [busy,setBusy]=useState<AdProvider|null>(null);
 const [ready,setReady]=useState(false);
 const [now,setNow]=useState(Date.now());
 const monetagRef=useRef<any>(null);
 const adexiumRef=useRef<any>(null);
 const adexiumTaskRef=useRef<string>('');
 const configs=useMemo(()=>({
   adsgram:providerConfig(settings,'adsgram'),
   monetag:providerConfig(settings,'monetag'),
   adexium:providerConfig(settings,'adexium')
 }),[settings]);

 const sync=async()=>{
   try{
     const [x,mainStatus]:any[]=await Promise.all([providerAdApi('status'),adUsageApi()]);
     const next=emptyStates();
     for(const key of Object.keys(next) as AdProvider[]) next[key]={used:Number(x?.providers?.[key]?.used||0),pending:Number(x?.providers?.[key]?.pending||0)};
     next.adsgram.used=Number(mainStatus?.used||0);
     setStates(next);
   }catch{}
   finally{setReady(true)}
 };
 useEffect(()=>{sync();const id=window.setInterval(sync,12000);return()=>window.clearInterval(id)},[]);
 useEffect(()=>{const id=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(id)},[]);

 const watchAdsGram=async()=>{
   const c=configs.adsgram;
   if(!c.blockId)throw Error('AdsGram is not configured.');
   const session:any=await adApi('start',{provider:'adsgram'});
   const controller=window.Adsgram?.init({blockId:String(session?.block_id||c.blockId)});
   if(!controller)throw Error('AdsGram SDK unavailable.');
   const result:any=await controller.show();
   if(result&&result.done===false)throw Error(result.description||'Ad was not completed.');
   await adApi('complete',{session_id:session?.session_id,provider:'adsgram'});
 };

 const watchMonetag=async()=>{
   const zone=String(configs.monetag.blockId||'');
   if(!zone)throw Error('Monetag zone is not configured.');
   if(!monetagRef.current)monetagRef.current=createAdHandler(Number(zone));
   const session:any=await providerAdApi('start',{provider:'monetag',zone_id:zone});
   const ymid=String(session?.ymid||session?.session_id||'');
   if(!ymid)throw Error('Monetag session could not be created.');
   await monetagRef.current({ymid,requestVar:'earn_monetag'});
   await providerAdApi('complete',{provider:'monetag',session_id:session.session_id,ymid});
 };

 const watchAdexium=async()=>{
   const wid=String(configs.adexium.blockId||'');
   if(!wid)throw Error('Adexium widget ID is not configured.');
   if(!adexiumRef.current){
     if(!(window as any).AdexiumWidget)throw Error('Adexium SDK unavailable.');
     adexiumRef.current=new (window as any).AdexiumWidget({wid,adFormat:'interstitial',debug:false,isFullScreen:true});
   }
   const widget=adexiumRef.current;
   adexiumTaskRef.current='';
   await new Promise<void>((resolve,reject)=>{
     const received=(ad:any)=>{adexiumTaskRef.current=String(ad?.id||'');widget.displayAd(ad)};
     const completed=async()=>{try{if(!adexiumTaskRef.current)throw Error('Adexium task ID missing.');await providerAdApi('complete',{provider:'adexium',widget_id:wid,task_id:adexiumTaskRef.current});cleanup();resolve()}catch(e){cleanup();reject(e)}};
     const noAd=()=>{cleanup();reject(Error('No Adexium ad is available right now.'))};
     const cleanup=()=>{try{widget.off('adReceived',received);widget.off('adPlaybackCompleted',completed);widget.off('noAdFound',noAd)}catch{}};
     widget.on('adReceived',received);widget.on('adPlaybackCompleted',completed);widget.on('noAdFound',noAd);
     (widget.requestRewardedAd||widget.requestAd).call(widget,'interstitial');
   });
 };

 const watch=async(provider:AdProvider)=>{
   if(busy)return;
   const cfg=configs[provider],st=states[provider],limit=Math.max(0,Number(cfg.limit||AD_PROVIDERS[provider].limit));
   if(st.used>=limit){say('ℹ️ Daily ad limit reached');return}
   try{
     setBusy(provider);
     if(provider==='adsgram')await watchAdsGram();
     else if(provider==='monetag')await watchMonetag();
     else await watchAdexium();
     say(`✅ Ad completed · +${cfg.reward} WIENER`);
     await sync();await refresh?.();
   }catch(e:any){say(String(e?.message||'Ad was not completed.'))}
   finally{setBusy(null)}
 };

 const cards=(Object.keys(AD_PROVIDERS) as AdProvider[]).map(k=>({key:k,cfg:configs[k],meta:AD_PROVIDERS[k],state:states[k]}));
 if(!ready)return <div className="wf-earn-page"><div className="ads-unified-loading"><div className="card ad-card ad-skeleton"/><div className="card ad-card ad-skeleton"/></div></div>;

 return <div className="wf-earn-page">
  <header className="wf-earn-head"><div><span>COMPLETE &amp; COLLECT</span><h2>Earn</h2></div><div className="wf-earn-counter"><b>{cards.reduce((a,x)=>a+x.state.used,0)}</b><small>ads today</small></div></header>
  <section className="wf-earn-section wf-earn-watch-section">
   <div className="wf-earn-section-head"><span><i/>WATCH &amp; EARN</span><small>3 independent ad blocks</small></div>
   <div className="wf-earn-ad-grid">
    {cards.map(({key,cfg,meta,state})=>{
      const limit=Math.max(0,Number(cfg.limit||meta.limit)),atLimit=state.used>=limit;
      const label=atLimit?'LIMIT':busy===key?'OPENING…':'WATCH';
      return <button className="wf-earn-ad" key={key} disabled={!!busy||atLimit||!cfg.blockId} onClick={()=>watch(key)}>
       <div className="wf-earn-ad-top"><span>{meta.label.toUpperCase()}</span><b>{state.used}/{limit}</b></div>
       <img className="wf-earn-eye" src="https://pixlinkhost.vercel.app/i/dfzvtrmcvA" alt="" aria-hidden="true"/>
       <div className="wf-earn-reward"><img src="https://pixlinkhost.vercel.app/i/YZEVHOSCqA" alt="" aria-hidden="true"/><b>{cfg.reward}</b><small>WIENER</small></div>
       <span className="wf-earn-watch">{label}</span>
       <small className="wf-earn-provider-note">MAX {cfg.reward*limit} W / DAY</small>
      </button>
    })}
   </div>
   <div className="wf-earn-note">Each provider has its own reward, counter and daily limit. Watching one provider never consumes another provider's quota.</div>
  </section>
  <section className="wf-earn-section wf-earn-spin-section"><div className="wf-earn-section-head"><span><i/>SPIN &amp; EARN</span><small>Daily + bonus spins</small></div><div className="wf-earn-module"><SpinEarn refresh={refresh} say={say}/></div></section>
  <section className="wf-earn-section wf-earn-promo-section"><div className="wf-earn-section-head"><span><i/>PROMO CODE</span><small>Claim a reward</small></div><div className="wf-earn-module"><PromoBox data={data} refresh={refresh} say={say}/></div></section>
  <section className="wf-earn-section wf-earn-ambassador-section"><div className="wf-earn-section-head"><span><i/>AMBASSADOR PROGRAM</span><small>Earn with your community</small></div><div className="wf-earn-module"><AmbassadorHomeCard setTab={setTab}/></div></section>
  {busy&&<div className="ad-loading-backdrop"><div className="ad-loading-card"><div className="ad-loader"/><h3>OPENING AD</h3><p>Complete the sponsor ad to receive your reward.</p></div></div>}
 </div>;
}
