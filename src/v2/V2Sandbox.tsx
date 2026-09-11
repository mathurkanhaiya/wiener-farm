import {useMemo,useState} from 'react';

type SandboxState={wiener:number;tickets:number;xp:number;faucetClaimed:boolean;done:string[]};
type Props={state:SandboxState;setState:(fn:(s:SandboxState)=>SandboxState)=>void;say:(s:string)=>void};

const microTasks=[
  {id:'visit',icon:'🌐',title:'Visit featured project',text:'Open and review a featured partner card.',reward:24,xp:12,tickets:0},
  {id:'quiz',icon:'🧠',title:'Quick knowledge check',text:'Complete a short community question.',reward:18,xp:15,tickets:1},
  {id:'profile',icon:'👤',title:'Complete profile check',text:'Review your WIENER profile and preferences.',reward:12,xp:10,tickets:0},
];

const offers=[
  {icon:'🎮',title:'Play & Earn',sub:'Game milestones',reward:'Up to 2,500 WIENER',tag:'GAMES'},
  {icon:'📱',title:'App Offers',sub:'Install & complete goals',reward:'Up to 1,800 WIENER',tag:'APPS'},
  {icon:'📝',title:'Surveys',sub:'Region-based surveys',reward:'Variable rewards',tag:'SURVEY'},
  {icon:'🚀',title:'Partner Offers',sub:'Signups & partner actions',reward:'High value',tag:'PARTNER'},
];

export function V2Faucet({state,setState,say}:Props){
  const claim=()=>{
    if(state.faucetClaimed){say('V2 test faucet already claimed in this session.');return}
    setState(s=>({...s,wiener:s.wiener+10,xp:s.xp+5,faucetClaimed:true}));
    say('Test credit: +10 WIENER · +5 XP (sandbox only)');
  };
  return <div className="v2-sandbox-page">
    <div className="v2-sandbox-note"><b>🧪 ADMIN SANDBOX</b><span>No real balance is changed here.</span></div>
    <section className="v2-faucet-card"><div className="v2-water">💧</div><span>WIENER FAUCET</span><h2>10 WIENER</h2><p>A lightweight retention claim. Test mode uses session-only credits.</p><button disabled={state.faucetClaimed} onClick={claim}>{state.faucetClaimed?'CLAIMED':'CLAIM TEST FAUCET'}</button></section>
    <div className="v2-info-grid"><article><b>⏱ Claim cycle</b><span>Planned: configurable cooldown</span></article><article><b>🛡 Abuse guard</b><span>Device + account + server cooldown</span></article></div>
  </div>;
}

export function V2MicroTasks({state,setState,say}:Props){
  const complete=(id:string,reward:number,xp:number,tickets:number)=>{
    if(state.done.includes(id)){say('Task already completed in this test session.');return}
    setState(s=>({...s,wiener:s.wiener+reward,xp:s.xp+xp,tickets:s.tickets+tickets,done:[...s.done,id]}));
    say(`Sandbox reward: +${reward} WIENER${tickets?` · +${tickets} Ticket`:''} · +${xp} XP`);
  };
  return <div className="v2-sandbox-page">
    <div className="v2-sandbox-note"><b>🧪 MICRO TASK LAB</b><span>Frontend flow only — no public rewards yet.</span></div>
    <div className="v2-micro-list">{microTasks.map(t=>{const done=state.done.includes(t.id);return <button key={t.id} className={done?'done':''} onClick={()=>complete(t.id,t.reward,t.xp,t.tickets)} disabled={done}><i>{t.icon}</i><div><small>MICRO TASK</small><b>{t.title}</b><span>{t.text}</span><strong>+{t.reward} WIENER · +{t.xp} XP{t.tickets?` · +${t.tickets} 🎟`:''}</strong></div><em>{done?'✓':'›'}</em></button>})}</div>
  </div>;
}

export function V2Offerwall({say}:Pick<Props,'say'>){
  return <div className="v2-sandbox-page">
    <div className="v2-sandbox-note"><b>🧪 OFFERWALL SHELL</b><span>Provider callbacks are intentionally not connected yet.</span></div>
    <section className="v2-offer-hero"><span>OFFERWALL</span><h2>Higher-value earning</h2><p>Games, apps, surveys and partner actions can live here behind verified server callbacks.</p></section>
    <div className="v2-offer-grid">{offers.map(o=><button key={o.title} onClick={()=>say(`${o.title}: provider integration will be connected in finishing mode.`)}><i>{o.icon}</i><small>{o.tag}</small><b>{o.title}</b><span>{o.sub}</span><strong>{o.reward}</strong></button>)}</div>
    <section className="v2-provider-strip"><b>Provider-ready architecture</b><span>signed callback → pending event → validation → credit ledger</span></section>
  </div>;
}

export function V2SandboxWallet({state}:{state:SandboxState}){
  const level=Math.max(1,Math.floor(state.xp/100)+1),next=level*100,progress=Math.min(100,Math.round((state.xp%100)));
  return <section className="v2-sandbox-wallet"><div><span>TEST WIENER</span><b>{state.wiener}</b></div><div><span>TICKETS</span><b>{state.tickets}</b></div><div><span>XP</span><b>{state.xp}</b></div><div className="v2-level"><span>LEVEL {level}</span><i><em style={{width:`${progress}%`}}/></i><small>{state.xp}/{next} XP</small></div></section>;
}

export function useV2Sandbox(){
  const [state,setRaw]=useState<SandboxState>({wiener:0,tickets:0,xp:0,faucetClaimed:false,done:[]});
  const setState=(fn:(s:SandboxState)=>SandboxState)=>setRaw(fn);
  const journey=useMemo(()=>{
    const steps=[state.faucetClaimed,state.done.length>=1,state.tickets>=1,state.xp>=20];
    return {done:steps.filter(Boolean).length,total:steps.length,percent:Math.round(steps.filter(Boolean).length/steps.length*100)};
  },[state]);
  return {state,setState,journey};
}
