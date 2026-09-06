import fs from 'node:fs';

const p='src/SpinEarn.tsx';
if(!fs.existsSync(p)) process.exit(0);
let s=fs.readFileSync(p,'utf8');

// One-per-mini-app-session availability prompt. It only appears after the server
// confirms there is at least one usable spin. sessionStorage resets on a fresh login.
s=s.replace(
  "const [open,setOpen]=useState(false),[status,setStatus]=useState<SpinStatus|null>(null),[busy,setBusy]=useState(false),[adBusy,setAdBusy]=useState(false),[shareBusy,setShareBusy]=useState(false),[rotation,setRotation]=useState(0),[prize,setPrize]=useState<Prize|null>(null),[withdrawOpen,setWithdrawOpen]=useState(false),[amount,setAmount]=useState(''),[message,setMessage]=useState('');",
  "const [open,setOpen]=useState(false),[status,setStatus]=useState<SpinStatus|null>(null),[busy,setBusy]=useState(false),[adBusy,setAdBusy]=useState(false),[shareBusy,setShareBusy]=useState(false),[loginSpinPrompt,setLoginSpinPrompt]=useState(false),[rotation,setRotation]=useState(0),[prize,setPrize]=useState<Prize|null>(null),[withdrawOpen,setWithdrawOpen]=useState(false),[amount,setAmount]=useState(''),[message,setMessage]=useState('');"
);

const loadOld="const load=async()=>{try{const x=await spinApi('status');let bonus:any=null;try{bonus=await spinApi('share_status')}catch{}if(mounted.current)setStatus({...x,share_bonus:bonus||x?.share_bonus})}catch(e:any){if(mounted.current)setMessage(String(e.message||e))}};";
const loadNew="const load=async()=>{try{const x=await spinApi('status');let bonus:any=null;try{bonus=await spinApi('share_status')}catch{}if(mounted.current){const next={...x,share_bonus:bonus||x?.share_bonus};setStatus(next);try{const seen=sessionStorage.getItem('wiener_spin_prompt_seen_v1')==='1';if(!seen&&Number(next?.available_spins||0)>0){sessionStorage.setItem('wiener_spin_prompt_seen_v1','1');setLoginSpinPrompt(true)}}catch{if(Number(next?.available_spins||0)>0)setLoginSpinPrompt(true)}}}catch(e:any){if(mounted.current)setMessage(String(e.message||e))}};";
if(s.includes(loadOld)) s=s.replace(loadOld,loadNew);

if(!s.includes('.spin-login-prompt{')){
  s=s.replace('@keyframes spinFloat',`.spin-login-prompt{position:fixed;inset:0;z-index:10110;display:flex;align-items:flex-end;justify-content:center;padding:18px;background:rgba(3,2,6,.72);backdrop-filter:blur(13px)}.spin-login-card{position:relative;width:min(100%,420px);padding:24px 20px 20px;border-radius:28px;background:radial-gradient(circle at 50% 0,rgba(255,95,46,.16),transparent 42%),linear-gradient(180deg,rgba(35,18,48,.98),rgba(17,8,27,.99));border:1px solid rgba(255,109,49,.45);box-shadow:0 0 0 1px rgba(255,176,71,.08) inset,0 -18px 55px rgba(0,0,0,.48)}.spin-login-card:before{content:'';position:absolute;left:18px;right:18px;top:0;height:3px;border-radius:999px;background:linear-gradient(90deg,#ff9b18,#ff4d2e);box-shadow:0 0 18px rgba(255,101,38,.48)}.spin-login-x{position:absolute;right:14px;top:14px;width:38px;height:38px;border-radius:50%;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#fff;font-size:22px}.spin-login-icon{width:86px;height:86px;margin:2px auto 12px;display:block;object-fit:contain;filter:drop-shadow(0 10px 24px rgba(255,87,42,.28))}.spin-login-card h3{margin:0;text-align:center;font-size:25px;line-height:1.15}.spin-login-card h3 span{color:#ffb237}.spin-login-card p{margin:10px auto 18px;max-width:310px;text-align:center;font-size:13px;line-height:1.5;color:rgba(255,255,255,.67)}.spin-login-cta{width:100%;min-height:56px;border:0;border-radius:18px;background:linear-gradient(100deg,#ffad16,#ff4c21);color:#fff;font-size:17px;font-weight:950;box-shadow:0 13px 30px rgba(255,79,29,.22),inset 0 1px 0 rgba(255,255,255,.3)}.spin-login-later{width:100%;margin-top:12px;border:0;background:transparent;color:rgba(255,255,255,.42);font-weight:850;font-size:12px}.spin-login-count{display:inline-flex;align-items:center;justify-content:center;min-width:34px;height:24px;padding:0 8px;margin-left:5px;border-radius:999px;background:rgba(255,177,55,.12);border:1px solid rgba(255,177,55,.18);color:#ffbd4d;font-size:11px;font-weight:950}@keyframes spinFloat`);
}

const cardNeedle='<section className="card spin-earn-card">';
if(s.includes(cardNeedle) && !s.includes('loginSpinPrompt&&')){
  const modal=`{loginSpinPrompt&&status&&Number(status.available_spins||0)>0?<div className="spin-login-prompt"><div className="spin-login-card"><button className="spin-login-x" onClick={()=>setLoginSpinPrompt(false)}>×</button><img className="spin-login-icon" src={SPIN_ICON} alt=""/><h3>{Number(status.free_left||0)>0?<>Your <span>Daily Spin</span> is ready!</>:<>You have a <span>Spin</span> available!</>}</h3><p>{Number(status.free_left||0)>0?'Your free daily spin is waiting. Spin now and try to win WIENER, TON or bonus spins.':<>You currently have <b>{Number(status.available_spins||0)}</b> spin{Number(status.available_spins||0)===1?'':'s'} ready to use.</>}</p><button className="spin-login-cta" onClick={()=>{setLoginSpinPrompt(false);setOpen(true);hapticImpact('medium')}}>SPIN NOW → <span className="spin-login-count">{Number(status.available_spins||0)}</span></button><button className="spin-login-later" onClick={()=>setLoginSpinPrompt(false)}>Maybe later</button></div></div>:null}`;
  s=s.replace(cardNeedle,modal+cardNeedle);
}

fs.writeFileSync(p,s);
