import {Component,useEffect,type ReactNode} from 'react';
import {hapticImpact,hapticNotify} from './lib';

type BoundaryState={error:string};

class AppCrashBoundary extends Component<{children:ReactNode},BoundaryState>{
  state:BoundaryState={error:''};
  static getDerivedStateFromError(error:any){return {error:String(error?.message||error||'Unexpected app error')}}
  componentDidCatch(error:any,info:any){
    console.error('WIENER_APP_RENDER_CRASH',error,info);
    hapticNotify('error');
  }
  render(){
    if(!this.state.error)return this.props.children;
    const reload=()=>window.location.reload();
    const support=()=>window.Telegram?.WebApp?.openTelegramLink?.('https://t.me/WienerSupport');
    return <div className="center-screen app-recovery-screen">
      <div className="state-icon">⚠️</div>
      <h2>WIENER recovered an app error</h2>
      <p>The screen stopped safely instead of going blank. Reload to reconnect to the latest app state.</p>
      <div className="recovery-actions">
        <button className="primary" onClick={reload}>RELOAD APP</button>
        <button className="recovery-secondary" onClick={support}>CONTACT SUPPORT</button>
      </div>
      <small className="recovery-code">{this.state.error.slice(0,180)}</small>
    </div>
  }
}

function GlobalAppEffects(){
  useEffect(()=>{
    let lastTap=0,lastToast='';
    const onTap=(event:PointerEvent)=>{
      const node=event.target as Element|null;
      const el=node?.closest?.('button,a,[role="button"]') as HTMLElement|null;
      if(!el||el.getAttribute('aria-disabled')==='true'||(el as HTMLButtonElement).disabled)return;
      const now=performance.now();if(now-lastTap<55)return;lastTap=now;
      hapticImpact(el.classList.contains('primary')?'medium':'light');
    };
    const onRejection=()=>hapticNotify('error');
    const observeToast=()=>{
      const text=String(document.querySelector('.toast')?.textContent||'').trim();
      if(!text||text===lastToast)return;
      lastToast=text;
      if(/error|failed|invalid|unable|unavailable|timed out|try again|rejected|blocked|denied/i.test(text))hapticNotify('error');
      else if(/wait|checking|verifying|processing|pending/i.test(text))hapticNotify('warning');
      else hapticNotify('success');
    };
    const observer=new MutationObserver(observeToast);
    document.addEventListener('pointerup',onTap,true);
    window.addEventListener('unhandledrejection',onRejection);
    observer.observe(document.body,{childList:true,subtree:true,characterData:true});
    return()=>{
      document.removeEventListener('pointerup',onTap,true);
      window.removeEventListener('unhandledrejection',onRejection);
      observer.disconnect();
    };
  },[]);
  return null;
}

export function StabilityLayer({children}:{children:ReactNode}){
  return <AppCrashBoundary><GlobalAppEffects/>{children}</AppCrashBoundary>
}
