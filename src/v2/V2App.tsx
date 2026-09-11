import {useMemo,useState} from 'react';
import type {Snapshot,Tab} from '../lib';
import {money} from '../lib';
import {Ads} from '../AdsPage';
import {Tasks} from '../TasksPage';
import {SpecialTasks} from '../SpecialTasks';
import {SponsoredTaskEntry} from '../SponsoredTaskEntry';
import {WithdrawAdGate} from '../WithdrawAdGate';
import {LeaderboardPageV2,ProfilePageV2} from '../ProfileLeaderboardV2';
import {DailyPage,ClaimPage} from '../pages';
import {AmbassadorPage} from '../Ambassador';
import {V2Faucet,V2MicroTasks,V2Offerwall,V2SandboxWallet,useV2Sandbox} from './V2Sandbox';
import './v2.css';

type V2Tab='home'|'earn'|'rewards'|'compete'|'me';
type EarnView='overview'|'ads'|'tasks'|'daily'|'claim'|'faucet'|'micro'|'offerwall';
type RewardView='overview'|'daily'|'claim';
type CompeteView='overview'|'leaderboard';
type MeView='overview'|'profile'|'wallet'|'ambassador';

type Props={data:Snapshot;refresh:()=>Promise<any>;say:(s:string)=>void;run:(action:string,b?:any,ok?:string)=>Promise<any>;runFarm:(action:string,b?:any,ok?:string)=>Promise<any>;onExit:()=>void};
const nav:[V2Tab,string,string][]=[['home','Home','⌂'],['earn','Earn','⚡'],['rewards','Rewards','🎁'],['compete','Compete','🏆'],['me','Me','◎']];

function SectionHead({eyebrow,title,sub}:{eyebrow:string;title:string;sub?:string}){return <div className="v2-section-head"><span>{eyebrow}</span><h2>{title}</h2>{sub&&<p>{sub}</p>}</div>}
function Stat({label,value,accent=false}:{label:string;value:string|number;accent?:boolean}){return <div className={'v2-stat'+(accent?' accent':'')}><b>{value}</b><span>{label}</span></div>}
function ActionCard({icon,title,text,reward,onClick,badge}:{icon:string;title:string;text:string;reward?:string;onClick:()=>void;badge?:string}){return <button className="v2-action-card" onClick={onClick}><div className="v2-action-icon">{icon}</div><div className="v2-action-copy"><div className="v2-action-title">{title}{badge&&<em>{badge}</em>}</div><p>{text}</p>{reward&&<strong>{reward}</strong>}</div><span className="v2-chevron">›</span></button>}
function V2Back({title,onBack}:{title:string;onBack:()=>void}){return <div className="v2-backbar"><button onClick={onBack}>‹</button><b>{title}</b><span/></div>}

