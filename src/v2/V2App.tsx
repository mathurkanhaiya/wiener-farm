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
import {HomeWithPromo} from '../PromoClaim';
import {AmbassadorPage} from '../Ambassador';
import './v2.css';

type V2Tab='home'|'earn'|'rewards'|'compete'|'me';
type EarnView='overview'|'ads'|'tasks'|'daily'|'claim';
type RewardView='overview'|'daily'|'claim';
type CompeteView='overview'|'leaderboard';
type MeView='overview'|'profile'|'wallet'|'ambassador';

type Props={
  data:Snapshot;
  refresh:()=>Promise<any>;
  say:(s:string)=>void;
  run:(action:string,b?:any,ok?:string)=>Promise<any>;
  runFarm:(action:string,b?:any,ok?:string)=>Promise<any>;
  onExit:()=>void;
};

const nav:[V2Tab,string,string][]=[
  ['home','Home','⌂'],
  ['earn','Earn','⚡'],
  ['rewards','Rewards','🎁'],
  ['compete','Compete','🏆'],
  ['me','Me','◎'],
];

function SectionHead({eyebrow,title,sub}:{eyebrow:string;title:string;sub?:string}){
  return <div className="v2-section-head"><span>{eyebrow}</span><h2>{title}</h2>{sub&&<p>{sub}</p>}</div>;
}

function Stat({label,value,accent=false}:{label:string;value:string|number;accent?:boolean}){
  return <div className={'v2-stat'+(accent?' accent':'')}><b>{value}</b><span>{label}</span></div>;
}

function ActionCard({icon,title,text,reward,onClick,badge}:{icon:string;title:string;text:string;reward?:string;onClick:()=>void;badge?:string}){
  return <button className="v2-action-card" onClick={onClick}>
    <div className="v2-action-icon">{icon}</div>
    <div className="v2-action-copy"><div className="v2-action-title">{title}{badge&&<em>{badge}</em>}</div><p>{text}</p>{reward&&<strong>{reward}</strong>}</div>
    <span className="v2-chevron">›</span>
  </button>;
}

function V2Home({data,setTab,setEarn,setRewards,setCompete,setMe}:{data:Snapshot;setTab:(x:V2Tab)=>void;setEarn:(x:EarnView)=>void;setRewards:(x:RewardView)=>void;setCompete:(x:CompeteView)=>void;setMe:(x:MeView)=>void}){
  const user:any=data.user||{};
  const taskDone=Number(data.tasks_completed_total||data.completed?.length||0);
  const ads=Number(user.ads_watched_today||0);
  const refs=Number(user.referrals_count||data.referrals?.length||0);
  const rank=Number(data.rank||0);
  const missionProgress=Math.min(100,Math.round(((Math.min(ads,3)+Math.min(taskDone,1)+Math.min(refs,1))/5)*100));
  return <div className="v2-page v2-home-page">
    <div className="v2-hero">
      <div className="v2-hero-top"><div><span className="v2-kicker">WIENER FARM V2</span><h1>{money(user.balance)} <small>WIENER</small></h1><p>Earn smarter. Compete. Discover rewards.</p></div><div className="v2-coin">W</div></div>
      <div className="v2-hero-actions">
        <button onClick={()=>{setMe('wallet');setTab('me')}}>Withdraw</button>
        <button onClick={()=>setTab('earn')}>Earn now</button>
      </div>
    </div>

    <div className="v2-quick-row">
      <button onClick={()=>{setEarn('ads');setTab('earn')}}><span>📺</span><b>Ads</b></button>
      <button onClick={()=>{setEarn('tasks');setTab('earn')}}><span>✅</span><b>Tasks</b></button>
      <button onClick={()=>{setEarn('claim');setTab('earn')}}><span>🌾</span><b>Farm</b></button>
      <button onClick={()=>{setRewards('daily');setTab('rewards')}}><span>🎁</span><b>Daily</b></button>
    </div>

    <section className="v2-next-card">
      <div className="v2-next-top"><div><span>YOUR NEXT MOVE</span><h3>Complete today's activity path</h3></div><b>{missionProgress}%</b></div>
      <div className="v2-progress"><i style={{width:`${missionProgress}%`}}/></div>
      <div className="v2-next-meta"><span>{ads}/3 ads</span><span>{taskDone>0?'1/1':'0/1'} task</span><span>{refs>0?'1/1':'0/1'} referral</span></div>
      <button onClick={()=>setTab('earn')}>CONTINUE</button>
    </section>

    <SectionHead eyebrow="LIVE NOW" title="For you" sub="The most useful actions right now."/>
    <div className="v2-stack">
      <ActionCard icon="⚡" title="Quick Earn" text="Ads, farming and tasks in one place." reward="Open Earn Hub" onClick={()=>setTab('earn')}/>
      <ActionCard icon="🎁" title="Rewards Hub" text="Daily rewards, drops and promo opportunities." reward="View rewards" onClick={()=>setTab('rewards')} badge="NEW"/>
      <ActionCard icon="🏆" title="Weekly competition" text={rank?`You are currently ranked #${rank}.`:'Enter the leaderboard by earning points.'} reward="View competition" onClick={()=>{setCompete('leaderboard');setTab('compete')}}/>
      <ActionCard icon="◎" title="Account & Wallet" text="Profile, withdrawals, ambassador tools and history." onClick={()=>{setMe('overview');setTab('me')}}/>
    </div>
  </div>;
}

