import {useEffect,useState} from 'react';
import {getInitData,money,PUBLISHABLE_KEY,shareApi,SUPABASE_URL,type Snapshot} from './lib';
import {AnimatedIcon} from './icons';

type RankMode='inviters'|'earners';
type RankUser={telegram_id:number|string;username?:string|null;first_name?:string|null;last_name?:string|null;photo_url?:string|null;value:number|string;rank:number};
type Leaderboard={inviters:RankUser[];earners:RankUser[];me?:{inviters?:{rank:number|null;value:number|string};earners?:{rank:number|null;value:number|string}}};

function rankName(x:RankUser){return [x.first_name,x.last_name].filter(Boolean).join(' ').trim()||x.username||`User ${x.telegram_id}`}
function initials(x:RankUser){const n=rankName(x).trim();return (n[0]||'?').toUpperCase()}
function RankAvatar({user,size='small'}:{user:RankUser;size?:'small'|'large'}){const[bad,setBad]=useState(false);return <div className={`rank-avatar ${size}`}>{user.photo_url&&!bad?<img src={user.photo_url} alt="" onError={()=>setBad(true)}/>:<span>{initials(user)}</span>}</div>}

const TOTAL_REWARD=150;
const REFERRAL_RULE_CUTOFF=new Date('2026-09-01T13:34:45.479Z').getTime();

