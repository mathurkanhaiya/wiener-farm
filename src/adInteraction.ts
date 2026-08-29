export type AdInteractionTracker={
  start:()=>void;
  interacted:()=>boolean;
  stop:()=>void;
};

type AdInteractionOptions={
  allowBlur?:boolean;
};

// AdsGram does not expose advertiser CTA-click events to publishers.
// Default behavior trusts only real WebView visibility/page lifecycle loss.
// Treasury may additionally opt into delayed window blur detection because some
// Telegram Android WebViews keep document.visibilityState='visible' when an
// advertiser opens outside the ad view.
const MIN_HIDDEN_MS=300;
const START_GRACE_MS=500;
const BLUR_GRACE_MS=1200;
const MIN_BLUR_MS=450;

export function trackAdInteraction(options:AdInteractionOptions={}):AdInteractionTracker{
  let startedAt=0;
  let hiddenAt=0;
  let blurAt=0;
  let confirmed=false;

  const eligible=()=>startedAt>0&&Date.now()-startedAt>=START_GRACE_MS;
  const blurEligible=()=>startedAt>0&&Date.now()-startedAt>=BLUR_GRACE_MS;
  const beginHidden=()=>{
    if(!eligible())return;
    if(!hiddenAt)hiddenAt=Date.now();
  };
  const finishHidden=()=>{
    if(hiddenAt&&Date.now()-hiddenAt>=MIN_HIDDEN_MS)confirmed=true;
    hiddenAt=0;
  };
  const beginBlur=()=>{
    if(!options.allowBlur||!blurEligible())return;
    if(!blurAt)blurAt=Date.now();
  };
  const finishBlur=()=>{
    if(blurAt&&Date.now()-blurAt>=MIN_BLUR_MS)confirmed=true;
    blurAt=0;
  };
  const onVisibility=()=>{
    if(document.visibilityState==='hidden')beginHidden();
    else finishHidden();
  };
  const onPageHide=()=>{beginHidden();confirmed=true};
  const onFreeze=()=>{beginHidden();confirmed=true};
  const onBlur=()=>beginBlur();
  const onFocus=()=>finishBlur();

  document.addEventListener('visibilitychange',onVisibility,true);
  window.addEventListener('pagehide',onPageHide,true);
  document.addEventListener('freeze',onFreeze as EventListener,true);
  if(options.allowBlur){
    window.addEventListener('blur',onBlur,true);
    window.addEventListener('focus',onFocus,true);
  }

  return{
    start:()=>{startedAt=Date.now();hiddenAt=0;blurAt=0;confirmed=false},
    interacted:()=>{
      if(confirmed)return true;
      if(hiddenAt&&Date.now()-hiddenAt>=MIN_HIDDEN_MS)return true;
      return Boolean(options.allowBlur&&blurAt&&Date.now()-blurAt>=MIN_BLUR_MS);
    },
    stop:()=>{
      document.removeEventListener('visibilitychange',onVisibility,true);
      window.removeEventListener('pagehide',onPageHide,true);
      document.removeEventListener('freeze',onFreeze as EventListener,true);
      if(options.allowBlur){
        window.removeEventListener('blur',onBlur,true);
        window.removeEventListener('focus',onFocus,true);
      }
    }
  };
}

export const CTA_REQUIRED_MESSAGE='Tap Visit, Play or Open inside the ad before finishing to unlock the reward.';
