import {useEffect,useRef} from 'react';
import './reward-popup.css';

export function AdRewardPopup({reward,fullReward,onClose}:{reward:number;fullReward:number;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 const earned=Number.isFinite(reward)?Math.max(0,reward):0;
 const missed=Number.isFinite(fullReward)?Math.max(0,fullReward-earned):0;
 const format=(value:number)=>value.toLocaleString(undefined,{maximumFractionDigits:3});
 useEffect(()=>{const el=dialog.current;el?.showModal();return()=>el?.close()},[]);
 return <dialog ref={dialog} className="wf-reward-dialog" aria-labelledby="wf-reward-title" aria-describedby="wf-reward-description" onCancel={e=>{e.preventDefault();onClose()}}>
  <div className="wf-reward-icon" aria-hidden="true">✓</div>
  <p className="wf-reward-label">REWARD RECEIVED</p>
  <h2 id="wf-reward-title">+{format(earned)} <span>WIENER</span></h2>
  {missed>0?<div className="wf-reward-missed"><strong>You missed {format(missed)} WIENER</strong><p id="wf-reward-description">Visit the advertiser’s page from the ad and complete the ad to qualify for the full reward.</p></div>:<p id="wf-reward-description" className="wf-reward-success">Your reward is in your balance.</p>}
  <button type="button" autoFocus onClick={onClose}>Got it</button>
 </dialog>;
}
