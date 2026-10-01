import './adsgramGuard';
import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import {I18nProvider} from './i18n';
import {LocalizedSurface} from './LocalizedSurface';
import {StabilityLayer} from './StabilityLayer';
import {SpinNotificationLayer} from './SpinNotificationLayer';
import './styles.css';
import './styles-spin-card-clean.css';
import './styles-spin-notifications.css';
import './nav-six.css';
import './styles-rich-pro.css';

async function waitForAppStyles(){
  if(typeof document==='undefined') return;
  const links=Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'))
    .filter(link=>!link.href || link.href.startsWith(window.location.origin));
  if(!links.length) return;

  const wait=(link:HTMLLinkElement)=>new Promise<void>((resolve,reject)=>{
    if(link.sheet){resolve();return;}
    const done=()=>{cleanup();resolve()};
    const fail=()=>{cleanup();reject(new Error('WIENER Farm stylesheet failed to load'))};
    const cleanup=()=>{link.removeEventListener('load',done);link.removeEventListener('error',fail)};
    link.addEventListener('load',done,{once:true});
    link.addEventListener('error',fail,{once:true});
  });

  try{
    await Promise.all(links.map(wait));
  }catch{
    // One controlled retry prevents Telegram WebView cache/race failures
    // from ever exposing the unstyled React application.
    const retryLinks=links.filter(link=>link.href).map(link=>{
      const clone=link.cloneNode(true) as HTMLLinkElement;
      clone.href=link.href+(link.href.includes('?')?'&':'?')+'wf_css_retry='+Date.now();
      link.replaceWith(clone);
      return clone;
    });
    try{
      await Promise.all(retryLinks.map(wait));
    }catch{
      // Keep the inline boot splash visible rather than rendering raw HTML.
      throw new Error('WIENER Farm styles could not be loaded. Please retry.');
    }
  }
}

const boot=async()=>{
  try{
    await waitForAppStyles();
    const root=createRoot(document.getElementById('root')!);
    root.render(
      <React.StrictMode>
        <I18nProvider>
          <StabilityLayer>
            <LocalizedSurface/>
            <SpinNotificationLayer/>
            <App/>
          </StabilityLayer>
        </I18nProvider>
      </React.StrictMode>
    );
  }catch(error){
    console.error('WIENER_STYLE_BOOT_FAILED',error);
    const root=document.getElementById('root');
    if(root){
      root.querySelector('.wf-launch p')?.replaceChildren(
        document.createTextNode('Loading styles… tap to retry')
      );
      const button=document.createElement('button');
      button.type='button';
      button.textContent='TRY AGAIN';
      button.style.cssText='margin-top:16px;padding:12px 22px;border:1px solid rgba(255,255,255,.14);border-radius:999px;background:rgba(255,255,255,.07);color:#fff;font:700 12px system-ui;cursor:pointer';
      button.onclick=()=>window.location.reload();
      root.querySelector('.wf-launch-content')?.appendChild(button);
    }
  }
};

void boot();

// Do not block the first app render on remote animated WebP downloads.
// Start warming the animation cache only after the UI is mounted.
if (typeof window !== 'undefined') {
  const warm = () => {
    import('./assetPreload')
      .then(({preloadWienerAnimations}) => preloadWienerAnimations())
      .catch(() => {});
  };
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(warm, {timeout: 1800});
  } else {
    window.setTimeout(warm, 900);
  }
}
