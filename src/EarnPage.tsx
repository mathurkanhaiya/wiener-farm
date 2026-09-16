import {useEffect,useState} from 'react';
import {getInitData,money} from './lib';

type OffersStatus={providers?:{offerwallgg?:{ready:boolean;name:string}};rate?:{wiener_per_usd:number};history?:any[];totals?:{wiener?:number;usd?:number}};

async function offersApi(action:'status'|'open',body:any={}){
  const r=await fetch('/functions/v1/wiener-offers',{method:'POST',headers:{'Content-Type':'application/json','cache-control':'no-cache'},cache:'no-store',body:JSON.stringify({action,initData:getInitData(),...body})});
  const x=await r.json().catch(()=>({ok:false,error:'invalid_response'}));
  if(!r.ok||x?.ok===false)throw new Error(String(x?.message||x?.error||'Offers service unavailable').replace(/_/g,' '));
  return x.data??x;
}

const glass:React.CSSProperties={background:'linear-gradient(145deg,rgba(255,255,255,.075),rgba(255,255,255,.025))',border:'1px solid rgba(255,255,255,.09)',boxShadow:'0 16px 50px rgba(0,0,0,.18)',backdropFilter:'blur(18px)',WebkitBackdropFilter:'blur(18px)'};

export function EarnPage(){
  const [status,setStatus]=useState<OffersStatus|null>(null);
  const [loading,setLoading]=useState(true);
  const [opening,setOpening]=useState(false);
  const [offerUrl,setOfferUrl]=useState('');
  const [frameLoading,setFrameLoading]=useState(false);
  const [confirmOpen,setConfirmOpen]=useState(false);
  const [error,setError]=useState('');

  const refresh=async()=>{try{setError('');setLoading(true);setStatus(await offersApi('status'))}catch(e:any){setError(String(e?.message||e))}finally{setLoading(false)}};
  useEffect(()=>{refresh()},[]);

  const launch=async()=>{if(opening)return;try{setOpening(true);setConfirmOpen(false);setError('');const x=await offersApi('open',{provider:'offerwallgg'});const url=String(x?.url||'');if(!/^https:\/\//i.test(url))throw new Error('Provider link unavailable');try{(window.Telegram?.WebApp as any)?.HapticFeedback?.impactOccurred?.('medium')}catch{}setFrameLoading(true);setOfferUrl(url)}catch(e:any){setError(String(e?.message||e))}finally{setOpening(false)}};
  const close=()=>{setOfferUrl('');setFrameLoading(false);refresh()};
  const reload=()=>{const u=offerUrl;setOfferUrl('');setFrameLoading(true);requestAnimationFrame(()=>setOfferUrl(u))};
  const ready=!!status?.providers?.offerwallgg?.ready;
  const history=(status?.history||[]).filter(x=>x.provider==='offerwallgg').slice(0,5);

  if(offerUrl)return <section style={{position:'fixed',inset:0,zIndex:80,display:'flex',flexDirection:'column',background:'linear-gradient(180deg,#0c1110 0%,#090c0b 100%)',animation:'offerEnter .22s ease-out'}}>
    <style>{`@keyframes offerEnter{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}@keyframes offerPulse{0%,100%{opacity:.45;transform:scale(.94)}50%{opacity:1;transform:scale(1)}}`}</style>
    <div style={{padding:'max(10px,env(safe-area-inset-top)) 12px 10px',display:'grid',gridTemplateColumns:'44px 1fr 44px',alignItems:'center',gap:8,background:'rgba(12,17,16,.94)',borderBottom:'1px solid rgba(255,255,255,.07)',backdropFilter:'blur(20px)',WebkitBackdropFilter:'blur(20px)'}}>
      <button aria-label="Back" onClick={close} style={{height:40,width:40,borderRadius:14,border:'1px solid rgba(255,255,255,.09)',background:'rgba(255,255,255,.06)',color:'#fff',fontSize:19,fontWeight:800}}>‹</button>
      <div style={{textAlign:'center',minWidth:0}}><div style={{fontSize:13,fontWeight:900,letterSpacing:'.01em'}}>Offerwall.GG</div><div style={{fontSize:9,opacity:.42,marginTop:2}}>WIENER EARN</div></div>
      <button aria-label="Reload" onClick={reload} style={{height:40,width:40,borderRadius:14,border:'1px solid rgba(255,255,255,.09)',background:'rgba(255,255,255,.06)',color:'#fff',fontSize:16}}>↻</button>
    </div>
    <div style={{position:'relative',flex:1,minHeight:0,overflow:'hidden'}}>
      {frameLoading&&<div style={{position:'absolute',inset:0,zIndex:2,display:'grid',placeItems:'center',background:'#0c1110'}}><div style={{textAlign:'center'}}><div style={{width:42,height:42,margin:'0 auto 13px',borderRadius:15,display:'grid',placeItems:'center',fontWeight:1000,fontSize:18,background:'linear-gradient(145deg,rgba(94,255,156,.22),rgba(255,214,82,.12))',border:'1px solid rgba(111,255,169,.18)',animation:'offerPulse 1.25s ease-in-out infinite'}}>W</div><b style={{fontSize:12}}>Loading offers</b><div style={{fontSize:10,opacity:.42,marginTop:5}}>Finding the best offers for you…</div></div></div>}
      <iframe title="Offerwall.GG" src={offerUrl} onLoad={()=>setFrameLoading(false)} allow="clipboard-read; clipboard-write; fullscreen; payment" referrerPolicy="strict-origin-when-cross-origin" style={{width:'100%',height:'100%',border:0,display:'block',background:'#fff'}}/>
    </div>
  </section>;

  return <section style={{paddingBottom:20}}>
    <style>{`@keyframes earnGlow{0%,100%{opacity:.45}50%{opacity:.75}}@keyframes modalIn{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:none}}`}</style>
    <div style={{...glass,position:'relative',overflow:'hidden',borderRadius:24,padding:20,marginBottom:12}}>
      <div style={{position:'absolute',width:180,height:180,borderRadius:'50%',right:-80,top:-100,background:'rgba(66,255,142,.10)',filter:'blur(20px)',animation:'earnGlow 3s ease-in-out infinite'}}/>
      <div style={{position:'relative'}}><div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}><span style={{fontSize:9,fontWeight:900,letterSpacing:'.16em',opacity:.5}}>EARN</span><span style={{width:4,height:4,borderRadius:99,background:'#6dffa4'}}/><span style={{fontSize:9,fontWeight:900,color:'#79f5a8'}}>OFFERWALL.GG</span></div><h2 style={{fontSize:25,lineHeight:1.08,margin:'0 0 9px',letterSpacing:'-.035em'}}>Play. Complete.<br/>Earn WIENER.</h2><p style={{margin:0,maxWidth:310,fontSize:12,lineHeight:1.6,opacity:.55}}>Explore games, apps and offers. Rewards are credited after Offerwall.GG verifies your completion.</p></div>
    </div>

    <div style={{...glass,borderRadius:22,padding:16,marginBottom:12}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,marginBottom:14}}><div style={{display:'flex',alignItems:'center',gap:11}}><div style={{width:44,height:44,borderRadius:15,display:'grid',placeItems:'center',fontSize:18,fontWeight:1000,background:'linear-gradient(145deg,rgba(89,255,151,.16),rgba(255,211,77,.08))',border:'1px solid rgba(112,255,167,.13)'}}>W</div><div><b style={{display:'block',fontSize:14}}>Offerwall.GG</b><small style={{fontSize:10,opacity:.43}}>Games · Apps · Offers</small></div></div><span style={{padding:'6px 9px',borderRadius:999,fontSize:9,fontWeight:900,background:ready?'rgba(73,232,132,.11)':'rgba(255,190,60,.09)',color:ready?'#79f5a8':'#ffd26a'}}>{loading?'CHECKING':ready?'● LIVE':'OFFLINE'}</span></div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:7,marginBottom:14}}>{[['01','Choose'],['02','Complete'],['03','Get paid']].map(([n,t])=><div key={n} style={{padding:'10px 7px',borderRadius:13,textAlign:'center',background:'rgba(255,255,255,.035)',border:'1px solid rgba(255,255,255,.045)'}}><div style={{fontSize:8,fontWeight:900,opacity:.32,marginBottom:3}}>{n}</div><div style={{fontSize:10,fontWeight:800}}>{t}</div></div>)}</div>
      <button className="primary" disabled={loading||opening||!ready} onClick={()=>setConfirmOpen(true)} style={{height:50,borderRadius:16,fontWeight:900,letterSpacing:'.02em'}}>{loading?'CHECKING OFFERS…':ready?'EXPLORE OFFERS  →':'OFFERS TEMPORARILY UNAVAILABLE'}</button>
    </div>

    {error&&<div className="info-box" style={{marginBottom:12,borderRadius:16}}>{error}</div>}

    <div style={{...glass,borderRadius:22,padding:16}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10}}><div><div style={{fontSize:9,fontWeight:900,letterSpacing:'.14em',opacity:.38}}>ACTIVITY</div><h3 style={{margin:'4px 0 0',fontSize:15}}>Recent rewards</h3></div><button onClick={refresh} disabled={loading} style={{height:34,padding:'0 11px',borderRadius:11,border:'1px solid rgba(255,255,255,.07)',background:'rgba(255,255,255,.04)',color:'inherit',fontSize:10,fontWeight:800}}>↻ REFRESH</button></div>
      {!history.length?<div style={{padding:'22px 0 8px',textAlign:'center'}}><div style={{fontSize:22,opacity:.3,marginBottom:6}}>◇</div><div style={{fontSize:11,fontWeight:700,opacity:.5}}>No verified rewards yet</div><div style={{fontSize:9,opacity:.3,marginTop:3}}>Your completed offers will appear here</div></div>:<div style={{marginTop:10}}>{history.map((x:any)=><div key={`${x.provider}-${x.id}`} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,padding:'11px 0',borderTop:'1px solid rgba(255,255,255,.055)'}}><div style={{minWidth:0}}><b style={{display:'block',fontSize:11,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{x.title||'Offerwall.GG Offer'}</b><small style={{fontSize:9,opacity:.38}}>{String(x.status||'').toUpperCase()}</small></div><b style={{fontSize:11,color:'#ffe36b',whiteSpace:'nowrap'}}>+{money(Math.max(0,Number(x.user_reward_wiener||0)))} W</b></div>)}</div>}
    </div>

    {confirmOpen&&<div onClick={()=>!opening&&setConfirmOpen(false)} style={{position:'fixed',inset:0,zIndex:100,display:'flex',alignItems:'flex-end',justifyContent:'center',padding:'18px 14px max(18px,env(safe-area-inset-bottom))',background:'rgba(0,0,0,.58)',backdropFilter:'blur(8px)',WebkitBackdropFilter:'blur(8px)'}}><div onClick={e=>e.stopPropagation()} style={{...glass,width:'100%',maxWidth:460,borderRadius:26,padding:18,animation:'modalIn .2s ease-out',background:'linear-gradient(165deg,rgba(27,34,31,.98),rgba(14,18,17,.98))'}}><div style={{width:38,height:4,borderRadius:99,background:'rgba(255,255,255,.14)',margin:'0 auto 17px'}}/><div style={{width:52,height:52,borderRadius:18,display:'grid',placeItems:'center',fontSize:21,fontWeight:1000,marginBottom:13,background:'linear-gradient(145deg,rgba(89,255,151,.18),rgba(255,213,76,.09))',border:'1px solid rgba(112,255,167,.13)'}}>W</div><h3 style={{fontSize:19,margin:'0 0 7px'}}>Open Offerwall.GG?</h3><p style={{fontSize:11,lineHeight:1.6,opacity:.5,margin:'0 0 14px'}}>Offers will open securely inside Wiener Farm. Follow each offer's requirements carefully so your reward can be verified.</p><div style={{padding:11,borderRadius:14,background:'rgba(255,255,255,.035)',fontSize:10,lineHeight:1.5,opacity:.58,marginBottom:14}}>Tip: Don't close an offer while completing its required steps.</div><button className="primary" disabled={opening} onClick={launch} style={{height:50,borderRadius:16,fontWeight:900}}>{opening?'OPENING…':'CONTINUE TO OFFERS'}</button><button disabled={opening} onClick={()=>setConfirmOpen(false)} style={{width:'100%',height:42,marginTop:7,border:0,background:'transparent',color:'inherit',fontSize:11,fontWeight:800,opacity:.5}}>NOT NOW</button></div></div>}
  </section>
}
