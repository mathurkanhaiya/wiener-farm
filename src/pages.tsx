import {WIENER_PER_USDT} from './economy';
import {useEffect,useState} from 'react';
import {api,cleanUserText,date,money,type Snapshot} from './lib';
import {AnimatedIcon} from './icons';
import {DailyBioClaimGate} from './DailyBioClaimGate';
import {useI18n} from './i18n';
import {LanguagePicker} from './ui';

const today=()=>new Date().toISOString().slice(0,10);
function nextDaily(data:Snapshot){
  const u:any=data.user,s=data.settings,day=today();
  const ledgerClaimed=(data.transactions||[]).some((x:any)=>x.kind==='daily_bonus'&&String(x.created_at||'').slice(0,10)===day);
  const done=u.last_daily_claim_date===day||ledgerClaimed;
  const currentDay=Math.max(0,Math.min(7,Number(u.daily_cycle_day||0)));
  const currentWeek=Math.max(1,Number(u.daily_week||1));
  const consecutive=u.last_daily_claim_date&&new Date(`${u.last_daily_claim_date}T00:00:00Z`).getTime()===new Date(`${day}T00:00:00Z`).getTime()-86400000;
  const nextDay=done?Math.max(1,currentDay||1):!consecutive?1:currentDay>=7?1:Math.max(1,currentDay+1);
  const nextWeek=done?currentWeek:!consecutive?1:currentDay>=7?currentWeek+1:currentWeek;
  const multiplier=nextWeek<=1?1:nextWeek===2?1.05:nextWeek===3?1.10:1.15;
  const base=Number(s.daily_rewards?.[nextDay-1]||0);
  const reward=Math.round(base*multiplier*100)/100;
  return {done,currentDay,currentWeek,nextDay,nextWeek,multiplier,reward,stars:Math.max(0,Number(u.daily_stars||0))};
}
function farmInfo(data:Snapshot){const s=data.settings,u:any=data.user,day=today(),fieldDay=String(u.farm_claims_day||'').slice(0,10),fieldCount=fieldDay===day?Number(u.farm_claims_today||0):0,ledgerCount=(Array.isArray(data.transactions)?data.transactions:[]).filter((x:any)=>{const d=String(x.created_at||'').slice(0,10);if(d!==day||Number(x.amount||0)<=0)return false;const kind=String(x.kind||'').toLowerCase(),desc=String(x.description||'').trim().toLowerCase();return ['farm_claim','farm_reward','farming_reward'].includes(kind)||kind.startsWith('farm_')&&kind.includes('reward')||['farming reward','farm reward','wiener farming reward'].includes(desc)}).length,count=Math.min(5,Math.max(0,fieldCount,ledgerCount)),limit=5,started=u.farm_started_at?new Date(u.farm_started_at).getTime():0,next=started+Number(s.farm_claim_cooldown_seconds||0)*1000;return {count,limit,started,next,ready:!!started&&Date.now()>=next,limitReached:count>=limit}}

