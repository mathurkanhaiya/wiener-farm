import {useEffect,useState} from 'react';
import {getInitData,money,PUBLISHABLE_KEY,type Snapshot} from './lib';
import {WalletV2} from './WithdrawV3';

const BLOCK_ID='int-44861';
const REQUIRED=10;

async function gateApi(action:string,body:any={}){
  const r=await fetch('/functions/v1/wiener-ton-wallet',{
    method:'POST',
    headers:{'Content-Type':'application/json','apikey':PUBLISHABLE_KEY,'cache-control':'no-cache'},
    cache:'no-store',
    body:JSON.stringify({action,initData:getInitData(),...body}),
  });
  const raw=await r.text();
  let x:any={ok:false,error:'invalid_response'};
  if(raw){try{x=JSON.parse(raw)}catch{x={ok:false,error:raw.slice(0,180)}}}
  if(!r.ok||!x.ok)throw new Error(x.message||x.error||'withdraw_ad_request_failed');
  return x.data??x;
}

export function WithdrawAdGate({data,setTab}:{data:Snapshot;setTab:any}){
  const [checking,setChecking]=useState(true);
  const [supported,setSupported]=useState(false);
  const [count,setCount]=useState(0);
  const [unlocked,setUnlocked]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');

  const load=async()=>{
    try{
      const g=await gateApi('withdraw_ad_status');
      setSupported(true);
      const nextCount=Math.max(0,Number(g.count||0));
      setCount(nextCount);
      // Main app policy is 10 valid sponsor ads. Never trust an older backend value below 10.
      setUnlocked(nextCount>=REQUIRED);
    }catch{
      // Fail open only when the legacy gate API itself is unavailable, preserving wallet availability.
      setSupported(false);
    }finally{
      setChecking(false);
    }
  };

  useEffect(()=>{void load()},[]);

  const watch=async()=>{
    if(busy||unlocked)return;
    let sid='';
    try{
      setBusy(true);
      setMessage('');
      const start=await gateApi('withdraw_ad_start');
      sid=String(start.session_id||'');
      if(!sid){
        // Older backend may report unlocked at 5. Frontend still requires 10 and asks backend for a new session after V95 install.
        const fresh=Math.max(0,Number(start.count||count));
        setCount(fresh);
        if(fresh>=REQUIRED){setUnlocked(true);return}
        throw new Error('withdraw_gate_backend_upgrade_required');
      }

      let tries=0;
      while(!window.Adsgram?.init&&tries<20){
        await new Promise(r=>window.setTimeout(r,100));
        tries++;
      }
      const ad=window.Adsgram?.init({blockId:String(start.block_id||BLOCK_ID)});
      if(!ad)throw new Error('sponsor_ad_unavailable');

      await ad.show();
      const done=await gateApi('withdraw_ad_credit',{session_id:sid});
      const nextCount=Math.max(0,Number(done.count||0));
      const nextUnlocked=nextCount>=REQUIRED;
      setCount(nextCount);
      setUnlocked(nextUnlocked);
      setMessage(nextUnlocked?'✅ 10/10 complete · Withdrawal unlocked.':`✅ Ad counted · ${nextCount}/${REQUIRED}`);
    }catch(e:any){
      if(sid)try{await gateApi('withdraw_ad_fail',{session_id:sid})}catch{}
      const raw=String(e?.message||e);
      if(raw.includes('backend_upgrade_required'))setMessage('Withdrawal unlock is updating. Please try again shortly.');
      else if(raw.includes('watch_full_withdraw_ad'))setMessage('Watch the sponsor ad until Adsgram reports completion, then return.');
      else if(raw.includes('withdraw_ad_session'))setMessage('Ad session expired. Tap WATCH NEXT AD and try again.');
      else setMessage('Sponsor ad is unavailable right now. Try again shortly.');
    }finally{
      setBusy(false);
    }
  };

  if(checking)return <section className="withdraw-gate-card glass-panel"><div className="withdraw-gate-loading">Checking withdrawal access…</div></section>;
  if(!supported)return <WalletV2 data={data} setTab={setTab}/>;

  const pct=Math.min(100,(count/REQUIRED)*100);
  const left=Math.max(0,REQUIRED-count);
  const previewMethods:any[]=Array.isArray((data as any).withdrawal_methods)?(data as any).withdrawal_methods:[];
  const preview=previewMethods[0]||null;
  return <div className="withdraw-gate-shell">
    <style>{` 
      .withdraw-gate-shell{padding:8px 0 calc(104px + env(safe-area-inset-bottom,0px));max-width:100%;overflow:hidden}
      .withdraw-gate-balance{position:relative;display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:112px;padding:18px 20px;margin:0 0 10px;border-radius:0;overflow:hidden;background:linear-gradient(145deg,rgba(8,91,56,.94),rgba(3,48,31,.98));border:1px solid rgba(93,236,164,.22);clip-path:polygon(5% 0,100% 0,100% 80%,93% 100%,0 100%,0 11%);box-shadow:inset 0 1px 0 rgba(255,255,255,.07)}
      .withdraw-gate-balance:after{content:'';position:absolute;right:-25px;top:-50px;width:145px;height:145px;border-radius:50%;background:radial-gradient(circle,rgba(48,235,142,.16),transparent 68%);pointer-events:none}
      .withdraw-gate-balance span{display:block;font-size:9px;font-weight:900;letter-spacing:.16em;opacity:.52}.withdraw-gate-balance strong{display:block;margin-top:3px;font-size:42px;line-height:.95;letter-spacing:-1px}.withdraw-gate-balance b{font-size:10px;letter-spacing:.12em;opacity:.58}.withdraw-gate-access{text-align:right;position:relative;z-index:1}.withdraw-gate-access strong{font-size:14px;letter-spacing:.04em;color:#fff}
      .withdraw-gate-card{padding:18px 18px 16px;border-radius:0;overflow:hidden;position:relative;background:linear-gradient(145deg,rgba(7,72,46,.9),rgba(3,39,27,.96));border:1px solid rgba(91,226,158,.18);clip-path:polygon(5% 0,100% 0,100% 91%,94% 100%,0 100%,0 9%);box-shadow:inset 0 1px 0 rgba(255,255,255,.045)}
      .withdraw-gate-card:before{content:'';position:absolute;right:-60px;top:-70px;width:180px;height:180px;border-radius:50%;background:radial-gradient(circle,rgba(255,193,48,.09),transparent 68%);pointer-events:none}.withdraw-gate-head{position:relative;display:flex;align-items:center;justify-content:space-between;gap:10px}.withdraw-gate-title{display:flex;align-items:center;gap:10px}.withdraw-gate-lock{width:40px;height:40px;display:grid;place-items:center;border-radius:13px;background:rgba(255,191,52,.08);border:1px solid rgba(255,207,77,.16);font-size:19px}.withdraw-gate-head h3{margin:0;font-size:17px;letter-spacing:-.2px}.withdraw-gate-head strong{font-size:14px;color:#ffe15a}.withdraw-gate-card p{position:relative;margin:11px 0 13px;font-size:11px;line-height:1.5;opacity:.62;max-width:560px}.withdraw-gate-track{position:relative;height:8px;border-radius:999px;overflow:hidden;background:rgba(255,255,255,.06);margin-bottom:7px}.withdraw-gate-track i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#20cf83,#6cf0ae);box-shadow:0 0 15px rgba(47,224,139,.22);transition:width .28s ease}.withdraw-gate-sub{display:flex;justify-content:space-between;gap:8px;margin-bottom:13px;font-size:9px;opacity:.46}.withdraw-gate-card .primary{width:100%;min-height:48px;border-radius:0;clip-path:polygon(4% 0,96% 0,100% 18%,100% 82%,96% 100%,4% 100%,0 82%,0 18%);background:linear-gradient(135deg,#3ce0a1,#0cae72)!important;color:#03271a!important;box-shadow:0 8px 24px rgba(30,211,132,.14);font-size:13px;letter-spacing:.12em}.withdraw-gate-done{padding:12px;border-radius:13px;text-align:center;font-size:11px;font-weight:900;background:rgba(63,220,132,.08);border:1px solid rgba(63,220,132,.14);color:#acf0c9}.withdraw-gate-message{margin-top:9px;padding:9px 10px;border-radius:11px;background:rgba(255,255,255,.04);font-size:10px;line-height:1.4}.withdraw-gate-note{margin-top:9px;text-align:center;font-size:9px;line-height:1.4;opacity:.38}
      .withdraw-gate-preview{margin-top:10px;padding:13px 14px;background:rgba(6,62,40,.72);border:1px solid rgba(82,215,149,.13);clip-path:polygon(5% 0,100% 0,100% 88%,95% 100%,0 100%,0 12%)}.withdraw-gate-preview-label{font-size:9px;font-weight:900;letter-spacing:.16em;opacity:.45;margin-bottom:8px}.withdraw-gate-preview-row{display:flex;align-items:center;gap:10px}.withdraw-gate-preview-icon{width:40px;height:40px;display:grid;place-items:center;border-radius:11px;background:rgba(50,214,139,.08);border:1px solid rgba(70,226,151,.12);overflow:hidden}.withdraw-gate-preview-icon img{width:28px;height:28px;object-fit:contain}.withdraw-gate-preview-copy{min-width:0;flex:1}.withdraw-gate-preview-copy b{display:block;font-size:12px}.withdraw-gate-preview-copy span{display:block;margin-top:2px;font-size:9px;opacity:.48}.withdraw-gate-preview-lock{font-size:9px;font-weight:900;opacity:.45}.withdraw-gate-loading{padding:14px;font-size:11px;opacity:.62}
      @media(max-width:390px){.withdraw-gate-balance{min-height:104px;padding:16px 18px}.withdraw-gate-balance strong{font-size:38px}.withdraw-gate-card{padding:16px 15px 14px}.withdraw-gate-head h3{font-size:16px}}
    `}</style>
    <section className="withdraw-gate-balance"><div><span>AVAILABLE BALANCE</span><strong>{money(data.user.balance)}</strong><b>◆ WIENER</b></div><div className="withdraw-gate-access"><span>WITHDRAW ACCESS</span><strong>{unlocked?'UNLOCKED':'LOCKED'}</strong></div></section>
    <section className="withdraw-gate-card"><div className="withdraw-gate-head"><div className="withdraw-gate-title"><div className="withdraw-gate-lock">{unlocked?'✓':'🔒'}</div><div><h3>{unlocked?'Withdrawal Ready':'Unlock Withdrawal'}</h3></div></div><strong>{Math.min(count,${REQUIRED})}/${REQUIRED}</strong></div><p>{unlocked?'Your withdrawal access is unlocked for today. Continue to the payout form below.':`Complete ${REQUIRED} valid sponsor ads to unlock withdrawals for today. Your payout form will appear after all ${REQUIRED} are complete.`}</p><div className="withdraw-gate-track"><i style={{width:`\${pct}%`}}/></div><div className="withdraw-gate-sub"><span>{unlocked?'Daily access':'Daily sponsor progress'}</span><span>{unlocked?'Complete':`\${left} ad\${left===1?'':'s'} remaining`}</span></div>{unlocked?<div className="withdraw-gate-done">✓ UNLOCKED FOR TODAY</div>:<button className="primary" disabled={busy} onClick={watch}>{busy?'OPENING AD…':count===0?'START · WATCH AD':`WATCH NEXT AD · \${count}/${REQUIRED}`}</button>}{message&&<div className="withdraw-gate-message">{message}</div>}{!unlocked&&<div className="withdraw-gate-note">Only Adsgram-completed sponsor views count. Progress resets daily at 00:00 UTC.</div>}</section>
    {!unlocked&&<section className="withdraw-gate-preview"><div className="withdraw-gate-preview-label">PAYOUT METHOD</div><div className="withdraw-gate-preview-row"><div className="withdraw-gate-preview-icon"><img src="https://pixlinkhost.vercel.app/i/pI4wn2rlzA" alt="" /></div><div className="withdraw-gate-preview-copy"><b>{preview?.label||'Select gateway'}</b><span>{preview?.network||'Gateway selection unlocks after sponsor progress'}</span></div><div className="withdraw-gate-preview-lock">LOCKED</div></div></section>}
    {unlocked&&<WalletV2 data={data} setTab={setTab}/>} 
  </div>;
}