export function Invite({data,say}:{data:Snapshot;say:any}){
  const s=data.settings,u=data.user,[busy,setBusy]=useState(false),[refs,setRefs]=useState<any[]>([]),[qualified,setQualified]=useState<number|null>(null),[refsReady,setRefsReady]=useState(false),[leaderboard,setLeaderboard]=useState<Leaderboard|null>(null),[rankMode,setRankMode]=useState<RankMode>('inviters');
  const link=`https://t.me/${String(s.bot_username||'@WienerDogeFarmBot').replace('@','')}?startapp=ref_${u.telegram_id}`;
  const referralReward=Number(s.referral_active_reward||TOTAL_REWARD);
  const referralUsdText='$0.01';
  const shareText=`🌭 Join WIENER Farm\n\nEarn WIENER by watching ads, completing tasks & inviting friends.\n💰 I can earn up to ${referralReward} WIENER when you become a valid referral.\n\n👇 Open WIENER Farm`;

  useEffect(()=>{let active=true;setRefsReady(false);fetch(`${SUPABASE_URL}/functions/v1/wiener-referral-status`,{method:'POST',headers:{'Content-Type':'application/json','apikey':PUBLISHABLE_KEY},body:JSON.stringify({initData:getInitData()})}).then(r=>r.json()).then(x=>{if(!active)return;if(x?.ok){setRefs(x.data?.referrals||[]);setQualified(Number(x.data?.qualified||0));setLeaderboard(x.data?.leaderboard||null)}else{setRefs([]);setQualified(0);setLeaderboard(null)}}).catch(()=>{if(active){setRefs([]);setQualified(0);setLeaderboard(null)}}).finally(()=>{if(active)setRefsReady(true)});return()=>{active=false}},[]);

  const fallback=()=>window.Telegram?.WebApp?.openTelegramLink?.(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(shareText)}`);
  const share=async()=>{if(busy)return;try{setBusy(true);const wa:any=window.Telegram?.WebApp;if(typeof wa?.shareMessage!=='function'){fallback();return}const prepared=await shareApi();if(!prepared?.id)throw new Error('Share message unavailable');wa.shareMessage(prepared.id)}catch(e:any){say(String(e?.message||'Unable to prepare share message'));fallback()}finally{setBusy(false)}};
  const copy=async()=>{
    let copied=false;
    try{
      if(window.isSecureContext&&navigator.clipboard?.writeText){
        await navigator.clipboard.writeText(link);
        copied=true;
      }
    }catch{}
    if(!copied){
      const input=document.createElement('textarea');
      input.value=link;
      input.setAttribute('readonly','');
      input.setAttribute('aria-hidden','true');
      input.style.position='fixed';
      input.style.left='-9999px';
      input.style.top='0';
      input.style.opacity='0';
      input.style.pointerEvents='none';
      document.body.appendChild(input);
      try{
        input.focus();
        input.select();
        input.setSelectionRange(0,input.value.length);
        copied=document.execCommand('copy');
      }catch{}
      finally{input.remove()}
    }
    if(copied){
      try{window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.('success')}catch{}
      say('Invite link copied');
    }else say('Copy failed — use Invite Friends to share');
  };
  const status=(r:any)=>{if(r.referral_reward_eligible===false)return {label:r.referral_ineligible_reason==='same_device'?'NOT ELIGIBLE · SAME DEVICE':'NOT ELIGIBLE',bad:true};const oldRule=new Date(r.created_at||0).getTime()<REFERRAL_RULE_CUTOFF,required=oldRule?20:5,ads=Number(r.total_ads||0);if(r.referral_active)return {label:`QUALIFIED · ${required}/${required} ADS`,good:true};return {label:`${Math.min(ads,required)}/${required} ADS · NEXT +${referralReward}`}};
  const qualifiedText=refsReady?String(qualified??0):'—';
  const ranking=(leaderboard?.[rankMode]||[]).slice(0,10),podium=ranking.slice(0,3),rest=ranking.slice(3,10),myRank=leaderboard?.me?.[rankMode];
  const valueText=(x:any)=>rankMode==='inviters'?`${Number(x||0).toLocaleString()} referrals`:`${money(Number(x||0))} WIENER`;

  return <><style>{`
  .invite-hero-v2{position:relative;overflow:hidden;padding:22px 18px 18px;background:radial-gradient(circle at 85% 0%,rgba(255,224,62,.14),transparent 42%),linear-gradient(155deg,rgba(255,255,255,.065),rgba(255,255,255,.025));border-color:rgba(255,224,62,.14)}
  .invite-hero-v2:after{content:'';position:absolute;width:150px;height:150px;border-radius:50%;right:-70px;bottom:-95px;background:rgba(255,214,35,.08);filter:blur(12px);pointer-events:none}
  .invite-kicker{font-size:10px;font-weight:950;letter-spacing:1.5px;color:#ffe33b;text-transform:uppercase}.invite-title-row{display:flex;align-items:center;gap:12px;margin-top:8px}.invite-title-row .invite-icon{margin:0;width:48px;height:48px;flex:0 0 48px}.invite-title-row h2{margin:0;font-size:24px;letter-spacing:-.45px}.invite-sub{margin:10px 0 0;font-size:13px;line-height:1.55;color:rgba(255,255,255,.62)}.invite-sub b{color:#fff}
  .invite-total{display:flex;align-items:end;justify-content:space-between;gap:12px;margin-top:18px;padding:14px 15px;border-radius:18px;border:1px solid rgba(255,226,61,.2);background:linear-gradient(180deg,rgba(255,224,62,.105),rgba(255,224,62,.045));box-shadow:inset 0 1px 0 rgba(255,255,255,.07)}.invite-total span{display:block;font-size:10px;font-weight:850;letter-spacing:.65px;color:rgba(255,255,255,.52)}.invite-total strong{display:block;margin-top:2px;font-size:23px;color:#ffe33b;letter-spacing:-.4px}.invite-total em{font-style:normal;font-size:11px;font-weight:850;color:rgba(255,255,255,.55);white-space:nowrap}
  .invite-actions{display:grid;gap:9px}.invite-actions .primary{min-height:55px}.invite-copy{width:100%;min-height:48px;border:1px solid rgba(255,224,62,.25);border-radius:15px;background:rgba(255,224,62,.06);color:#ffe53d;font-size:12px;font-weight:900;letter-spacing:.4px}.invite-copy:active{transform:translateY(1px);background:rgba(255,224,62,.12)}
  .invite-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.invite-stat{padding:12px 7px;text-align:center;border-radius:16px;border:1px solid rgba(255,255,255,.065);background:rgba(255,255,255,.03)}.invite-stat b{display:block;font-size:17px}.invite-stat span{display:block;margin-top:3px;font-size:9px;font-weight:850;letter-spacing:.55px;color:rgba(255,255,255,.45)}
  .refrow b.bad{color:#ff8585}.refrow b.good{color:#69e69a}.ref-loading{display:grid;gap:10px;padding-top:8px}.ref-loading-line{height:42px;border-radius:12px;background:linear-gradient(90deg,rgba(255,255,255,.035),rgba(255,255,255,.08),rgba(255,255,255,.035));background-size:220% 100%;animation:refShimmer 1.15s linear infinite}@keyframes refShimmer{to{background-position:-220% 0}}
  .rank-card{overflow:hidden;padding:16px;background:linear-gradient(155deg,rgba(255,224,62,.075),rgba(255,255,255,.035));border-color:rgba(255,224,62,.14)}.rank-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}.rank-head h3{margin:0;font-size:16px}.rank-head p{margin:3px 0 0;font-size:11px;opacity:.55}.rank-tabs{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px}.rank-tabs button{min-height:42px;border-radius:14px;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.035);color:rgba(255,255,255,.55);font-weight:900;font-size:12px}.rank-tabs button.active{color:#ffe33b;border-color:rgba(255,224,62,.34);background:linear-gradient(180deg,rgba(255,224,62,.13),rgba(255,224,62,.06))}.rank-podium{display:grid;grid-template-columns:1fr 1.14fr 1fr;gap:7px;align-items:end;margin:4px 0 15px}.rank-podium-item{text-align:center;min-width:0;padding:8px 4px 10px;border-radius:18px 18px 10px 10px;background:linear-gradient(180deg,rgba(255,209,46,.11),rgba(255,255,255,.025));border:1px solid rgba(255,213,50,.13)}.rank-podium-item.first{padding-top:3px;min-height:160px;border-color:rgba(255,224,62,.32)}.rank-crown{height:24px;font-size:20px;line-height:24px}.rank-avatar{display:grid;place-items:center;overflow:hidden;margin:auto;border-radius:50%;background:linear-gradient(145deg,#dca914,#7b5700);border:2px solid rgba(255,232,118,.7);color:#fff;font-weight:950}.rank-avatar.small{width:42px;height:42px;font-size:16px}.rank-avatar.large{width:58px;height:58px;font-size:21px}.rank-avatar img{width:100%;height:100%;object-fit:cover}.rank-medal{display:inline-flex;margin-top:-8px;position:relative;z-index:2;padding:2px 7px;border-radius:999px;background:#f5c746;color:#1b1200;font-size:9px;font-weight:950;border:2px solid rgba(20,14,0,.72)}.rank-name{margin-top:6px;font-size:11px;font-weight:950;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rank-user{margin-top:1px;font-size:9px;opacity:.48;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rank-value{margin-top:5px;color:#ffe33b;font-size:10px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rank-list{display:grid;gap:8px}.rank-row{display:grid;grid-template-columns:30px 42px minmax(0,1fr) auto;align-items:center;gap:9px;padding:9px 10px;border-radius:16px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.065)}.rank-num{font-size:13px;font-weight:950;color:#e0af26}.rank-row-copy{min-width:0}.rank-row-copy b{display:block;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rank-row-copy span{display:block;margin-top:2px;font-size:9px;opacity:.45;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rank-row-value{font-size:11px;font-weight:950;color:#ffe33b;text-align:right;white-space:nowrap}.rank-me{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px;padding:11px 12px;border-radius:15px;border:1px solid rgba(95,235,143,.15);background:rgba(95,235,143,.045)}.rank-me span{font-size:10px;opacity:.6}.rank-me b{font-size:12px}.rank-empty{text-align:center;padding:20px 8px;font-size:11px;opacity:.5}
  `}</style>

  <section className="card invite-hero-v2">
    <div className="invite-kicker">Invite • Earn • Grow</div>
    <div className="invite-title-row"><div className="invite-icon"><AnimatedIcon name="invite" active/></div><div><h2>Invite Friends</h2><p className="invite-sub">Earn <b>+{referralReward} WIENER</b> when a new referral completes 5 verified ads.</p></div></div>
    <div className="invite-total"><div><span>TOTAL PER VALID REFERRAL</span><strong>+{referralReward} WIENER</strong></div><em>≈ {referralUsdText}</em></div>
  </section>

  <section className="card invite-actions"><button className="primary button-with-icon" disabled={busy} onClick={share}><AnimatedIcon name="share" active={!busy}/>{busy?'PREPARING…':'INVITE FRIENDS'}</button><button className="invite-copy" onClick={copy}>⧉ COPY INVITE LINK</button></section>

  <div className="invite-stats"><div className="invite-stat"><b>{u.referrals_count}</b><span>INVITED</span></div><div className="invite-stat"><b>{qualifiedText}</b><span>QUALIFIED</span></div><div className="invite-stat"><b>{money(u.referral_earnings)}</b><span>WIENER EARNED</span></div></div>

  <section className="card rank-card"><div className="rank-head"><div><h3>🏆 Referral Rankings</h3><p>{rankMode==='inviters'?'Top players by qualified referrals':'Top players by WIENER earned'}</p></div></div><div className="rank-tabs"><button className={rankMode==='inviters'?'active':''} onClick={()=>setRankMode('inviters')}>Top Inviters</button><button className={rankMode==='earners'?'active':''} onClick={()=>setRankMode('earners')}>Top Earners</button></div>{!refsReady?<div className="ref-loading"><div className="ref-loading-line"/><div className="ref-loading-line"/><div className="ref-loading-line"/></div>:ranking.length?<><div className="rank-podium">{[podium[1],podium[0],podium[2]].map((x,i)=>x?<div className={`rank-podium-item ${x.rank===1?'first':''}`} key={String(x.telegram_id)}><div className="rank-crown">{x.rank===1?'👑':''}</div><RankAvatar user={x} size={x.rank===1?'large':'small'}/><span className="rank-medal">{x.rank===1?'1st':x.rank===2?'2nd':'3rd'}</span><div className="rank-name">{rankName(x)}</div>{x.username&&<div className="rank-user">@{x.username}</div>}<div className="rank-value">{valueText(x.value)}</div></div>:<div key={`empty-${i}`}/>)}</div><div className="rank-list">{rest.map(x=><div className="rank-row" key={String(x.telegram_id)}><div className="rank-num">#{x.rank}</div><RankAvatar user={x}/><div className="rank-row-copy"><b>{rankName(x)}</b><span>{x.username?`@${x.username}`:`UID ${x.telegram_id}`}</span></div><div className="rank-row-value">{rankMode==='inviters'?Number(x.value||0).toLocaleString():money(Number(x.value||0))}</div></div>)}</div>{myRank&&<div className="rank-me"><div><span>Your Rank</span><b>{myRank.rank?`#${myRank.rank}`:'Unranked'}</b></div><b>{valueText(myRank.value)}</b></div>}</>:<div className="rank-empty">No rankings yet.</div>}</section>

  {!refsReady?<section className="card"><h3>Recent referrals</h3><div className="ref-loading"><div className="ref-loading-line"/><div className="ref-loading-line"/></div></section>:refs.length>0&&<section className="card"><h3>Recent referrals</h3>{refs.slice(0,8).map(r=>{const st=status(r);return <div className="refrow" key={r.telegram_id}><span>{r.first_name||r.username||r.telegram_id}</span><b className={st.bad?'bad':st.good?'good':''}>{st.label}</b></div>})}</section>}
  </>;
}