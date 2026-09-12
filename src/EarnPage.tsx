import {useState} from 'react';

type EarnSection='offerwall'|'surveys';

export function EarnPage(){
  const [section,setSection]=useState<EarnSection>('offerwall');
  return <section style={{paddingBottom:18}}>
    <div className="card" style={{marginBottom:12,background:'linear-gradient(145deg,rgba(35,190,95,.10),rgba(255,196,50,.045))',border:'1px solid rgba(111,255,169,.13)'}}>
      <div className="eyebrow">EARN MORE</div>
      <h2 style={{margin:'5px 0 6px'}}>Offers & Surveys</h2>
      <p style={{margin:0,fontSize:12,lineHeight:1.55,opacity:.62}}>Complete partner activities and surveys to earn WIENER. Rewards are credited only after provider verification.</p>
    </div>

    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,padding:4,marginBottom:14,borderRadius:16,background:'rgba(255,255,255,.045)',border:'1px solid rgba(255,255,255,.06)'}}>
      <button className={section==='offerwall'?'primary':'secondary'} style={{margin:0,minHeight:44,borderRadius:12}} onClick={()=>setSection('offerwall')}>⚡ Offerwall</button>
      <button className={section==='surveys'?'primary':'secondary'} style={{margin:0,minHeight:44,borderRadius:12}} onClick={()=>setSection('surveys')}>📋 Surveys</button>
    </div>

    {section==='offerwall'?<div className="card">
      <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center'}}><div><div className="eyebrow">OFFERWALL</div><h3 style={{margin:'4px 0'}}>High-value offers</h3></div><span style={{fontSize:11,fontWeight:900,opacity:.55}}>COMING SOON</span></div>
      <p style={{fontSize:12,lineHeight:1.6,opacity:.62}}>Games, app installs, sign-ups and partner offers will appear here based on availability and country.</p>
      <div style={{padding:12,borderRadius:14,background:'rgba(255,255,255,.035)',fontSize:11,lineHeight:1.55,opacity:.68}}>Complete an offer → provider verifies it → WIENER reward is credited.</div>
    </div>:<div className="card">
      <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center'}}><div><div className="eyebrow">SURVEYS</div><h3 style={{margin:'4px 0'}}>Paid surveys</h3></div><span style={{fontSize:11,fontWeight:900,opacity:.55}}>COMING SOON</span></div>
      <p style={{fontSize:12,lineHeight:1.6,opacity:.62}}>Available surveys will show estimated time and WIENER reward before you start.</p>
      <div style={{padding:12,borderRadius:14,background:'rgba(255,255,255,.035)',fontSize:11,lineHeight:1.55,opacity:.68}}>Start survey → complete/qualify → provider confirms → WIENER reward is credited.</div>
    </div>}
  </section>
}