function EarnHub({view,setView,data,refresh,say,run,runFarm}:{view:EarnView;setView:(x:EarnView)=>void;data:Snapshot;refresh:()=>Promise<any>;say:(s:string)=>void;run:Props['run'];runFarm:Props['runFarm']}){
  if(view==='ads')return <div className="v2-page"><V2Back title="Ads" onBack={()=>setView('overview')}/><Ads data={data} refresh={refresh} say={say}/></div>;
  if(view==='tasks')return <div className="v2-page"><V2Back title="Tasks" onBack={()=>setView('overview')}/><SponsoredTaskEntry/><SpecialTasks data={data} say={say} refresh={refresh}/><Tasks data={data} run={run} say={say} refresh={refresh}/></div>;
  if(view==='daily')return <div className="v2-page"><V2Back title="Daily Missions" onBack={()=>setView('overview')}/><DailyPage data={data} run={run}/></div>;
  if(view==='claim')return <div className="v2-page"><V2Back title="Farm" onBack={()=>setView('overview')}/><ClaimPage data={data} run={runFarm}/></div>;
  return <div className="v2-page">
    <SectionHead eyebrow="EARN HUB" title="Choose how you earn" sub="Fast actions first, deeper opportunities below."/>
    <div className="v2-feature-grid">
      <button className="v2-feature-card primary" onClick={()=>setView('ads')}><span>📺</span><small>QUICK EARN</small><h3>Rewarded Ads</h3><p>Earn through valid ad sessions.</p><b>OPEN</b></button>
      <button className="v2-feature-card" onClick={()=>setView('claim')}><span>🌾</span><small>PASSIVE</small><h3>Farm</h3><p>Claim your current farming rewards.</p><b>CLAIM</b></button>
      <button className="v2-feature-card" onClick={()=>setView('tasks')}><span>✅</span><small>TASKS</small><h3>Task Center</h3><p>Sponsored and community tasks.</p><b>EXPLORE</b></button>
      <button className="v2-feature-card" onClick={()=>setView('daily')}><span>🔥</span><small>DAILY</small><h3>Missions</h3><p>Keep your daily activity moving.</p><b>VIEW</b></button>
    </div>
    <section className="v2-coming"><div><span>COMING IN V2</span><h3>More earning types</h3></div><div className="v2-chip-row"><i>💧 Faucet</i><i>🧩 Micro Tasks</i><i>🎮 Offerwall</i><i>📋 Surveys</i></div><p>These are UI placeholders only in admin testing. They do not change the current economy.</p></section>
  </div>;
}

function RewardsHub({view,setView,data,run,runFarm}:{view:RewardView;setView:(x:RewardView)=>void;data:Snapshot;run:Props['run'];runFarm:Props['runFarm']}){
  if(view==='daily')return <div className="v2-page"><V2Back title="Daily Rewards" onBack={()=>setView('overview')}/><DailyPage data={data} run={run}/></div>;
  if(view==='claim')return <div className="v2-page"><V2Back title="Claim Center" onBack={()=>setView('overview')}/><ClaimPage data={data} run={runFarm}/></div>;
  return <div className="v2-page">
    <SectionHead eyebrow="REWARDS" title="Everything worth coming back for" sub="Drops, streaks and upcoming V2 reward systems."/>
    <div className="v2-ticket-hero"><div><span>TICKETS</span><h2>0 <small>available</small></h2><p>Ticket economy is preview-only until the V2 backend phase.</p></div><div className="v2-ticket">🎟</div></div>
    <div className="v2-stack">
      <ActionCard icon="🔥" title="Daily Reward" text="Open the current working daily reward flow." reward="CLAIM / VIEW" onClick={()=>setView('daily')}/>
      <ActionCard icon="🌾" title="Farm Claim" text="Access the current farm claim flow without changing V1 logic." onClick={()=>setView('claim')}/>
    </div>
    <section className="v2-preview-board"><span>V2 PREVIEW</span><div><article><b>🎉 Giveaways</b><p>Active draws and ticket entry.</p></article><article><b>🎰 Lucky Draw</b><p>Special event reward draws.</p></article><article><b>🏅 Achievements</b><p>Progress milestones and badges.</p></article><article><b>🎁 Promo Drops</b><p>Limited-time reward drops.</p></article></div></section>
  </div>;
}