function Home({data,setTab,setEarn,setRewards,setCompete,setMe,journey}:{data:Snapshot;setTab:(x:V2Tab)=>void;setEarn:(x:EarnView)=>void;setRewards:(x:RewardView)=>void;setCompete:(x:CompeteView)=>void;setMe:(x:MeView)=>void;journey:{done:number;total:number;percent:number}}){
 const u:any=data.user||{},rank=Number(data.rank||0),ads=Number(u.ads_watched_today||0),tasks=Number(data.tasks_completed_total||data.completed?.length||0);
 return <div className="v2-page">
  <div className="v2-hero"><div className="v2-hero-top"><div><span className="v2-kicker">WIENER FARM V2 · ADMIN TEST</span><h1>{money(u.balance)} <small>WIENER</small></h1><p>Earn · Discover · Compete · Win</p></div><div className="v2-coin">W</div></div><div className="v2-hero-actions"><button onClick={()=>{setMe('wallet');setTab('me')}}>Withdraw</button><button onClick={()=>setTab('earn')}>Earn now</button></div></div>
  <div className="v2-quick-row"><button onClick={()=>{setEarn('faucet');setTab('earn')}}><span>💧</span><b>Faucet</b></button><button onClick={()=>{setEarn('micro');setTab('earn')}}><span>🧩</span><b>Micro</b></button><button onClick={()=>{setEarn('offerwall');setTab('earn')}}><span>🎮</span><b>Offers</b></button><button onClick={()=>{setRewards('daily');setTab('rewards')}}><span>🎁</span><b>Rewards</b></button></div>
  <section className="v2-next-card"><div className="v2-next-top"><div><span>STARTER JOURNEY · TEST</span><h3>Learn V2 by earning in the sandbox</h3></div><b>{journey.percent}%</b></div><div className="v2-progress"><i style={{width:`${journey.percent}%`}}/></div><div className="v2-next-meta"><span>{journey.done}/{journey.total} steps</span><span>{ads} ads today</span><span>{tasks} tasks completed</span></div><button onClick={()=>{setEarn('faucet');setTab('earn')}}>CONTINUE JOURNEY</button></section>
  <SectionHead eyebrow="FOR YOU" title="What matters now" sub="A cleaner home that prioritizes the next useful action."/>
  <div className="v2-stack"><ActionCard icon="⚡" title="Earn Hub" text="Faucet, ads, tasks, micro tasks, farm and offers." reward="OPEN" onClick={()=>setTab('earn')} badge="V2"/><ActionCard icon="🎁" title="Rewards Hub" text="Tickets, daily rewards, giveaways and drops." reward="EXPLORE" onClick={()=>setTab('rewards')}/><ActionCard icon="🏆" title="Weekly competition" text={rank?`Current rank #${rank}`:'Earn activity points to enter rankings.'} reward="VIEW" onClick={()=>{setCompete('leaderboard');setTab('compete')}}/><ActionCard icon="◎" title="Account & Wallet" text="Profile, withdrawals and Ambassador tools." onClick={()=>setTab('me')}/></div>
 </div>
}

function EarnHub({view,setView,data,refresh,say,run,runFarm,sandbox}:{view:EarnView;setView:(x:EarnView)=>void;data:Snapshot;refresh:()=>Promise<any>;say:(s:string)=>void;run:Props['run'];runFarm:Props['runFarm'];sandbox:ReturnType<typeof useV2Sandbox>}){
 if(view==='ads')return <div className="v2-page"><V2Back title="Rewarded Ads" onBack={()=>setView('overview')}/><Ads data={data} refresh={refresh} say={say}/></div>;
 if(view==='tasks')return <div className="v2-page"><V2Back title="Task Center" onBack={()=>setView('overview')}/><SponsoredTaskEntry/><SpecialTasks data={data} say={say} refresh={refresh}/><Tasks data={data} run={run} say={say} refresh={refresh}/></div>;
 if(view==='daily')return <div className="v2-page"><V2Back title="Daily Missions" onBack={()=>setView('overview')}/><DailyPage data={data} run={run}/></div>;
 if(view==='claim')return <div className="v2-page"><V2Back title="Farm" onBack={()=>setView('overview')}/><ClaimPage data={data} run={runFarm}/></div>;
 if(view==='faucet')return <div className="v2-page"><V2Back title="Faucet" onBack={()=>setView('overview')}/><V2SandboxWallet state={sandbox.state}/><V2Faucet state={sandbox.state} setState={sandbox.setState} say={say}/></div>;
 if(view==='micro')return <div className="v2-page"><V2Back title="Micro Tasks" onBack={()=>setView('overview')}/><V2SandboxWallet state={sandbox.state}/><V2MicroTasks state={sandbox.state} setState={sandbox.setState} say={say}/></div>;
 if(view==='offerwall')return <div className="v2-page"><V2Back title="Offerwall" onBack={()=>setView('overview')}/><V2Offerwall say={say}/></div>;
 return <div className="v2-page"><SectionHead eyebrow="EARN HUB" title="More than watch & earn" sub="Quick rewards, real tasks and higher-value opportunities in one place."/>
  <V2SandboxWallet state={sandbox.state}/>
  <div className="v2-feature-grid">
   <button className="v2-feature-card primary" onClick={()=>setView('faucet')}><span>💧</span><small>FAST</small><h3>Faucet</h3><p>Simple retention claim with server-side cooldown planned.</p><b>TEST NOW</b></button>
   <button className="v2-feature-card" onClick={()=>setView('micro')}><span>🧩</span><small>NEW</small><h3>Micro Tasks</h3><p>Small verified actions with WIENER, XP and tickets.</p><b>OPEN LAB</b></button>
   <button className="v2-feature-card" onClick={()=>setView('offerwall')}><span>🎮</span><small>HIGH VALUE</small><h3>Offerwall</h3><p>Games, apps, surveys and partner offers.</p><b>EXPLORE</b></button>
   <button className="v2-feature-card" onClick={()=>setView('ads')}><span>📺</span><small>LIVE</small><h3>Rewarded Ads</h3><p>Current working ad flow inside V2.</p><b>OPEN</b></button>
   <button className="v2-feature-card" onClick={()=>setView('tasks')}><span>✅</span><small>LIVE</small><h3>Task Center</h3><p>Sponsored, Telegram and community tasks.</p><b>EXPLORE</b></button>
   <button className="v2-feature-card" onClick={()=>setView('claim')}><span>🌾</span><small>LIVE</small><h3>Farm</h3><p>Current farming claim flow.</p><b>CLAIM</b></button>
  </div>
  <section className="v2-earn-map"><span>V2 EARNING MAP</span><div><i>💧 Faucet</i><b>→</b><i>🧩 Micro</i><b>→</b><i>✅ Tasks</i><b>→</b><i>🎮 Offers</i></div><p>Different earning styles reduce dependence on one ad format.</p></section>
 </div>
}

