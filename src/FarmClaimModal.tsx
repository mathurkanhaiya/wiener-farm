import {useState} from 'react';
import {api,type Snapshot} from './lib';
import {AnimatedIcon} from './icons';

type FarmState='ready'|'claiming'|'success'|'failed';

export function FarmClaimModal({open,data,onClose,refresh,say}:{open:boolean;data:Snapshot;onClose:()=>void;refresh:any;say:any}){
  const [state,setState]=useState<FarmState>('ready'),[error,setError]=useState(''),[balance,setBalance]=useState<number|null>(null);
  if(!open)return null;
  const reward=Number(data.settings.farm_claim_reward||0);
  const close=()=>{if(state==='claiming')return;setState('ready');setError('');setBalance(null);onClose()};
  const claim=async()=>{
    if(state==='claiming')return;
    try{
      setState('claiming');setError('');
      const r=await api('farm_claim');
      const fresh=await refresh();
      setBalance(Number(fresh?.user?.balance??r?.balance??data.user.balance));
      setState('success');
      say(`+${reward} WIENER claimed`);
    }catch(e:any){setError(String(e?.message||'Claim failed'));setState('failed')}
  };
  return <div className="farm-claim-overlay" role="dialog" aria-modal="true" aria-label="Claim farm reward">
    <style>{`
      .farm-claim-overlay{position:fixed;inset:0;z-index:10020;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(4,8,10,.72);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);animation:farmFade .18s ease-out}
      .farm-claim-modal{width:min(100%,420px);padding:22px;border:1px solid rgba(255,255,255,.12);border-radius:28px;background:linear-gradient(155deg,rgba(20,28,30,.95),rgba(8,13,15,.93));box-shadow:0 22px 70px rgba(0,0,0,.48),inset 0 1px rgba(255,255,255,.06);animation:farmPop .24s cubic-bezier(.2,.8,.2,1)}
      .farm-claim-head{text-align:center}.farm-claim-icon{width:66px;height:66px;margin:0 auto 14px;display:grid;place-items:center;border-radius:22px;background:rgba(255,255,255,.055);box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)}
      .farm-claim-head h3{margin:0;font-size:22px;letter-spacing:-.3px}.farm-claim-head p{margin:7px 0 0;font-size:13px;opacity:.62}
      .farm-claim-reward{margin:17px 0;padding:18px;text-align:center;border:1px solid rgba(255,255,255,.09);border-radius:20px;background:rgba(255,255,255,.035)}
      .farm-claim-reward span{display:block;font-size:11px;opacity:.55;margin-bottom:4px}.farm-claim-reward strong{font-size:27px}
      .farm-claim-note{display:flex;gap:12px;align-items:center;margin:14px 0 17px;padding:14px;border-radius:18px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08)}
      .farm-claim-note b{display:block;font-size:13px}.farm-claim-note small{display:block;margin-top:3px;opacity:.58;line-height:1.4}
      .farm-claim-actions{display:grid;gap:10px}.farm-claim-actions button{width:100%;min-height:49px;border-radius:16px}.farm-claim-cancel{border:1px solid rgba(255,255,255,.1);background:transparent;color:inherit;opacity:.75}
      .farm-claim-status{text-align:center;padding:24px 8px 8px}.farm-claim-status h3{margin:0 0 7px}.farm-claim-status p{margin:0 0 16px;font-size:13px;opacity:.65;line-height:1.5}.farm-claim-status strong{display:block;font-size:29px;margin:7px 0}.farm-claim-status small{opacity:.6}
      .farm-claim-spinner{width:44px;height:44px;margin:2px auto 16px;border:3px solid rgba(255,255,255,.12);border-top-color:currentColor;border-radius:50%;animation:farmSpin .75s linear infinite}
      @keyframes farmSpin{to{transform:rotate(360deg)}}@keyframes farmFade{from{opacity:0}to{opacity:1}}@keyframes farmPop{from{opacity:0;transform:translateY(10px) scale(.97)}to{opacity:1;transform:none}}
    `}</style>
    <div className="farm-claim-modal">
      {state==='ready'&&<>
        <div className="farm-claim-head"><div className="farm-claim-icon"><AnimatedIcon name="bolt" active/></div><h3>CLAIM FARM REWARD</h3><p>Your WIENER is fully grown and ready to collect.</p></div>
        <div className="farm-claim-reward"><span>READY TO CLAIM</span><strong>+{reward} WIENER</strong></div>
        <div className="farm-claim-note"><div style={{fontSize:24}}>🌾</div><div><b>Harvest ready</b><small>Claim now to start the next farming cycle immediately.</small></div></div>
        <div className="farm-claim-actions"><button className="primary" onClick={claim}>CLAIM {reward} WIENER</button><button className="farm-claim-cancel" onClick={close}>Cancel</button></div>
      </>}
      {state==='claiming'&&<div className="farm-claim-status"><div className="farm-claim-spinner"/><h3>CLAIMING WIENER…</h3><p>Securing your farm reward.</p></div>}
      {state==='success'&&<div className="farm-claim-status"><div style={{fontSize:38}}>✅</div><h3>FARM REWARD CLAIMED</h3><strong>+{reward} WIENER</strong>{balance!=null&&<small>Balance: {balance.toLocaleString()} WIENER</small>}<p style={{marginTop:12}}>Your next farming cycle has started.</p><div className="farm-claim-actions"><button className="primary" onClick={close}>DONE</button></div></div>}
      {state==='failed'&&<div className="farm-claim-status"><div style={{fontSize:38}}>⚠️</div><h3>CLAIM FAILED</h3><p>{error||'Unable to claim this farm reward right now.'}</p><div className="farm-claim-actions"><button className="primary" onClick={claim}>TRY AGAIN</button><button className="farm-claim-cancel" onClick={close}>Cancel</button></div></div>}
    </div>
  </div>
}