function CompeteHub({view,setView,data}:{view:CompeteView;setView:(x:CompeteView)=>void;data:Snapshot}){
  if(view==='leaderboard')return <div className="v2-page"><V2Back title="Leaderboard" onBack={()=>setView('overview')}/><LeaderboardPageV2 data={data}/></div>;
  return <div className="v2-page">
    <SectionHead eyebrow="COMPETE" title="Climb, defend, win" sub="A single home for every competitive mode."/>
    <section className="v2-rank-card"><span>CURRENT RANK</span><h2>{data.rank?`#${data.rank}`:'UNRANKED'}</h2><p>Global activity leaderboard</p><button onClick={()=>setView('leaderboard')}>VIEW LEADERBOARD</button></section>
    <div className="v2-stack">
      <ActionCard icon="📺" title="Weekly Ad League" text="Compete using valid ad activity and bonus points." reward="Live competition" onClick={()=>setView('leaderboard')} badge="LIVE"/>
      <ActionCard icon="👥" title="Referral Race" text="V2 competition concept using qualified referrals." reward="Preview" onClick={()=>{}}/>
      <ActionCard icon="✅" title="Task Sprint" text="V2 task competition concept." reward="Preview" onClick={()=>{}}/>
    </div>
  </div>;
}

function MeHub({view,setView,data,refresh,say}:{view:MeView;setView:(x:MeView)=>void;data:Snapshot;refresh:()=>Promise<any>;say:(s:string)=>void}){
  const legacySetTab=(t:Tab)=>{if(t==='wallet')setView('wallet');else if(t==='ambassador')setView('ambassador');else setView('overview')};
  if(view==='profile')return <div className="v2-page"><V2Back title="Profile" onBack={()=>setView('overview')}/><ProfilePageV2 data={data} setTab={legacySetTab}/></div>;
  if(view==='wallet')return <div className="v2-page"><V2Back title="Wallet" onBack={()=>setView('overview')}/><WithdrawAdGate data={data} setTab={legacySetTab}/></div>;
  if(view==='ambassador')return <div className="v2-page"><V2Back title="Ambassador" onBack={()=>setView('overview')}/><AmbassadorPage data={data} setTab={legacySetTab} say={say}/></div>;
  const u:any=data.user||{};
  return <div className="v2-page">
    <SectionHead eyebrow="ME" title="Your WIENER identity" sub="Wallet, account and progression in one place."/>
    <section className="v2-profile-card"><div className="v2-avatar">{String(u.username||u.first_name||'W').slice(0,1).toUpperCase()}</div><div><span>WIENER MEMBER</span><h2>{u.first_name||u.username||'Farmer'}</h2><p>{money(u.balance)} WIENER available</p></div></section>
    <div className="v2-stat-grid"><Stat label="Balance" value={money(u.balance)} accent/><Stat label="Referrals" value={Number(u.referrals_count||data.referrals?.length||0)}/><Stat label="Tasks" value={Number(data.tasks_completed_total||data.completed?.length||0)}/></div>
    <div className="v2-stack">
      <ActionCard icon="💰" title="Wallet & Withdraw" text="Open the existing withdrawal system." onClick={()=>setView('wallet')}/>
      <ActionCard icon="◎" title="Full Profile" text="View account details and current progression." onClick={()=>setView('profile')}/>
      <ActionCard icon="📣" title="Ambassador" text="Open the existing Ambassador Program." onClick={()=>setView('ambassador')}/>
    </div>
  </div>;
}

function V2Back({title,onBack}:{title:string;onBack:()=>void}){return <div className="v2-backbar"><button onClick={onBack}>‹</button><b>{title}</b><span/></div>}

export function V2App({data,refresh,say,run,runFarm,onExit}:Props){
  const [tab,setTab]=useState<V2Tab>('home');
  const [earnView,setEarnView]=useState<EarnView>('overview');
  const [rewardView,setRewardView]=useState<RewardView>('overview');
  const [competeView,setCompeteView]=useState<CompeteView>('overview');
  const [meView,setMeView]=useState<MeView>('overview');
  const section=useMemo(()=>{
    if(tab==='home')return <V2Home data={data} setTab={setTab} setEarn={setEarnView} setRewards={setRewardView} setCompete={setCompeteView} setMe={setMeView}/>;
    if(tab==='earn')return <EarnHub view={earnView} setView={setEarnView} data={data} refresh={refresh} say={say} run={run} runFarm={runFarm}/>;
    if(tab==='rewards')return <RewardsHub view={rewardView} setView={setRewardView} data={data} run={run} runFarm={runFarm}/>;
    if(tab==='compete')return <CompeteHub view={competeView} setView={setCompeteView} data={data}/>;
    return <MeHub view={meView} setView={setMeView} data={data} refresh={refresh} say={say}/>;
  },[tab,earnView,rewardView,competeView,meView,data,refresh,say,run,runFarm]);

  return <div className="v2-shell">
    <header className="v2-topbar"><div><span className="v2-test-dot"/>ADMIN TEST MODE</div><button onClick={onExit}>Return to V1</button></header>
    <main className="v2-content">{section}</main>
    <nav className="v2-nav" aria-label="Wiener Farm V2">
      {nav.map(([key,label,icon])=><button key={key} className={tab===key?'active':''} onClick={()=>setTab(key)}><span>{icon}</span><b>{label}</b></button>)}
    </nav>
  </div>;
}
