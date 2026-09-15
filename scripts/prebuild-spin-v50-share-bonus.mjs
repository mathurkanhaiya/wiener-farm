import fs from 'node:fs';

const p='src/SpinEarn.tsx';
if(!fs.existsSync(p)) process.exit(0);
let s=fs.readFileSync(p,'utf8');

s=s.replace(
  "import {getInitData,hapticImpact,hapticNotify,PUBLISHABLE_KEY} from './lib';",
  "import {getInitData,hapticImpact,hapticNotify,PUBLISHABLE_KEY,shareApi} from './lib';"
);

s=s.replace(
  "type SpinStatus={enabled:boolean;free_left:number;ad_left:number;bonus_spins:number;available_spins:number;ton_balance:number;withdraw_min_ton:number;wallet?:{address?:string;provider?:string}|null;history?:any[];withdrawals?:any[]};",
  "type SpinStatus={enabled:boolean;free_left:number;ad_left:number;bonus_spins:number;available_spins:number;ton_balance:number;withdraw_min_ton:number;share_bonus?:{eligible:boolean;completed_shares:number;required_shares:number;rewarded:boolean;reward_ton:number};wallet?:{address?:string;provider?:string}|null;history?:any[];withdrawals?:any[]};"
);

s=s.replace(
  "const [open,setOpen]=useState(false),[status,setStatus]=useState<SpinStatus|null>(null),[busy,setBusy]=useState(false),[adBusy,setAdBusy]=useState(false),[rotation,setRotation]=useState(0),[prize,setPrize]=useState<Prize|null>(null),[withdrawOpen,setWithdrawOpen]=useState(false),[amount,setAmount]=useState(''),[message,setMessage]=useState('');",
  "const [open,setOpen]=useState(false),[status,setStatus]=useState<SpinStatus|null>(null),[busy,setBusy]=useState(false),[adBusy,setAdBusy]=useState(false),[shareBusy,setShareBusy]=useState(false),[rotation,setRotation]=useState(0),[prize,setPrize]=useState<Prize|null>(null),[withdrawOpen,setWithdrawOpen]=useState(false),[amount,setAmount]=useState(''),[message,setMessage]=useState('');"
);

s=s.replace(
  "const mounted=useRef(true),statusRef=useRef<SpinStatus|null>(null);statusRef.current=status;",
  "const mounted=useRef(true),statusRef=useRef<SpinStatus|null>(null),shareAttempt=useRef<{session_id:string;hidden_at:number;timer?:number}|null>(null);statusRef.current=status;"
);

s=s.replace(
  "const load=async()=>{try{const x=await spinApi('status');if(mounted.current)setStatus(x)}catch(e:any){if(mounted.current)setMessage(String(e.message||e))}};",
  "const load=async()=>{try{const x=await spinApi('status');let bonus:any=null;try{bonus=await spinApi('share_status')}catch{}if(mounted.current)setStatus({...x,share_bonus:bonus||x?.share_bonus})}catch(e:any){if(mounted.current)setMessage(String(e.message||e))}};"
);

const effectNeedle="useEffect(()=>{mounted.current=true;void load();return()=>{mounted.current=false}},[]);";
if(s.includes(effectNeedle) && !s.includes('share_not_detected_client')){
  s=s.replace(effectNeedle,effectNeedle+`\n useEffect(()=>{\n  const onVisibility=()=>{\n   const a=shareAttempt.current;if(!a)return;\n   if(document.hidden){if(!a.hidden_at)a.hidden_at=Date.now();return}\n   if(!a.hidden_at)return;\n   const hiddenMs=Date.now()-a.hidden_at;shareAttempt.current=null;if(a.timer)window.clearTimeout(a.timer);\n   void (async()=>{try{setShareBusy(true);const x=await spinApi('share_complete',{session_id:a.session_id,hidden_ms:hiddenMs});if(x?.rewarded){hapticNotify('success');setMessage('🎁 +0.0025 TON bonus credited!')}else{setMessage(\`✅ Share detected · \${Number(x?.completed_shares||0)}/5\`)}await load()}catch(e:any){const m=String(e?.message||e||'share_not_detected_client');setMessage(/share not detected/i.test(m)?'Share not detected — send again.':m)}finally{setShareBusy(false)}})();\n  };\n  document.addEventListener('visibilitychange',onVisibility);return()=>document.removeEventListener('visibilitychange',onVisibility);\n },[]);`);
}

