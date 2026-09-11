import {useMemo,useState} from 'react';
import './v2-sandbox.css';

type SandboxState={wiener:number;tickets:number;xp:number;faucetClaims:number;done:string[];entries:number;missionClaimed:boolean};
type Props={state:SandboxState;setState:(fn:(s:SandboxState)=>SandboxState)=>void;say:(s:string)=>void};

const microTasks=[
  {id:'visit',icon:'🌐',cat:'VISIT & EXPLORE',title:'Explore featured project',text:'Open the sponsor page, spend time reviewing it, then return.',reward:40,xp:10,tickets:0,verify:'Timed visit + return'},
  {id:'quiz',icon:'🧠',cat:'QUIZ',title:'Community knowledge check',text:'Read the prompt and submit the correct answer.',reward:30,xp:15,tickets:1,verify:'Answer / code'},
  {id:'social',icon:'💬',cat:'COMMUNITY',title:'Community action',text:'Complete a simple community task and return for verification.',reward:35,xp:12,tickets:0,verify:'Telegram / manual'},
  {id:'feedback',icon:'📝',cat:'FEEDBACK',title:'Quick feedback task',text:'Submit a short structured response for review.',reward:50,xp:20,tickets:1,verify:'Manual proof'},
];
const offers=[
  {icon:'🎮',title:'Reach Level 10',sub:'Game milestone · ~25 min',provider:'Game Offerwall',gross:'$0.20',user:'3,000 WIENER ($0.15)',margin:'$0.05',tag:'GAMES'},
  {icon:'📱',title:'Install & complete signup',sub:'App action · ~8 min',provider:'App Partner',gross:'$0.10',user:'1,400 WIENER ($0.07)',margin:'$0.03',tag:'APPS'},
  {icon:'📝',title:'Complete survey',sub:'Region based · 5–12 min',provider:'Survey Partner',gross:'Variable',user:'70–80% share',margin:'20–30%',tag:'SURVEY'},
  {icon:'🚀',title:'Partner conversion',sub:'Qualified signup / action',provider:'Direct sponsor',gross:'Campaign based',user:'Configurable',margin:'Configurable',tag:'PARTNER'},
];

export function V2Faucet({state,setState,say}:Props){
  const max=4,reward=5,ready=state.faucetClaims<max;
  const claim=()=>{if(!ready){say('Daily test faucet cap reached.');return}setState(s=>({...s,wiener:s.wiener+reward,xp:s.xp+5,faucetClaims:s.faucetClaims+1}));say(`Sandbox: +${reward} WIENER · +5 XP. Real balance unchanged.`)};
  return <div className="v2-sandbox-page"><div className="v2-sandbox-note"><b>🧪 ADMIN FAUCET TEST</b><span>Session-only · no real ledger credit.</span></div><section className="v2-faucet-card"><div className="v2-water">💧</div><span>WIENER FAUCET</span><h2>+{reward} WIENER</h2><p>Retention claim design: 4-hour cooldown, maximum 4 claims/day, server/device checks and a global daily pool.</p><div className="v2-faucet-meter"><b>{state.faucetClaims} / {max}</b><span>test claims used</span></div><button disabled={!ready} onClick={claim}>{ready?'CLAIM TEST FAUCET':'DAILY TEST CAP REACHED'}</button></section><div className="v2-info-grid"><article><b>⏱ Cooldown</b><span>Planned: 4 hours, server timestamp only.</span></article><article><b>💰 Funding</b><span>Growth / ad-profit retention budget.</span></article><article><b>🛡 Verification</b><span>Account + device + rate limit + budget check.</span></article><article><b>🚨 Stop rule</b><span>Close claims when daily pool is exhausted.</span></article></div></div>
}

export function V2MicroTasks({state,setState,say}:Props){
  const complete=(t:typeof microTasks[number])=>{if(state.done.includes(t.id)){say('Task already completed in this test session.');return}setState(s=>({...s,wiener:s.wiener+t.reward,xp:s.xp+t.xp,tickets:s.tickets+t.tickets,done:[...s.done,t.id]}));say(`Sandbox: +${t.reward} WIENER${t.tickets?` · +${t.tickets} Ticket`:''} · +${t.xp} XP`)};
  return <div className="v2-sandbox-page"><div className="v2-sandbox-note"><b>🧪 MICRO TASK LAB</b><span>Entry → instruction → verification → reward.</span></div><section className="v2-flow-strip"><span>START</span><b>→</b><span>DO TASK</span><b>→</b><span>VERIFY</span><b>→</b><span>CREDIT</span></section><div className="v2-micro-list">{microTasks.map(t=>{const done=state.done.includes(t.id);return <button key={t.id} className={done?'done':''} onClick={()=>complete(t)} disabled={done}><i>{t.icon}</i><div><small>{t.cat}</small><b>{t.title}</b><span>{t.text}</span><em>Verify: {t.verify}</em><strong>+{t.reward} WIENER · +{t.xp} XP{t.tickets?` · +${t.tickets} 🎟`:''}</strong></div><strong className="v2-task-go">{done?'✓':'›'}</strong></button>})}</div><section className="v2-provider-strip"><b>Funding rule</b><span>Sponsor prepaid budget or explicit platform budget · one completion per eligible user · hard completion cap.</span></section></div>
}