export function Home({data,run,setTab}:{data:Snapshot;run:any;setTab:any}){
  const u:any=data.user;
  const settings=data.settings;
  const usd=Number(u.balance)/WIENER_PER_USDT;

  const homeTasks=(data.tasks||[])
    .filter((task:any)=>{
      const hay=[task.title,task.description,task.url,task.telegram_chat_id].map((v:any)=>String(v||'').toLowerCase()).join(' ');
      const official=String(task.category||'official').toLowerCase()==='official';
      const farmChannel=hay.includes('wienerfarm')||hay.includes('wiener farm');
      const farmGroup=hay.includes('wienerfarmchat')||hay.includes('wiener farm community');
      const payout=hay.includes('wienerpay')||hay.includes('wiener pay')||hay.includes('payout');
      const bio=hay.includes('wiener')&&hay.includes('bio');
      return official&&(farmChannel||farmGroup||payout||bio);
    })
    .slice(0,4);

  return <>
    <section className="wf-home-welcome">
      <div className="wf-welcome-copy">
        <span>WELCOME BACK</span>
        <strong>{cleanUserText(u.first_name||u.username||'WIENER')}</strong>
      </div>
      <div className="wf-home-tools">
        <LanguagePicker/>
        <button className="wf-theme-toggle" type="button" aria-label="Toggle appearance" onClick={()=>document.documentElement.classList.toggle('wf-soft-theme')}>
          <span>☾</span>
        </button>
      </div>
    </section>

    <section className="wf-balance-card">
      <div className="wf-balance-copy">
        <div className="wf-balance-label">TOTAL BALANCE</div>
        <div className="wf-balance-number">{money(Math.floor(Number(u.balance)))}</div>
        <div className="wf-balance-meta">
          <span className="wf-leaf-dot">◆</span> WIENER
          <span className="wf-usd-pill">≈ {money(usd,4)} USDT</span>
        </div>
      </div>
      <img className="wf-balance-art" src="https://pixlinkhost.vercel.app/i/DTBrE-73Ag" alt="" aria-hidden="true" loading="eager" decoding="async"/>
    </section>

    <div className="wf-home-actions">
      <button className="wf-action-btn wf-action-earn" onClick={()=>setTab('ads')}>
        <AnimatedIcon name="bolt" active/><span>EARN</span>
      </button>
      <button className="wf-action-btn wf-action-withdraw" onClick={()=>setTab('wallet')}>
        <AnimatedIcon name="download" active/><span>WITHDRAW</span>
      </button>
    </div>

    <button className="wf-feature-card" onClick={()=>setTab('stars')}>
      <img className="wf-feature-image" src="https://pixlinkhost.vercel.app/i/stWqIolUtw" alt="" aria-hidden="true"/>
      <span className="wf-feature-copy">
        <b>Mine Telegram Stars</b>
        <small>Pick a gift, mine it → claim real Telegram gifts</small>
      </span>
      <span className="wf-feature-arrow">›</span>
    </button>

    <button className="wf-feature-card" onClick={()=>setTab('ads')}>
      <img className="wf-feature-image" src="https://pixlinkhost.vercel.app/i/ztSi1qACtw" alt="" aria-hidden="true"/>
      <span className="wf-feature-copy">
        <b>Quick Tasks</b>
        <small>Watch ads and earn WIENER instantly</small>
      </span>
      <span className="wf-feature-arrow">›</span>
    </button>

    <section className="wf-home-section">
      <div className="wf-section-title">
        <span><i/>WATCH &amp; EARN</span>
        <small>Available today</small>
      </div>
      <div className="wf-ad-grid">
        {[1,2,3].map((n,i)=>{
          const limit=[7,10,5][i];
          const watched=Number(u.ads_watched_today||0);
          const reward=Number(settings.ad_reward||10);
          return <button className="wf-ad-card" key={n} onClick={()=>setTab('ads')}>
            <div className="wf-ad-top">
              <span>AD #{n}</span>
              <b>{Math.min(watched,limit)}/{limit}</b>
            </div>
            <div className="wf-ad-icon">
              <img src="https://pixlinkhost.vercel.app/i/dfzvtrmcvA" alt="" aria-hidden="true"/>
            </div>
            <div className="wf-ad-reward">
              <img src="https://pixlinkhost.vercel.app/i/YZEVHOSCqA" alt="" aria-hidden="true"/>
              <span>{i===0?reward*2:reward} W</span>
            </div>
            <span className="wf-watch-btn">WATCH</span>
          </button>
        })}
      </div>
    </section>

    <section className="wf-home-section">
      <div className="wf-section-title">
        <span><i/>FEATURED TASKS</span>
        <button onClick={()=>setTab('tasks')}>See all ›</button>
      </div>
      <div className="wf-task-list">
        {homeTasks.length ? homeTasks.map((task:any)=>
          <button className="wf-task-row" key={task.id} onClick={()=>setTab('tasks')}>
            <span className="wf-task-icon"><AnimatedIcon name="tasks" active/></span>
            <span className="wf-task-copy">
              <b>{task.title}</b>
              <small>{task.description||'Complete this official Wiener task'}</small>
            </span>
            <strong>◆ {money(task.reward)}</strong>
            <span className="wf-task-arrow">›</span>
          </button>
        ) : null}
      </div>
    </section>
  </>
}
function Countdown({to}:{to:number}){const [n,setN]=useState(Math.max(0,to-Date.now()));useEffect(()=>{setN(Math.max(0,to-Date.now()));const x=window.setInterval(()=>setN(Math.max(0,to-Date.now())),1000);return()=>window.clearInterval(x)},[to]);const sec=Math.ceil(n/1000),h=Math.floor(sec/3600),m=Math.floor(sec%3600/60),s=sec%60;return <div className="countdown">{n<=0?'Ready now':`Ready in ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`}</div>}
function DailyCard({data,run}:{data:Snapshot;run:any}){const [bioGate,setBioGate]=useState(false),[bioChecking,setBioChecking]=useState(false),[clock,setClock]=useState(Date.now()),u:any=data.user,{done,currentDay,currentWeek,nextDay,nextWeek,multiplier,reward,stars}=nextDaily(data),displayDay=done?Math.max(1,currentDay):nextDay,displayWeek=done?currentWeek:nextWeek,starSlots=[0,1,2,3];useEffect(()=>{if(!done)return;const x=window.setInterval(()=>setClock(Date.now()),1000);return()=>window.clearInterval(x)},[done]);const nextReset=Date.UTC(new Date(clock).getUTCFullYear(),new Date(clock).getUTCMonth(),new Date(clock).getUTCDate()+1),left=Math.max(0,nextReset-clock),sec=Math.ceil(left/1000),hh=Math.floor(sec/3600),mm=Math.floor(sec%3600/60),ss=sec%60,claimLockText=`🔒 CLAIMED · NEXT IN ${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;/* DAILY_CLAIM_LOCK_COUNTDOWN_V74 */const claimDaily=async()=>{if(done||bioChecking)return;const success=displayDay===7?'Week complete · ⭐ earned':'Daily WIENER claimed';try{setBioChecking(true);await api('daily_bio_check');await run('daily_claim',{},success)}catch(e:any){const raw=String(e?.message||e||'');if(/bio|referral|daily_bio|link/i.test(raw))setBioGate(true);else throw e}finally{setBioChecking(false)}};return <section className="card daily"><style>{`.daily-meta{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin:10px 0 2px}.daily-pill{font-size:10px;font-weight:900;padding:5px 8px;border-radius:999px;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.07)}.daily-stars{display:flex;align-items:center;gap:5px;margin:8px 0 11px;font-size:12px}.daily-stars i{font-style:normal;opacity:.24}.daily-stars i.on{opacity:1}.daily-stars span{margin-left:3px;font-size:10px;opacity:.58}.daily-loyalty{font-size:10px;opacity:.58;margin-top:7px;text-align:center}`}</style><div className="section-head"><div className="square gift"><AnimatedIcon name="gift" active={!done}/></div><div><h3>Daily Bonus</h3><p>{done?`Week ${displayWeek} · Day ${displayDay} claimed`:`Week ${displayWeek} · Day ${displayDay} of 7`}</p></div><span className="reward-chip">{done?'DONE':`+${money(reward)} WIENER`}</span></div><div className="daily-meta"><span className="daily-pill">{money(multiplier,2)}× loyalty</span><span className="daily-pill">🔥 {Number(u.daily_streak||0)} day streak</span></div><div className="days">{[1,2,3,4,5,6,7].map(d=><div key={d} className={!done&&d===displayDay?'day current':d<=currentDay?'day done':'day'}><b>{d}</b><small>D{d}</small>{d===7&&<em>⭐</em>}</div>)}</div><div className="daily-stars">{starSlots.map(i=><i className={i<stars?'on':''} key={i}>⭐</i>)}<span>{stars}/4 · Loyalty Chest</span></div><button className="primary" disabled={done||bioChecking} onClick={claimDaily}>{done?claimLockText:bioChecking?'CHECKING BIO…':displayDay===7?`CLAIM DAY 7 + ⭐ · ${money(reward)} WIENER`:`CLAIM ${money(reward)} WIENER`}</button><div className="daily-loyalty">Complete 4 weekly streaks to unlock a Loyalty Chest automatically.</div><DailyBioClaimGate open={bioGate} data={data} run={run} onClose={()=>setBioGate(false)} successMessage={displayDay===7?'Week complete · ⭐ earned':'Daily WIENER claimed'}/></section>}

export function DailyPage({data,run}:{data:Snapshot;run:any}){const u:any=data.user;return <><div className="page-title"><h2>DAILY WIENER</h2></div><DailyCard data={data} run={run}/><div className="info-box">🔥 Best streak: {u.best_streak||u.daily_streak||0} days · Stay active to increase your weekly loyalty bonus up to 1.15×.</div></>}
export function ClaimPage({data,run}:{data:Snapshot;run:any}){const s=data.settings,[busy,setBusy]=useState(false),[clock,setClock]=useState(Date.now()),f=farmInfo(data);useEffect(()=>{if(!f.started||f.ready)return;const ms=Math.max(250,Math.min(1000,f.next-Date.now()+50));const x=window.setTimeout(()=>setClock(Date.now()),ms);return()=>window.clearTimeout(x)},[f.started,f.ready,f.next,clock]);const start=async()=>{if(busy||f.limitReached||f.started)return;try{setBusy(true);await run('farm_start',{},'🌱 Farm started')}finally{setBusy(false)}};return <><div className="page-title"><h2>WIENER FARM</h2></div><section className="hero card glow"><div className="square claim-icon"><AnimatedIcon name="bolt" active={!f.limitReached}/></div><h2>{f.limitReached?'Daily farm limit reached':!f.started?'Farm is idle':f.ready?'Your WIENER is ready':'Your next WIENER is growing'}</h2><p className="muted">Today's farms · {f.count}/5</p>{f.limitReached?<button className="primary" disabled>COME BACK TOMORROW</button>:!f.started?<button className="primary button-with-icon" disabled={busy} onClick={start}><AnimatedIcon name="bolt" active/>{busy?'STARTING…':'START FARM'}</button>:f.ready?<button className="primary button-with-icon" onClick={()=>run('farm_claim')}><AnimatedIcon name="gift" active/>CLAIM {s.farm_claim_reward} WIENER</button>:<Countdown to={f.next}/>}</section></>}

export function Ads({data,refresh,say}:{data:Snapshot;refresh:any;say:any}){
  const [busy,setBusy]=useState(false),[session,setSession]=useState('');
  const s=data.settings,u:any=data.user;
  const used=u.ads_day===today()?Number(u.ads_watched_today||0):0;
  const done=new Set((data.completed||[]).map((x:any)=>x.task_id));
  const tasks=(data.tasks||[]).filter((t:any)=>!done.has(t.id));
  const official=tasks.filter((t:any)=>String(t.category||'official').toLowerCase()==='official');
  const other=tasks.filter((t:any)=>String(t.category||'official').toLowerCase()!=='official');
  const watch=async()=>{
    if(!s.adsgram_block_id){say('Ads are temporarily unavailable');return}
    try{
      setBusy(true);
      const x=await api('ad_start');
      setSession(x.session_id);
      const c=window.Adsgram?.init({blockId:String(s.adsgram_block_id)});
      if(!c)throw Error('AdsGram SDK unavailable');
      await c.show();
      say('Ad completed — verifying reward…');
      let credited=false;
      for(let i=0;i<12;i++){
        await new Promise(r=>setTimeout(r,1500));
        const st=await api('ad_status',{session_id:x.session_id});
        if(st?.status==='credited'){
          credited=true;
          say(`+${st.reward||s.ad_reward} WIENER`);
          await refresh();
          break;
        }
      }
      if(!credited)say('Reward is still verifying. Check again shortly.');
    }catch(e:any){say(e.message)}finally{setBusy(false)}
  };
  const taskIcon=(t:any)=>{
    const h=`${t.title||''} ${t.description||''}`.toLowerCase();
    return h.includes('group')?'👥':h.includes('bio')?'🪪':h.includes('pay')?'💸':h.includes('channel')?'📢':h.includes('x')||h.includes('twitter')?'𝕏':'✓';
  };
  const taskRow=(t:any)=><div className="wf-earn-task" key={t.id}>
    <div className="wf-earn-task-icon">{taskIcon(t)}</div>
    <div className="wf-earn-task-copy">
      <b>{t.title}</b>
      <small>{t.description||'Complete this task to earn WIENER'}</small>
    </div>
    <strong><img src="https://pixlinkhost.vercel.app/i/YZEVHOSCqA" alt="" aria-hidden="true"/>+{money(t.reward)}</strong>
    <button className="wf-earn-task-open" onClick={()=>{if(t.url)window.Telegram?.WebApp?.openLink?.(t.url);setTimeout(()=>refresh(),800)}} aria-label={`Open ${t.title}`}>›</button>
  </div>;
  return <div className="wf-earn-page">
    <header className="wf-earn-head">
      <div><span>COMPLETE &amp; COLLECT</span><h2>Earn</h2></div>
      <div className="wf-earn-counter"><b>{used}</b><small>/{s.daily_ad_limit} ads</small></div>
    </header>
    <section className="wf-earn-section">
      <div className="wf-earn-section-head"><span><i/>WATCH &amp; EARN</span><small>{Math.max(0,s.daily_ad_limit-used)} available</small></div>
      <div className="wf-earn-ad-grid">
        {[1,2,3].map((n,i)=>{
          const limit=[7,10,5][i];
          const watched=Math.min(used,limit);
          const reward=Number(s.ad_reward||10)*(i===0?2:1);
          return <button className="wf-earn-ad" key={n} onClick={watch} disabled={busy||used>=s.daily_ad_limit}>
            <div className="wf-earn-ad-top"><span>AD #{n}</span><b>{watched}/{limit}</b></div>
            <img className="wf-earn-eye" src="https://pixlinkhost.vercel.app/i/dfzvtrmcvA" alt="" aria-hidden="true"/>
            <div className="wf-earn-reward"><img src="https://pixlinkhost.vercel.app/i/YZEVHOSCqA" alt="" aria-hidden="true"/><b>{reward}</b><small>WIENER</small></div>
            <span className="wf-earn-watch">{used>=s.daily_ad_limit?'DONE':busy?'WAIT':'WATCH'}</span>
          </button>
        })}
      </div>
    </section>
    <section className="wf-earn-section">
      <div className="wf-earn-section-head"><span><i/>SOCIAL TASKS</span><small>{official.length} available</small></div>
      <div className="wf-earn-task-list">
        {official.length?official.map(taskRow):<div className="wf-earn-empty">No official tasks available right now.</div>}
      </div>
    </section>
    {other.length>0&&<section className="wf-earn-section">
      <div className="wf-earn-section-head"><span><i/>MORE TASKS</span><small>{other.length} available</small></div>
      <div className="wf-earn-task-list">{other.map(taskRow)}</div>
    </section>}
    <div className="wf-earn-note">Rewards are added after the task or ad is verified.</div>
    {session&&<div className="wf-earn-session">Verification: {session.slice(0,8)}…</div>}
  </div>
}
export function Tasks({data,run}:{data:Snapshot;run:any}){
  const targetId=new URLSearchParams(window.location.search).get('task'),target=data.tasks.find(t=>t.id===targetId),[cat,setCat]=useState(target?.category||'official'),done=new Set(data.completed.map(x=>x.task_id)),items=data.tasks.filter(t=>t.category===cat),count=data.completed.length;
  useEffect(()=>{if(target){setCat(target.category);setTimeout(()=>document.getElementById(`task-${target.id}`)?.scrollIntoView({behavior:'smooth',block:'center'}),120)}},[targetId]);
  return <><section className="card progress-card"><div className="section-head"><div className="square check"><AnimatedIcon name="tasks" active/></div><div><h3>Your Progress</h3><p>{count} current tasks completed</p></div></div><div className="progress"><span style={{width:`${data.tasks.length?Math.min(100,count/data.tasks.length*100):0}%`}}/></div></section><div className="tabs">{['official','exclusive','partner'].map(x=><button className={cat===x?'active':''} onClick={()=>setCat(x)} key={x}>{x[0].toUpperCase()+x.slice(1)}</button>)}</div><section className="card task-list">{items.length?items.map(t=><div className={`task ${targetId===t.id?'target-task':''}`} id={`task-${t.id}`} key={t.id}><div className="square check"><AnimatedIcon name="check" active={done.has(t.id)}/></div><div className="grow"><h3>{t.title}{t.is_daily&&<span className="tag">DAILY</span>}</h3><p>+{t.reward} WIENER · {t.description||t.category}{t.expires_at?` · Ends ${date(t.expires_at)}`:''}</p></div><button className="primary small" disabled={done.has(t.id)} onClick={()=>{if(t.url)window.Telegram?.WebApp?.openLink?.(t.url);setTimeout(()=>run('task_claim',{task_id:t.id},`+${t.reward} WIENER`),800)}}>{done.has(t.id)?'DONE':'JOIN'}</button></div>):<div className="empty">No {cat} tasks right now.</div>}</section></>}

export function Invite({data,say}:{data:Snapshot;say:any}){const s=data.settings,u=data.user,link=`https://t.me/${String(s.bot_username||'@WienerDogeFarmBot').replace('@','')}?startapp=ref_${u.telegram_id}`;const share=()=>window.Telegram?.WebApp?.openTelegramLink?.(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('Join WIENER and earn rewards with me!')}`);return <><section className="card invite-hero"><div className="invite-icon"><AnimatedIcon name="invite" active/></div><h2>Invite Friends</h2><p>Invite friends to WIENER and earn <b>{s.referral_active_reward} WIENER</b> when they qualify after {s.referral_active_ads_required} verified ads.</p><div className="stats bigstats"><div><b>{u.referrals_count}</b><span>INVITED</span></div><div><b>{u.active_referrals_count}</b><span>QUALIFIED</span></div><div><b>{money(u.referral_earnings)}</b><span>EARNED</span></div></div></section><h4 className="eyebrow outside">YOUR INVITE LINK</h4><section className="card"><div className="link-row"><input readOnly value={link}/><button onClick={async()=>{await navigator.clipboard.writeText(link);say('Invite link copied')}}>▢</button></div><button className="primary button-with-icon" onClick={share}><AnimatedIcon name="share" active/>SHARE INVITE</button></section><div className="reward-grid"><div><i className="icon-wrap"><AnimatedIcon name="invite" active/></i><b>{u.referrals_count}</b><span>Invited</span></div><div><i className="icon-wrap"><AnimatedIcon name="check" active/></i><b>{u.active_referrals_count}</b><span>Qualified</span></div><div><i className="icon-wrap"><AnimatedIcon name="coins" active/></i><b>+{s.referral_active_reward}</b><span>Per qualified</span></div></div>{data.referrals.length>0&&<section className="card"><h3>Recent referrals</h3>{data.referrals.slice(0,8).map(r=><div className="refrow" key={r.telegram_id}><span>{r.first_name||r.username||r.telegram_id}</span><b>{r.referral_active?'QUALIFIED':`${r.total_ads}/${s.referral_active_ads_required} ads`}</b></div>)}</section>}</>}