function RewardsHub({view,setView,data,run,runFarm,sandbox}:{view:RewardView;setView:(x:RewardView)=>void;data:Snapshot;run:Props['run'];runFarm:Props['runFarm'];sandbox:ReturnType<typeof useV2Sandbox>}){
 if(view==='daily')return <div className="v2-page"><V2Back title="Daily Rewards" onBack={()=>setView('overview')}/><DailyPage data={data} run={run}/></div>;
 if(view==='claim')return <div className="v2-page"><V2Back title="Claim Center" onBack={()=>setView('overview')}/><ClaimPage data={data} run={runFarm}/></div>;
 return <div className="v2-page"><SectionHead eyebrow="REWARDS" title="Come back for something" sub="Tickets, streaks, giveaways and event rewards."/><div className="v2-ticket-hero"><div><span>TEST TICKETS</span><h2>{sandbox.state.tickets} <small>available</small></h2><p>Tickets are session-only until the backend reward ledger is added.</p></div><div className="v2-ticket">🎟</div></div><div className="v2-stack"><ActionCard icon="🔥" title="Daily Reward" text="Current working daily reward flow." reward="LIVE" onClick={()=>setView('daily')}/><ActionCard icon="🌾" title="Farm Claim" text="Current working farm claim flow." reward="LIVE" onClick={()=>setView('claim')}/></div><section className="v2-preview-board"><span>V2 REWARD CENTER</span><div><article><b>🎉 Giveaways</b><p>Use tickets or requirements to enter active draws.</p></article><article><b>🎰 Lucky Draw</b><p>Scheduled draws and special event pools.</p></article><article><b>🏅 Achievements</b><p>XP milestones, badges and progression.</p></article><article><b>🎁 Promo Drops</b><p>Limited-time codes and community drops.</p></article></div></section></div>
}

function CompeteHub({view,setView,data}:{view:CompeteView;setView:(x:CompeteView)=>void;data:Snapshot}){
 if(view==='leaderboard')return <div className="v2-page"><V2Back title="Leaderboard" onBack={()=>setView('overview')}/><LeaderboardPageV2 data={data}/></div>;
 return <div className="v2-page"><SectionHead eyebrow="COMPETE" title="Climb, defend, win" sub="Every contest in one competitive hub."/><section className="v2-rank-card"><span>CURRENT RANK</span><h2>{data.rank?`#${data.rank}`:'UNRANKED'}</h2><p>Global activity leaderboard</p><button onClick={()=>setView('leaderboard')}>VIEW LEADERBOARD</button></section><div className="v2-stack"><ActionCard icon="📺" title="Weekly Ad League" text="Current valid-ad competition." reward="LIVE" onClick={()=>setView('leaderboard')} badge="LIVE"/><ActionCard icon="👥" title="Referral Race" text="Competition for qualified active referrals." reward="PLANNED" onClick={()=>{}}/><ActionCard icon="✅" title="Task Sprint" text="Rank by verified task completions." reward="PLANNED" onClick={()=>{}}/><ActionCard icon="🌍" title="Community Goal" text="Shared milestones unlock community drops." reward="PLANNED" onClick={()=>{}}/></div></div>
}

