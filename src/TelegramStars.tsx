import {useState} from 'react';
import {money,type Snapshot} from './lib';

const BIG_TEDDY='https://pixlinkhost.vercel.app/i/H6gKj6gN2A';
const SMALL_TEDDY='https://pixlinkhost.vercel.app/i/95rEFUqyrQ';
const AXE='https://pixlinkhost.vercel.app/i/XKKUtWdxLQ';
const DOG='https://pixlinkhost.vercel.app/i/DTBrE-73Ag';

const num=(s:any,keys:string[])=>{for(const k of keys){const n=Number(s?.[k]);if(Number.isFinite(n)&&n>0)return n}return 0};
const txt=(s:any,keys:string[])=>{for(const k of keys){const v=String(s?.[k]??'').trim();if(v)return v}return ''};
const duration=(sec:number)=>{if(!sec)return '—';const m=Math.floor(sec/60),h=Math.floor(m/60),mm=m%60;return h?(mm?h+'h '+String(mm).padStart(2,'0')+'m':h+'h'):m+'m'};

export function TelegramStarsPage({data,setTab}:{data:Snapshot;setTab:any}){
 const s:any=data.settings||{},u:any=data.user||{},per=Number(s.token_per_usdt||0),balance=Math.floor(Number(u.balance||0));
 const taps=num(s,['telegram_stars_mine_taps','stars_mine_taps','mine_taps']);
 const cooldown=num(s,['telegram_stars_mine_cooldown_seconds','stars_mine_cooldown_seconds','mine_cooldown_seconds']);
 const step=num(s,['telegram_stars_mine_progress_percent','stars_mine_progress_percent','mine_progress_percent']);
 const gift=txt(s,['telegram_stars_gift_name','stars_gift_name','mine_gift_name'])||'Telegram Gift';
 const giftText=txt(s,['telegram_stars_gift_description','stars_gift_description','mine_gift_description']);
 const [progress,setProgress]=useState(0),[busy,setBusy]=useState(false);
 const configured=Boolean(taps&&cooldown&&step),remaining=configured?Math.max(0,Math.ceil((100-progress)/step)):0;
 const mine=()=>{if(!configured||busy||progress>=100)return;setBusy(true);setProgress(p=>Math.min(100,p+step));window.setTimeout(()=>setBusy(false),450)};
 return <div className="wf-stars-page">
  <div className="wf-stars-top"><button className="wf-stars-back" onClick={()=>setTab('home')} aria-label="Back">‹</button><div><span className="wf-stars-kicker">FARM GIFTS</span><h1>Mine Telegram Stars</h1></div></div>
  <section className="wf-stars-balance"><div className="wf-stars-balance-label">TOTAL BALANCE</div><div className="wf-stars-balance-number">{money(balance)}</div><div className="wf-stars-balance-meta"><span>◆ WIENER</span><span className="wf-stars-usd">{per?'≈ '+money(balance/per,4)+' USDT':'—'}</span></div><img src={DOG} className="wf-stars-balance-art" alt="" aria-hidden="true"/></section>
  <section className="wf-stars-mine">
   <div className="wf-stars-mine-art"><img src={BIG_TEDDY} className="wf-stars-big-teddy" alt="" aria-hidden="true"/></div>
   <h2>Mining {gift}</h2>
   <div className="wf-stars-sub">{taps?taps+' taps':'— taps'} · {cooldown?duration(cooldown)+' cooldown':'— cooldown'}{giftText?' · '+giftText:''}</div>
   <div className="wf-stars-progress-head"><span>PROGRESS</span><b>{Math.min(100,progress)}%</b></div>
   <div className="wf-stars-track"><i style={{width:Math.min(100,progress)+'%'}}/></div>
   <div className="wf-stars-remaining">{configured?(remaining?remaining+' mines left · +'+step+'% each':'Ready to claim'):'Mining values are controlled by backend settings'}</div>
   <button className="wf-stars-action" disabled={!configured||busy||progress>=100} onClick={mine}><img src={AXE} alt="" aria-hidden="true"/>{progress>=100?'CLAIM GIFT':'WATCH AD · MINE'}{step?' +'+step+'%':''}</button>
  </section>
  <section className="wf-stars-reward"><img src={SMALL_TEDDY} alt="" aria-hidden="true"/><div><h3>YOU'LL GET THIS {gift.toUpperCase()}</h3><p>Gift delivery details are controlled by the backend.</p></div></section>
  <div className="wf-stars-how-title"><i/>HOW IT WORKS</div>
  <section className="wf-stars-how">
   <div><b>1</b><span>Mine the gift by watching a rewarded ad.</span></div>
   <div><b>2</b><span>Reach 100%, then claim the configured gift.</span></div>
   <div><b>3</b><span>The configured delivery flow sends the Telegram gift.</span></div>
  </section>
 </div>
}