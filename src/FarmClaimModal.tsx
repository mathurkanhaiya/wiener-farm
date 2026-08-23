import {useState} from 'react';
import {api,type Snapshot} from './lib';
import {AnimatedIcon} from './icons';

type FarmState='ready'|'showing'|'claiming'|'success'|'failed';

export function FarmClaimModal({open,data,onClose,refresh,say}:{open:boolean;data:Snapshot;onClose:()=>void;refresh:any;say:any}){
  const [state,setState]=useState<FarmState>('ready'),[error,setError]=useState(''),[balance,setBalance]=useState<number|null>(null),[understood,setUnderstood]=useState(false);
  if(!open)return null;
  const reward=Number(data.settings.farm_claim_reward||0);
  const busy=state==='showing'||state==='claiming';
  const close=()=>{if(busy)return;setState('ready');setError('');setBalance(null);setUnderstood(false);onClose()};
  const claim=async()=>{
    if(busy||!understood)return;
    try{
      setError('');
      if(!data.settings.adsgram_block_id)throw new Error('AdsGram Block ID is not configured');
      setState('showing');
      const controller=window.Adsgram?.init({blockId:String(data.settings.adsgram_block_id)});
      if(!controller)throw new Error('AdsGram SDK unavailable');
      const result=await controller.show();
      if(result&&result.done===false)throw new Error(result.description||'Complete the ad to claim your farm reward');
      setState('claiming');
      const r=await api('farm_claim');
      const fresh=await refresh();
      setBalance(Number(fresh?.user?.balance??r?.balance??data.user.balance));
      setState('success');
      say(`+${reward} WIENER claimed`);
    }catch(e:any){
      setError(String(e?.message||'Complete the ad and try again.'));
      setState('failed');
    }
  };
  const retry=()=>{setState('ready');setError('');setUnderstood(false)};
  return <div className="farm-claim-overlay" role="dialog" aria-modal="true" aria-label="Claim farm reward">
    <style>{`
      .farm-claim-overlay{position:fixed;inset:0;z-index:10020;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(4,8,10,.72);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);animation:farmFade .18s ease-out}
      .farm-claim-modal{width:min(100%,420px);padding:22px;border:1px solid rgba(255,255,255,.12);border-radius:28px;background:linear-gradient(155deg,rgba(20,28,30,.95),rgba(8,13,15,.93));box-shadow:0 22px 70px rgba(0,0,0,.48),inset 0 1px rgba(255,255,255,.06);animation:farmPop .24s cubic-bezier(.2,.8,.2,1)}
      .farm-claim-head{text-align:center;margin-bottom:16px}.farm-claim-icon{width:66px;height:66px;margin:0 auto 13px;display:grid;place-items:center;border-radius:22px;background:rgba(255,255,255,.06);box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)}
      .farm-claim-head h3{margin:0;font-size:22px;letter-spacing:-.3px}.farm-claim-head p{margin:7px 0 0;font-size:13px;opacity:.62}
      .farm-claim-note{display:flex;gap:12px;align-items:flex-start;margin:14px 0;padding:15px;border:1px solid rgba(255,255,255,.1);border-radius:20px;background:rgba(255,255,255,.045);box-shadow:0 0 26px rgba(255,190,50,.05)}
      .farm-claim-note-icon{font-size:23px;line-height:1}.farm-claim-note strong{display:block;font-size:14px;margin-bottom:4px}.farm-claim-note small{display:block;line-height:1.45;opacity:.62}
      .farm-claim-reward{margin:14px 0;padding:17px;text-align:center;border:1px solid rgba(255,255,255,.09);border-radius:20px;background:rgba(255,255,255,.035)}
      .farm-claim-reward span{display:block;font-size:11px;opacity:.55;margin-bottom:5px}.farm-claim-reward strong{font-size:27px}
      .farm-claim-check{display:flex;gap:11px;align-items:center;margin:12px 0 16px;padding:13px;border-radius:16px;background:rgba(255,255,255,.035);font-size:12px;line-height:1.4;cursor:pointer}.farm-claim-check input{width:20px;height:20px;accent-color:currentColor;flex:0 0 auto}.farm-claim-check.disabled{opacity:.45;pointer-events:none}
      .farm-claim-actions{display:grid;gap:10px}.farm-claim-actions button{width:100%;min-height:50px;border-radius:16px}.farm-claim-cancel{border:1px solid rgba(255,255,255,.1);background:transparent;color:inherit;opacity:.75}
      .farm-claim-status{text-align:center;padding:22px 8px 10px}.farm-claim-status .big{font-size:36px;margin-bottom:9px}.farm-claim-status h3{margin:0 0 7px}.farm-claim-status p{margin:0 0 16px;font-size:13px;opacity:.65;line-height:1.5}.farm-claim-success strong{display:block;font-size:28px;margin:7px 0}.farm-claim-success small{opacity:.6}
      .farm-claim-spinner{width:42px;height:42px;margin:4px auto 16px;border:3px solid rgba(255,255,255,.12);border-top-color:currentColor;border-radius:50%;animation:farmSpin .8s linear infinite}
      @keyframes farmSpin{to{transform:rotate(360deg)}}@keyframes farmFade{from{opacity:0}to{opacity:1}}@keyframes farmPop{from{opacity:0;transform:translateY(10px) scale(.97)}to{opacity:1;transform:none}}
    `}</style>
    <div className="farm-claim-modal">
      {state==='ready'&&<>
        <div className="farm-claim-head">
          <div className="farm-claim-icon"><AnimatedIcon name="bolt" active/></div>
          <h3>CLAIM FARM REWARD</h3>
          <p>A short ad will play before your farm reward is credited.</p>
        </div>
        <div className="farm-claim-note"><div className="farm-claim-note-icon">▶️</div><div><strong>Complete the ad</strong><small>Watch the rewarded ad until it finishes. No advertiser click or CTA verification is required.</small></div></div>
        <div className="farm-claim-reward"><span>REWARD WAITING</span><strong>+{reward} WIENER</strong></div>
        <label className="farm-claim-check"><input type="checkbox" checked={understood} onChange={e=>setUnderstood(e.target.checked)}/><span>I understand I must complete the ad to receive my farm reward.</span></label>
        <div className="farm-claim-actions"><button className="primary" disabled={!understood} onClick={claim}>▶ WATCH AD TO CLAIM</button><button className="farm-claim-cancel" onClick={close}>Cancel</button></div>
      </>}
      {state==='showing'&&<div className="farm-claim-status"><div className="farm-claim-spinner"/><h3>OPENING AD…</h3><p>Complete the rewarded ad to collect +{reward} WIENER.</p></div>}
      {state==='claiming'&&<div className="farm-claim-status"><div className="farm-claim-spinner"/><h3>CLAIMING REWARD…</h3><p>Ad completed. Adding your farm reward now.</p></div>}
      {state==='success'&&<div className="farm-claim-status farm-claim-success"><div className="big">✅</div><h3>REWARD CLAIMED</h3><strong>+{reward} WIENER</strong>{balance!=null&&<small>Balance: {balance.toLocaleString()} WIENER</small>}<p style={{marginTop:12}}>Your next farming cycle has started.</p><div className="farm-claim-actions"><button className="primary" onClick={close}>DONE</button></div></div>}
      {state==='failed'&&<div className="farm-claim-status"><div className="big">⚠️</div><h3>REWARD NOT CLAIMED</h3><p>{error||'Complete the rewarded ad and try again.'}</p><div className="farm-claim-actions"><button className="primary" onClick={retry}>CLAIM AGAIN</button><button className="farm-claim-cancel" onClick={close}>Cancel</button></div></div>}
    </div>
  </div>
}
