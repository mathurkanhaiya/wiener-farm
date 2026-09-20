import {useEffect,useState} from 'react';
import './splash.css';

export function Splash({text}:{text:string}){
 const [slow,setSlow]=useState(false);
 useEffect(()=>{const timer=window.setTimeout(()=>setSlow(true),12000);return()=>window.clearTimeout(timer)},[]);
 return <div className="wf-launch"><div className="wf-launch-content">
  <div className="wf-launch-coin" aria-hidden="true">W</div>
  <h1>WIENER <span>FARM</span></h1>
  <div className="wf-launch-track" aria-hidden="true"><i/></div>
  <p role="status" aria-live="polite">{slow?'Still connecting to your farm…':text||'Opening your farm…'}</p>
  {slow&&<button type="button" onClick={()=>window.location.reload()}>Try again</button>}
 </div><small className="wf-launch-footer">Your farm. Your rewards.</small></div>;
}
