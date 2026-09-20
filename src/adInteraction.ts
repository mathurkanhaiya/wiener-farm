export type AdInteractionTracker={
  start:()=>void;
  interacted:()=>boolean;
  interactionMs:()=>number;
  stop:()=>void;
};

type AdInteractionOptions={
  allowBlur?:boolean;
  minBlurMs?:number;
};

// AdsGram does not expose advertiser CTA-click events to publishers.
// We therefore measure only actual WebView/page visibility loss or window blur.
const START_GRACE_MS=500;
const BLUR_GRACE_MS=1200;
const MIN_BLUR_MS=450;

export function trackAdInteraction(options:AdInteractionOptions={}):AdInteractionTracker{
  let startedAt=0;
  let hiddenAt=0;
  let blurAt=0;
  let maxVisitMs=0;
  const minVisitMs=Math.max(0,Number(options.minBlurMs??MIN_BLUR_MS));

  const eligible=()=>startedAt>0&&Date.now()-startedAt>=START_GRACE_MS;
  const blurEligible=()=>startedAt>0&&Date.now()-startedAt>=BLUR_GRACE_MS;
  const commit=(at:number)=>{if(at>0)maxVisitMs=Math.max(maxVisitMs,Date.now()-at)};
  const beginHidden=()=>{if(eligible()&&!hiddenAt)hiddenAt=Date.now()};
  const finishHidden=()=>{commit(hiddenAt);hiddenAt=0};
  const beginBlur=()=>{if(options.allowBlur&&blurEligible()&&!blurAt)blurAt=Date.now()};
  const finishBlur=()=>{commit(blurAt);blurAt=0};
  const onVisibility=()=>{if(document.visibilityState==='hidden')beginHidden();else finishHidden()};
  const onPageHide=()=>beginHidden();
  const onFreeze=()=>beginHidden();
  const onBlur=()=>beginBlur();
  const onFocus=()=>finishBlur();
  const currentMs=()=>Math.max(maxVisitMs,hiddenAt?Date.now()-hiddenAt:0,(options.allowBlur&&blurAt)?Date.now()-blurAt:0);

  document.addEventListener('visibilitychange',onVisibility,true);
  window.addEventListener('pagehide',onPageHide,true);
  document.addEventListener('freeze',onFreeze as EventListener,true);
  if(options.allowBlur){
    window.addEventListener('blur',onBlur,true);
    window.addEventListener('focus',onFocus,true);
  }

  return{
    start:()=>{startedAt=Date.now();hiddenAt=0;blurAt=0;maxVisitMs=0},
    interacted:()=>currentMs()>=minVisitMs,
    interactionMs:()=>Math.max(0,Math.floor(currentMs())),
    stop:()=>{
      finishHidden();finishBlur();
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
