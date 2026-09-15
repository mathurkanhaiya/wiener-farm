import {useEffect,useState} from 'react';
import {getInitData,money,PUBLISHABLE_KEY,type Snapshot} from './lib';
import {WalletV2} from './WithdrawV3';

const BLOCK_ID='int-44861';
const REQUIRED=10;

async function gateApi(action:string,body:any={}){
  const controller=new AbortController();
  const timer=window.setTimeout(()=>controller.abort(),15000);
  try{
    const r=await fetch('/functions/v1/wiener-ton-wallet',{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':PUBLISHABLE_KEY,'cache-control':'no-cache'},
      cache:'no-store',
      signal:controller.signal,
      body:JSON.stringify({action,initData:getInitData(),...body}),
    });
    const raw=await r.text();
    let x:any={ok:false,error:'invalid_response'};
    if(raw){try{x=JSON.parse(raw)}catch{x={ok:false,error:raw.slice(0,180)}}}
    if(!r.ok||!x.ok)throw new Error(x.message||x.error||'withdraw_ad_request_failed');
    return x.data??x;
  }finally{
    window.clearTimeout(timer);
  }
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
      else if(raw.includes('watch_full_withdraw_ad'))setMessage('Watch the full sponsor ad before returning. Short views do not count.');
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
  return <div className="withdraw-gate-shell">
    <style>{`
      .withdraw-gate-shell{padding-bottom:calc(104px + env(safe-area-inset-bottom,0px))}
      .withdraw-gate-balance{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 14px;margin-bottom:10px;border-radius:18px}
      .withdraw-gate-balance span{display:block;font-size:9px;font-weight:900;letter-spacing:.08em;opacity:.48}
      .withdraw-gate-balance strong{display:block;margin-top:2px;font-size:27px;line-height:1}
      .withdraw-gate-balance b{font-size:11px;opacity:.6}
      .withdraw-gate-card{padding:16px 14px;border-radius:20px;overflow:hidden;position:relative}
      .withdraw-gate-card:before{content:'';position:absolute;width:150px;height:150px;right:-70px;top:-85px;border-radius:50%;background:radial-gradient(circle,rgba(255,191,53,.13),transparent 68%);pointer-events:none}
      .withdraw-gate-head{position:relative;display:flex;align-items:center;justify-content:space-between;gap:12px}
      .withdraw-gate-title{display:flex;align-items:center;gap:9px}.withdraw-gate-lock{width:34px;height:34px;display:grid;place-items:center;border-radius:11px;background:rgba(255,190,51,.09);border:1px solid rgba(255,203,83,.13);font-size:16px}
      .withdraw-gate-head h3{margin:0;font-size:15px}.withdraw-gate-head strong{font-size:13px;color:#ffe15a}
      .withdraw-gate-card p{position:relative;margin:9px 0 13px;font-size:11px;line-height:1.45;opacity:.65}
      .withdraw-gate-track{position:relative;height:9px;border-radius:999px;overflow:hidden;background:rgba(255,255,255,.065);margin-bottom:7px}
      .withdraw-gate-track i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#ffad19,#ffe55c);box-shadow:0 0 14px rgba(255,199,51,.22);transition:width .28s ease}
      .withdraw-gate-sub{display:flex;justify-content:space-between;gap:8px;margin-bottom:12px;font-size:9px;opacity:.48}
      .withdraw-gate-card .primary{width:100%;min-height:46px;border-radius:14px}
      .withdraw-gate-done{padding:11px;border-radius:13px;text-align:center;font-size:11px;font-weight:900;background:rgba(63,220,132,.08);border:1px solid rgba(63,220,132,.14);color:#acf0c9}
      .withdraw-gate-message{margin-top:10px;padding:10px 11px;border-radius:12px;background:rgba(255,255,255,.045);font-size:10px;line-height:1.4}
      .withdraw-gate-note{margin-top:9px;text-align:center;font-size:9px;line-height:1.4;opacity:.42}
      .withdraw-gate-loading{font-size:11px;opacity:.62}
    `}</style>
    {!unlocked&&<section className="withdraw-gate-balance glass-panel"><div><span>AVAILABLE BALANCE</span><strong>{money(data.user.balance)} <b>WIENER</b></strong></div><div style={{textAlign:'right'}}><span>WITHDRAW ACCESS</span><strong style={{fontSize:13}}>LOCKED</strong></div></section>}
    <section className="withdraw-gate-card glass-panel">
      <div className="withdraw-gate-head"><div className="withdraw-gate-title"><div className="withdraw-gate-lock">{unlocked?'✓':'🔒'}</div><div><h3>{unlocked?'Withdrawal Ready':'Unlock Withdrawal'}</h3></div></div><strong>{Math.min(count,REQUIRED)}/{REQUIRED}</strong></div>
      <p>{unlocked?'Your withdrawal access is unlocked for today. You can continue to the normal withdrawal flow below.':`Complete ${REQUIRED} valid sponsor ads to unlock withdrawals for today. You stay on this screen until all ${REQUIRED} are complete.`}</p>
      <div className="withdraw-gate-track"><i style={{width:`${pct}%`}}/></div>
      <div className="withdraw-gate-sub"><span>{unlocked?'Complete':'Daily sponsor progress'}</span><span>{unlocked?'10/10':`${left} ad${left===1?'':'s'} remaining`}</span></div>
      {unlocked?<div className="withdraw-gate-done">✓ UNLOCKED FOR TODAY</div>:<button className="primary" disabled={busy} onClick={watch}>{busy?'OPENING AD…':count===0?'START · WATCH AD':`WATCH NEXT AD · ${count}/${REQUIRED}`}</button>}
      {message&&<div className="withdraw-gate-message">{message}</div>}
      {!unlocked&&<div className="withdraw-gate-note">Only completed sponsor views count. Progress resets daily at 00:00 UTC. Watching 1 ad does not open the withdrawal form.</div>}
    </section>
    {unlocked&&<WalletV2 data={data} setTab={setTab}/>}
  </div>;
}
