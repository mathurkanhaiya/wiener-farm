import {useEffect,useState} from 'react';
import {getInitData,money} from './lib';

type OffersStatus={
  providers?:{offerwallgg?:{ready:boolean;name:string}};
  rate?:{wiener_per_usd:number};
  history?:any[];
  totals?:{wiener?:number;usd?:number};
};

async function offersApi(action:'status'|'open',body:any={}){
  const r=await fetch('/functions/v1/wiener-offers',{method:'POST',headers:{'Content-Type':'application/json','cache-control':'no-cache'},cache:'no-store',body:JSON.stringify({action,initData:getInitData(),...body})});
  const x=await r.json().catch(()=>({ok:false,error:'invalid_response'}));
  if(!r.ok||x?.ok===false)throw new Error(String(x?.message||x?.error||'Offers service unavailable').replace(/_/g,' '));
  return x.data??x;
}

export function EarnPage(){
  const [status,setStatus]=useState<OffersStatus|null>(null);
  const [loading,setLoading]=useState(true);
  const [opening,setOpening]=useState('');
  const [error,setError]=useState('');
  const refresh=async()=>{try{setError('');setLoading(true);setStatus(await offersApi('status'))}catch(e:any){setError(String(e?.message||e))}finally{setLoading(false)}};
  useEffect(()=>{refresh()},[]);
  const openProvider=async()=>{const provider='offerwallgg';if(opening)return;try{setOpening(provider);setError('');const x=await offersApi('open',{provider});const url=String(x?.url||'');if(!/^https:\/\//i.test(url))throw new Error('Provider link unavailable');try{(window.Telegram?.WebApp as any)?.HapticFeedback?.impactOccurred?.('light')}catch{}const tg=window.Telegram?.WebApp as any;if(tg?.openLink)tg.openLink(url);else window.open(url,'_blank','noopener,noreferrer')}catch(e:any){setError(String(e?.message||e))}finally{setOpening('')}};
  const ready=status?.providers?.offerwallgg?.ready;
  const history=(status?.history||[]).filter(x=>x.provider==='offerwallgg').slice(0,6);

  return <section style={{paddingBottom:18}}>
    <div className="card" style={{marginBottom:12,background:'linear-gradient(145deg,rgba(35,190,95,.10),rgba(255,196,50,.045))',border:'1px solid rgba(111,255,169,.13)'}}>
      <div className="eyebrow">EARN MORE</div><h2 style={{margin:'5px 0 6px'}}>Offerwall.GG Offers</h2>
      <p style={{margin:0,fontSize:12,lineHeight:1.55,opacity:.62}}>Complete Offerwall.GG offers and earn WIENER after your completion is verified.</p>
    </div>

    <div className="card" style={{marginBottom:12}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center'}}><div><div className="eyebrow" style={{textAlign:'left'}}>OFFERWALL.GG</div><h3 style={{margin:'4px 0'}}>Games, apps & offers</h3></div><span style={{fontSize:10,fontWeight:900,padding:'6px 8px',borderRadius:999,background:ready?'rgba(50,220,120,.11)':'rgba(255,190,55,.10)',color:ready?'#72f2a8':'#ffd46b'}}>{loading?'LOADING':ready?'AVAILABLE':'UNAVAILABLE'}</span></div>
      <p style={{fontSize:12,lineHeight:1.6,opacity:.62}}>Choose an offer, read its requirements and complete every step to earn your reward.</p>
      <div style={{padding:12,borderRadius:14,background:'rgba(255,255,255,.035)',fontSize:11,lineHeight:1.55,opacity:.72,marginBottom:12}}>Complete offer → Offerwall.GG verifies → WIENER credited</div>
      <button className="primary" disabled={loading||!!opening||!ready} onClick={openProvider}>{loading?'LOADING…':opening?'OPENING…':ready?'VIEW OFFERS':'OFFERS TEMPORARILY UNAVAILABLE'}</button>
    </div>

    {error&&<div className="info-box" style={{marginBottom:12}}>{error}</div>}

    <div className="card">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10}}><div><div className="eyebrow" style={{textAlign:'left'}}>RECENT</div><h3 style={{margin:'4px 0'}}>Verified rewards</h3></div><button className="secondary" style={{width:'auto',padding:'9px 12px',fontSize:11}} onClick={refresh} disabled={loading}>REFRESH</button></div>
      {!history.length?<p style={{fontSize:12,opacity:.55,margin:'14px 0 0'}}>No verified Offerwall.GG rewards yet.</p>:<div style={{marginTop:10}}>{history.map((x:any)=><div key={`${x.provider}-${x.id}`} style={{display:'flex',justifyContent:'space-between',gap:10,padding:'11px 0',borderTop:'1px solid rgba(255,255,255,.055)'}}><div style={{minWidth:0}}><b style={{display:'block',fontSize:12,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{x.title||'Offerwall.GG Offer'}</b><small style={{opacity:.45}}>{String(x.status||'').toUpperCase()}</small></div><b style={{fontSize:12,color:'#ffe36b',whiteSpace:'nowrap'}}>{Number(x.user_reward_wiener||0)>=0?'+':''}{money(x.user_reward_wiener||0)} W</b></div>)}</div>}
    </div>
  </section>
}