const walletNeedle="const ensureWallet=async()=>{const x=await tonApi('status');if(x?.wallet?.address)return x.wallet;throw new Error('Connect your TON wallet in Wallet first.')};";
if(s.includes(walletNeedle) && !s.includes('const shareForTonBonus=async()=>')){
  const shareFn=`const shareForTonBonus=async()=>{if(shareBusy)return;const b=status?.share_bonus;if(!b?.eligible){setMessage('Win TON from Spin & Earn first to unlock the share bonus.');return}if(b?.rewarded){setMessage('✅ Your +0.0025 TON share bonus is already credited.');return}try{setShareBusy(true);setMessage('');const x=await spinApi('share_start');if(x?.already_rewarded){setMessage('✅ Your +0.0025 TON share bonus is already credited.');await load();return}const sid=String(x?.session_id||'');if(!sid)throw new Error('Unable to start share');const wa:any=window.Telegram?.WebApp;let opened=false;try{const prepared=await shareApi();if(prepared?.id&&typeof wa?.shareMessage==='function'){wa.shareMessage(prepared.id);opened=true}}catch{}if(!opened){const txt='🎡 Win WIENER + TON on WIENER Farm! Up to 15 spins daily. Open and try your luck 👇';wa?.openTelegramLink?.(\`https://t.me/share/url?url=\${encodeURIComponent('https://t.me/WienerDogeFarmBot?startapp')}&text=\${encodeURIComponent(txt)}\`)}const a:{session_id:string;hidden_at:number;timer?:number}={session_id:sid,hidden_at:0};a.timer=window.setTimeout(()=>{if(shareAttempt.current?.session_id===sid){shareAttempt.current=null;setShareBusy(false);setMessage('Share not detected — send again.')}},45000);shareAttempt.current=a;setMessage('Send to a friend, then return here to confirm.')}catch(e:any){setMessage(String(e?.message||e));say(String(e?.message||e));setShareBusy(false)}};\n `;
  s=s.replace(walletNeedle,shareFn+walletNeedle);
}

if(!s.includes('.spin-share-bonus{')){
  s=s.replace('@keyframes spinFloat',`.spin-share-bonus{margin-top:10px;padding:12px;border-radius:17px;background:radial-gradient(circle at 90% 0,rgba(50,188,255,.13),transparent 45%),rgba(255,255,255,.045);border:1px solid rgba(79,186,255,.13)}.spin-share-top{display:flex;align-items:center;justify-content:space-between;gap:10px}.spin-share-top strong{font-size:13px}.spin-share-top b{font-size:12px;color:#76d8ff}.spin-share-bonus p{margin:5px 0 9px;font-size:9px;line-height:1.45;opacity:.58}.spin-share-progress{height:6px;border-radius:999px;background:rgba(255,255,255,.07);overflow:hidden;margin-bottom:9px}.spin-share-progress i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#42bfff,#8ee7ff);transition:width .25s ease}.spin-share-bonus button{margin-top:0}.spin-share-lock{font-size:9px;text-align:center;opacity:.5;margin-top:7px}@keyframes spinFloat`);
}

const historyNeedle='<div className="spin-history">';
if(s.includes(historyNeedle) && !s.includes('spin-share-bonus')){
  const shareUi=`<div className="spin-share-bonus"><div className="spin-share-top"><strong>🎁 Want a TON Bonus?</strong><b>+0.0025 TON</b></div><p>After your first TON win, share WIENER Farm with 5 friends. Return too early and the share will not count.</p><div className="spin-share-progress"><i style={{width:\`${Math.min(100,(Number(status?.share_bonus?.completed_shares||0)/5)*100)}%\`}}/></div><button className="spin-secondary" disabled={shareBusy||status?.share_bonus?.rewarded||!status?.share_bonus?.eligible} onClick={shareForTonBonus}>{status?.share_bonus?.rewarded?'✓ BONUS CREDITED':shareBusy?'WAITING FOR SHARE…':\`SHARE WITH FRIEND · ${Number(status?.share_bonus?.completed_shares||0)}/5\`}</button>{!status?.share_bonus?.eligible?<div className="spin-share-lock">Win any TON prize first to unlock.</div>:null}</div>`;
  s=s.replace(historyNeedle,shareUi+historyNeedle);
}

// Make the daily allowance clear in the card copy if the premium prebuild left the older wording.
s=s.replace('Win WIENER, TON & free spins','15 spins/day · Win WIENER, TON & bonus spins');

fs.writeFileSync(p,s);
