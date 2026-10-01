import {useEffect,useState} from 'react';
import './splash.css';

const DOG='https://pixlinkhost.vercel.app/i/YZEVHOSCqA';

export function Splash({text}:{text:string}){
 const [slow,setSlow]=useState(false);
 const [pct,setPct]=useState(12);

 useEffect(()=>{
  const timer=window.setTimeout(()=>setSlow(true),12000);
  const tick=window.setInterval(()=>setPct(v=>v>=94?94:v+Math.max(1,Math.round((94-v)*.08))),180);
  return()=>{window.clearTimeout(timer);window.clearInterval(tick)};
 },[]);

 return <div className="wf-launch">
  <div className="wf-launch-content">
   <div className="wf-launch-dog-wrap" aria-hidden="true">
    <img className="wf-launch-dog" src={DOG} alt="" />
   </div>

   <div className="wf-launch-brand" aria-label="WIENER FARM">
    <span>W I E N E R</span> <b>F A R M</b>
   </div>

   <div className="wf-launch-track" aria-hidden="true">
    <i style={{width:pct+'%'}}/>
   </div>

   <div className="wf-launch-percent">{pct}%</div>
   <p role="status" aria-live="polite">{slow?'Still connecting to your farm…':text||'Opening your farm…'}</p>

   {slow&&<button type="button" onClick={()=>window.location.reload()}>Try again</button>}
  </div>

  <small className="wf-launch-footer">Your farm. Your rewards.</small>
 </div>;
}
