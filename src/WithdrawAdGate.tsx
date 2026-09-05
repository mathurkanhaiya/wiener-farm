import {useEffect,useState} from 'react';
import {getInitData,money,PUBLISHABLE_KEY,type Snapshot} from './lib';
import {WalletV2} from './WithdrawV3';

const BLOCK_ID='int-44861';
const REQUIRED=5;

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
  const [required,setRequired]=useState(REQUIRED);
  const [unlocked,setUnlocked]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');

  const load=async()=>{
    try{
      const g=await gateApi('withdraw_ad_status');
      setSupported(true);
      setCount(Number(g.count||0));
      setRequired(Number(g.required||REQUIRED));
      setUnlocked(!!g.unlocked);
    }catch{
      // Safe rollout: before the VPS patch is installed, keep the existing wallet usable.
      setSupported(false);
    }finally{
      setChecking(false);
    }
  };

  useEffect(()=>{void load()},[]);

  const watch=async()=>{
    if(busy||unlocked)return;
    try{
      setBusy(true);
      setMessage('');
      const start=await gateApi('withdraw_ad_start');
      if(start.unlocked){
        setCount(Number(start.count||required));
        setRequired(Number(start.required||required));
        setUnlocked(true);
        return;
      }

      let tries=0;
      while(!window.Adsgram?.init&&tries<20){
        await new Promise(r=>window.setTimeout(r,100));
        tries++;
      }
      const ad=window.Adsgram?.init({blockId:String(start.block_id||BLOCK_ID)});
      if(!ad)throw new Error('sponsor_ad_unavailable');

      await ad.show();
      const done=await gateApi('withdraw_ad_credit',{session_id:start.session_id});
      const nextCount=Number(done.count||0);
      const nextRequired=Number(done.required||required);
      const nextUnlocked=!!done.unlocked;
      setCount(nextCount);
      setRequired(nextRequired);
      setUnlocked(nextUnlocked);
      setMessage(nextUnlocked?'✅ Withdrawal unlocked for today.':`✅ Ad counted · ${nextCount}/${nextRequired}`);
    }catch(e:any){
      const raw=String(e?.message||e);
      if(raw.includes('watch_full_withdraw_ad'))setMessage('Watch the full sponsor ad before returning. Short views do not count.');
      else if(raw.includes('withdraw_ad_session'))setMessage('Ad session expired. Tap WATCH AD and try again.');
      else setMessage('Sponsor ad is unavailable right now. Try again shortly.');
    }finally{
      setBusy(false);
    }
  };

  if(checking)return <section className="withdraw-gate-card glass-panel"><div className="withdraw-gate-loading">Checking withdrawal requirements…</div></section>;
  if(!supported)return <WalletV2 data={data} setTab={setTab}/>;

  const pct=Math.min(100,(count/Math.max(1,required))*100);
  return <div className="withdraw-gate-shell">
    <style>{`
      .withdraw-gate-shell{padding-bottom:calc(104px + env(safe-area-inset-bottom,0px))}
      .withdraw-gate-balance{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 14px;margin-bottom:10px;border-radius:18px}
      .withdraw-gate-balance span{display:block;font-size:9px;font-weight:900;letter-spacing:.08em;opacity:.48}
      .withdraw-gate-balance strong{display:block;margin-top:2px;font-size:27px;line-height:1}
      .withdraw-gate-balance b{font-size:11px;opacity:.6}
      .withdraw-gate-card{padding:15px 14px;border-radius:20px}
      .withdraw-gate-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
      .withdraw-gate-head h3{margin:0;font-size:15px}
      .withdraw-gate-head strong{font-size:13px;color:#ffe15a}
      .withdraw-gate-card p{margin:7px 0 12px;font-size:11px;line-height:1.45;opacity:.62}
      .withdraw-gate-track{height:8px;border-radius:999px;overflow:hidden;background:rgba(255,255,255,.07);margin-bottom:12px}
      .withdraw-gate-track i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#ffad19,#ffe55c);transition:width .25s ease}
      .withdraw-gate-card .primary{width:100%;min-height:46px}
      .withdraw-gate-done{padding:11px;border-radius:13px;text-align:center;font-size:11px;font-weight:900;background:rgba(63,220,132,.08);border:1px solid rgba(63,220,132,.14);color:#acf0c9}
      .withdraw-gate-message{margin-top:10px;padding:10px 11px;border-radius:12px;background:rgba(255,255,255,.045);font-size:10px;line-height:1.4}
      .withdraw-gate-note{margin-top:9px;text-align:center;font-size:9px;opacity:.42}
      .withdraw-gate-loading{font-size:11px;opacity:.62}
    `}</style>
    {!unlocked&&<section className="withdraw-gate-balance glass-panel"><div><span>AVAILABLE BALANCE</span><strong>{money(data.user.balance)} <b>WIENER</b></strong></div><div style={{textAlign:'right'}}><span>WITHDRAW STATUS</span><strong style={{fontSize:13}}>LOCKED</strong></div></section>}
    <section className="withdraw-gate-card glass-panel">
      <div className="withdraw-gate-head"><h3>{unlocked?'Withdrawal Unlocked':'Unlock Withdrawal'}</h3><strong>{count}/{required}</strong></div>
      <p>{unlocked?'Your withdrawal access is unlocked for today.':'Watch 5 sponsor ads today to unlock the withdrawal flow.'}</p>
      <div className="withdraw-gate-track"><i style={{width:`${pct}%`}}/></div>
      {unlocked?<div className="withdraw-gate-done">✓ UNLOCKED FOR TODAY</div>:<button className="primary" disabled={busy} onClick={watch}>{busy?'OPENING AD…':`WATCH AD · ${count}/${required}`}</button>}
      {message&&<div className="withdraw-gate-message">{message}</div>}
      {!unlocked&&<div className="withdraw-gate-note">Only counted sponsor views unlock withdrawal. Progress resets daily (UTC).</div>}
    </section>
    {unlocked&&<WalletV2 data={data} setTab={setTab}/>}
  </div>;
}