export function V2Offerwall({say}:Pick<Props,'say'>){return <div className="v2-sandbox-page"><div className="v2-sandbox-note"><b>🧪 OFFERWALL SHELL</b><span>No provider callback is connected yet.</span></div><section className="v2-offer-hero"><span>OFFERWALL</span><h2>Higher-value earning</h2><p>Only a verified server-to-server provider callback can credit a real offer later. Opening an offer never pays by itself.</p></section><div className="v2-offer-grid">{offers.map(o=><button key={o.title} onClick={()=>say(`${o.title}: preview only. Real credit requires verified provider callback.`)}><i>{o.icon}</i><small>{o.tag}</small><b>{o.title}</b><span>{o.sub}</span><strong>{o.user}</strong><em>{o.provider} · gross {o.gross} · margin {o.margin}</em></button>)}</div><section className="v2-provider-strip"><b>Production callback flow</b><span>signed provider callback → unique transaction check → eligibility validation → pending event → credit ledger → funding source + margin record</span></section></div>}

export function V2MissionBoard({state,setState,say}:Props){
  const steps=[{name:'Claim Faucet',ok:state.faucetClaims>0},{name:'Complete 1 Micro Task',ok:state.done.length>0},{name:'Earn first Ticket',ok:state.tickets>0},{name:'Reach 20 XP',ok:state.xp>=20},{name:'Enter test Giveaway',ok:state.entries>0}];
  const complete=steps.every(x=>x.ok);
  const claim=()=>{if(!complete||state.missionClaimed)return;setState(s=>({...s,wiener:s.wiener+25,tickets:s.tickets+1,xp:s.xp+50,missionClaimed:true}));say('Sandbox mission reward: +25 WIENER · +1 Ticket · +50 XP')};
  return <section className="v2-mission-card"><div><span>DAILY JOURNEY · SANDBOX</span><h3>{steps.filter(x=>x.ok).length}/{steps.length} complete</h3></div>{steps.map(s=><p key={s.name} className={s.ok?'done':''}><b>{s.ok?'✓':'○'}</b>{s.name}</p>)}<button disabled={!complete||state.missionClaimed} onClick={claim}>{state.missionClaimed?'REWARD CLAIMED':complete?'CLAIM TEST REWARD':'COMPLETE JOURNEY'}</button><small>Planned live reward: server-calculated from real activity events, never from frontend flags.</small></section>
}

export function V2TicketDraw({state,setState,say}:Props){const enter=()=>{if(state.tickets<1){say('Earn a test ticket first.');return}setState(s=>({...s,tickets:s.tickets-1,entries:s.entries+1}));say('Test entry added. No real giveaway entry was created.')};return <section className="v2-draw-card"><div><span>🎁 TEST COMMUNITY GIVEAWAY</span><h3>3 winners · sandbox draw</h3><p>Entry costs 1 test ticket. Tickets have no cash value and cannot be withdrawn.</p></div><div className="v2-draw-stats"><b>{state.tickets} 🎟</b><span>{state.entries} entries</span></div><button onClick={enter}>ENTER WITH 1 TEST TICKET</button></section>}

export function V2SandboxWallet({state}:{state:SandboxState}){const level=Math.max(1,Math.floor(state.xp/100)+1),base=(level-1)*100,next=level*100,progress=Math.min(100,Math.round(((state.xp-base)/100)*100));return <section className="v2-sandbox-wallet"><div><span>TEST WIENER</span><b>{state.wiener}</b></div><div><span>TICKETS</span><b>{state.tickets}</b></div><div><span>XP</span><b>{state.xp}</b></div><div className="v2-level"><span>LEVEL {level}</span><i><em style={{width:`${progress}%`}}/></i><small>{state.xp}/{next} XP</small></div></section>}

export function useV2Sandbox(){const[state,setRaw]=useState<SandboxState>({wiener:0,tickets:0,xp:0,faucetClaims:0,done:[],entries:0,missionClaimed:false});const setState=(fn:(s:SandboxState)=>SandboxState)=>setRaw(fn);const journey=useMemo(()=>{const steps=[state.faucetClaims>0,state.done.length>=1,state.tickets>=1,state.xp>=20,state.entries>=1];const done=steps.filter(Boolean).length;return{done,total:steps.length,percent:Math.round(done/steps.length*100)}},[state]);return{state,setState,journey}}