function MeHub({view,setView,data,say,sandbox}:{view:MeView;setView:(x:MeView)=>void;data:Snapshot;say:(s:string)=>void;sandbox:ReturnType<typeof useV2Sandbox>}){
 const legacySetTab=(t:Tab)=>{if(t==='wallet')setView('wallet');else if(t==='ambassador')setView('ambassador');else setView('overview')};
 if(view==='profile')return <div className="v2-page"><V2Back title="Profile" onBack={()=>setView('overview')}/><ProfilePageV2 data={data} setTab={legacySetTab}/></div>;
 if(view==='wallet')return <div className="v2-page"><V2Back title="Wallet" onBack={()=>setView('overview')}/><WithdrawAdGate data={data} setTab={legacySetTab}/></div>;
 if(view==='ambassador')return <div className="v2-page"><V2Back title="Ambassador" onBack={()=>setView('overview')}/><AmbassadorPage data={data} setTab={legacySetTab} say={say}/></div>;
 const u:any=data.user||{};
 return <div className="v2-page"><SectionHead eyebrow="ME" title="Your WIENER identity" sub="Money, progress and account tools in one place."/><section className="v2-profile-card"><div className="v2-avatar">{String(u.username||u.first_name||'W').slice(0,1).toUpperCase()}</div><div><span>WIENER MEMBER</span><h2>{u.first_name||u.username||'Farmer'}</h2><p>{money(u.balance)} WIENER available</p></div></section><div className="v2-stat-grid"><Stat label="Real balance" value={money(u.balance)} accent/><Stat label="Test tickets" value={sandbox.state.tickets}/><Stat label="Test XP" value={sandbox.state.xp}/></div><div className="v2-stack"><ActionCard icon="💰" title="Wallet & Withdraw" text="Current live withdrawal system." onClick={()=>setView('wallet')}/><ActionCard icon="◎" title="Full Profile" text="Current account and progression details." onClick={()=>setView('profile')}/><ActionCard icon="📣" title="Ambassador" text="Current Ambassador Program." onClick={()=>setView('ambassador')}/></div></div>
}

export function V2App({data,refresh,say,run,runFarm,onExit}:Props){
 const [tab,setTab]=useState<V2Tab>('home'),[earnView,setEarnView]=useState<EarnView>('overview'),[rewardView,setRewardView]=useState<RewardView>('overview'),[competeView,setCompeteView]=useState<CompeteView>('overview'),[meView,setMeView]=useState<MeView>('overview');
 const sandbox=useV2Sandbox();
 const section=useMemo(()=>{
  if(tab==='home')return <Home data={data} setTab={setTab} setEarn={setEarnView} setRewards={setRewardView} setCompete={setCompeteView} setMe={setMeView} journey={sandbox.journey}/>;
  if(tab==='earn')return <EarnHub view={earnView} setView={setEarnView} data={data} refresh={refresh} say={say} run={run} runFarm={runFarm} sandbox={sandbox}/>;
  if(tab==='rewards')return <RewardsHub view={rewardView} setView={setRewardView} data={data} run={run} runFarm={runFarm} sandbox={sandbox}/>;
  if(tab==='compete')return <CompeteHub view={competeView} setView={setCompeteView} data={data}/>;
  return <MeHub view={meView} setView={setMeView} data={data} say={say} sandbox={sandbox}/>;
 },[tab,earnView,rewardView,competeView,meView,data,refresh,say,run,runFarm,sandbox]);
 const switchTab=(next:V2Tab)=>{setTab(next);if(next==='earn')setEarnView('overview');if(next==='rewards')setRewardView('overview');if(next==='compete')setCompeteView('overview');if(next==='me')setMeView('overview')};
 return <div className="v2-shell"><header className="v2-topbar"><div><i className="v2-test-dot"/> ADMIN V2 TESTING</div><button onClick={onExit}>← Return to V1</button></header><main className="v2-content">{section}</main><nav className="v2-nav">{nav.map(([k,label,icon])=><button key={k} className={tab===k?'active':''} onClick={()=>switchTab(k)}><span>{icon}</span><b>{label}</b></button>)}</nav></div>
}
