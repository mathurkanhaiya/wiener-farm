export type AdInteractionTracker={
  start:()=>void;
  interacted:()=>boolean;
  stop:()=>void;
};

// AdsGram does not expose advertiser CTA-click events to publishers.
// Treat only a real WebView visibility/page lifecycle loss as the interaction signal.
// Plain window blur is intentionally ignored because opening the AdsGram overlay itself
// can blur the Mini App and cause false positives.
const MIN_HIDDEN_MS=300;
const START_GRACE_MS=500;

export function trackAdInteraction():AdInteractionTracker{
  let startedAt=0;
  let hiddenAt=0;
  let confirmed=false;

  const eligible=()=>startedAt>0&&Date.now()-startedAt>=START_GRACE_MS;
  const beginHidden=()=>{
    if(!eligible())return;
    if(!hiddenAt)hiddenAt=Date.now();
  };
  const finishHidden=()=>{
    if(hiddenAt&&Date.now()-hiddenAt>=MIN_HIDDEN_MS)confirmed=true;
    hiddenAt=0;
  };
  const onVisibility=()=>{
    if(document.visibilityState==='hidden')beginHidden();
    else finishHidden();
  };
  const onPageHide=()=>{beginHidden();confirmed=true};
  const onFreeze=()=>{beginHidden();confirmed=true};

  document.addEventListener('visibilitychange',onVisibility,true);
  window.addEventListener('pagehide',onPageHide,true);
  document.addEventListener('freeze',onFreeze as EventListener,true);

  return{
    start:()=>{startedAt=Date.now();hiddenAt=0;confirmed=false},
    interacted:()=>{
      if(confirmed)return true;
      return Boolean(hiddenAt&&Date.now()-hiddenAt>=MIN_HIDDEN_MS);
    },
    stop:()=>{
      document.removeEventListener('visibilitychange',onVisibility,true);
      window.removeEventListener('pagehide',onPageHide,true);
      document.removeEventListener('freeze',onFreeze as EventListener,true);
    }
  };
}

export const CTA_REQUIRED_MESSAGE='Tap Visit, Play or Open inside the ad before finishing to unlock the reward.';