export function LeaderboardPage({data}:{data:Snapshot}){const rows=data.leaderboard||[],medals=['🥇','🥈','🥉'];return <><div className="page-title"><h2>WIENER LEADERBOARD</h2></div><section className="card leaderboard-card"><div className="rank-me">Your Rank <b>#{data.rank||'-'}</b></div>{rows.length?rows.map((u:any,i:number)=><div className="leader-row" key={u.telegram_id}><span className="leader-pos">{medals[i]||`${i+1}.`}</span><div className="grow"><b>{u.first_name||u.username||`User ${String(u.telegram_id).slice(-4)}`}</b><small>Total earned</small></div><strong>{money(u.total_earned)} WIENER</strong></div>):<div className="empty">No rankings yet.</div>}</section></>}

export function ProfilePage({data,setTab}:{data:Snapshot;setTab:any}){const u=data.user;return <><div className="page-title"><h2>WIENER PROFILE</h2></div><section className="card profile-card"><div className="profile-avatar">{u.photo_url?<img src={u.photo_url}/>:String(u.first_name||'W')[0]}</div><h2>{u.first_name||u.username||'WIENER User'}</h2><div className="profile-grid"><div><span>Balance</span><b>{money(u.balance)} WIENER</b></div><div><span>Streak</span><b>{u.daily_streak||0} days</b></div><div><span>Best Streak</span><b>{u.best_streak||u.daily_streak||0} days</b></div><div><span>Referrals</span><b>{u.referrals_count||0}</b></div><div><span>Qualified</span><b>{u.active_referrals_count||0}</b></div><div><span>Tasks</span><b>{data.tasks_completed_total??data.completed.length}</b></div><div><span>Rank</span><b>#{data.rank||'-'}</b></div><div><span>Total Earned</span><b>{money(u.total_earned)} WIENER</b></div></div><button className="primary" onClick={()=>setTab('wallet')}>OPEN WALLET</button></section></>}

export function Wallet({data,run,setTab}:{data:Snapshot;run:any;setTab:any}){const s=data.settings,u=data.user,[wallet,setWallet]=useState(''),[amount,setAmount]=useState(''),[owner,setOwner]=useState('');const usd=Number(u.balance)/WIENER_PER_USDT,gross=Number(amount||0)/WIENER_PER_USDT,receive=Math.max(0,gross-Number(s.withdraw_fee_usdt));return <><section className="hero card"><div className="eyebrow">AVAILABLE TO WITHDRAW</div><div className="hero-balance"><span className="coin">W</span><strong>{money(u.balance)}</strong><b>WIENER</b></div><div className="muted">≈ {money(usd,4)} USDT</div><div className="tiny">{money(WIENER_PER_USDT)} WIENER = 1 USDT</div></section><section className="card withdraw"><div className="section-head"><div className="square blue"><AnimatedIcon name="download" active/></div><div><h3>Withdraw</h3><p>{s.withdraw_asset_label}</p></div></div><label>YOUR WALLET ADDRESS</label><input placeholder="UQ… / EQ…" value={wallet} onChange={e=>setWallet(e.target.value)}/><label>AMOUNT</label><div className="amount-row"><input type="number" placeholder={`min ${s.minimum_withdraw}`} value={amount} onChange={e=>setAmount(e.target.value)}/><button onClick={()=>setAmount(String(u.balance))}>MAX</button></div><div className="receive">You receive ≈ <b>{money(receive,4)}</b> USDT</div><div className="fee">Network fee <b>{s.withdraw_fee_usdt} USDT</b> · deducted from payout</div><button className="primary button-with-icon" disabled={!s.withdrawals_enabled} onClick={()=>run('withdraw_request',{amount:Number(amount),wallet},'Withdrawal requested')}><AnimatedIcon name="wallet" active={s.withdrawals_enabled}/>REQUEST WITHDRAWAL</button><div className="tiny center">One withdrawal every {s.withdraw_cooldown_hours}h</div></section><h4 className="eyebrow outside">TRANSACTION HISTORY</h4><section className="card history">{data.transactions.length?data.transactions.map(x=><div className="tx" key={x.id}><div className={Number(x.amount)>=0?'arrow up':'arrow down'}><AnimatedIcon name={Number(x.amount)>=0?'arrowUp':'arrowDown'} active/></div><div className="grow"><h3>{cleanUserText(x.description)}</h3><p>{date(x.created_at)}</p></div><b className={Number(x.amount)>=0?'plus':'minus'}>{Number(x.amount)>=0?'+':''}{money(x.amount)} WIENER</b></div>):<div className="empty">No transactions yet.</div>}</section>{!data.is_admin&&<section className="owner-setup"><details><summary>Owner setup</summary><p>Use the one-time bootstrap code to claim the first owner account.</p><div className="promo-row"><input placeholder="BOOTSTRAP CODE" value={owner} onChange={e=>setOwner(e.target.value)}/><button className="primary small" onClick={async()=>{try{await api('admin_bootstrap',{code:owner});await run('bootstrap',{},'Owner access enabled');setTab('admin')}catch{}}}>ACTIVATE</button></div></details></section>}</>}
