import {useEffect} from 'react';
import {useI18n} from './i18n';
import {EXTRA_PACKS} from './i18n-extra';

const exact:Record<string,string>={
 'TOTAL BALANCE':'home.totalBalance','Sessions':'home.sessions','Ads':'nav.ads','Referrals':'common.referrals',
 'DAILY FARM LIMIT REACHED':'home.dailyLimit','START FARM':'home.startFarm','STARTING…':'home.starting','WIENER IS GROWING':'home.growing',
 'Tasks':'common.tasks','View all':'home.viewAll','Invite':'nav.invite','Watch Ads':'home.watchAds',
 'Daily Bonus':'daily.title','CLAIMED TODAY':'daily.claimedToday','Promo Code':'promo.title','Watch one rewarded ad to claim':'promo.subtitle',
 'SHOWING AD…':'promo.showing','CLAIM AGAIN':'promo.claimAgain','Promo Claimed':'promo.claimed','GOT IT':'promo.gotIt',
 'Complete the rewarded ad, then your promo reward will be credited.':'promo.complete',
 'Your Progress':'tasks.progress','Official':'tasks.official','Exclusive':'tasks.exclusive','Partner':'tasks.partner','DAILY':'tasks.daily','DONE':'common.done','JOIN':'common.join',
 'Invite Friends':'invite.title','INVITED':'invite.invited','QUALIFIED':'common.qualified','EARNED':'invite.earned','YOUR INVITE LINK':'invite.link','SHARE INVITE':'invite.share','Invited':'invite.invited','Qualified':'common.qualified','Per qualified':'invite.perQualified','Recent referrals':'invite.recent',
 'WIENER PROFILE':'profile.title','Balance':'common.balance','Streak':'profile.streak','Best Streak':'profile.bestStreak','Rank':'common.rank','Total Earned':'common.totalEarned','OPEN WALLET':'profile.openWallet',
 'AVAILABLE BALANCE':'wallet.available','MAX WITHDRAWABLE':'wallet.withdrawable','Select withdrawal method':'wallet.selectMethod','Choose the exact network. WIENER never changes it automatically.':'wallet.selectHint',
 'Amount':'common.amount','Fee':'common.fee','You receive':'wallet.youReceive','You Receive':'wallet.youReceive','WIENER used':'wallet.wienerUsed','ENTER WITHDRAWAL AMOUNT':'wallet.enterAmount','CONTINUE':'common.continue',
 'WALLET ADDRESS':'wallet.walletAddress','REVIEW WITHDRAWAL':'common.review','Review Withdrawal':'wallet.reviewTitle','CONFIRM WITHDRAWAL':'wallet.confirm','CREATING…':'wallet.creating',
 'Withdrawal History':'wallet.history','Tap any row for full details.':'wallet.historyHint','No withdrawals yet.':'wallet.noHistory','Withdrawal Details':'wallet.details','PENDING':'wallet.pending','PAID':'wallet.paid','REJECTED':'wallet.rejected',
 'You already have a pending withdrawal.':'wallet.pendingExisting','Insufficient WIENER balance.':'wallet.insufficient','OPEN BLOCKCHAIN EXPLORER':'wallet.openExplorer',
 'WAIT':'common.wait','WATCH':'common.watch','CLAIM':'common.claim','APPLY':'common.apply','Back':'common.back','Network':'common.network','Status':'common.status','Loading…':'common.loading',
 'Account Blocked':'system.blocked','CONTACT SUPPORT':'system.contactSupport','Account restricted':'system.restricted','Unable to open':'system.unable','Maintenance':'system.maintenance',
 'Loading your rewards':'system.loadingRewards','Secure Telegram session':'system.secure','OPEN WIENER':'system.openTelegram',
 'One Last Step':'mandatory.lastStep','Join the required communities to unlock WIENER.':'mandatory.copy','CHECKING…':'mandatory.checking','CHECK & CONTINUE':'mandatory.continue','JOINED':'mandatory.joined','Join the missing community, then return and continue.':'mandatory.hint','Community group':'mandatory.group','Official channel':'mandatory.channel','Required':'mandatory.required','Bot cannot verify this chat yet':'mandatory.verifyError',
 'OPENING CLAIM AD':'farm.openingAd','LOADING REWARD…':'farm.loadingReward','Please wait. Don’t tap claim again.':'farm.pleaseWait','PARTIAL FARM REWARD':'farm.partial','FARM REWARD UNLOCKED':'farm.unlocked','CLAIM AD':'farm.claimAd','INTERACTION':'farm.interaction','CLAIMED ✓':'farm.claimed','CLAIM NOT COMPLETED':'farm.notCompleted','TRY AGAIN':'farm.tryAgain','Cancel':'farm.cancel',
 'Temporarily unavailable':'common.unavailable','Available':'wallet.available','Minimum withdrawal':'wallet.minimum','Withdrawal fee':'common.fee','Selected network:':'wallet.selectedNetwork','Requested Amount':'wallet.requestedAmount','Amount Received':'wallet.amountReceived','Requested':'wallet.requested','Processed':'wallet.processed','TX Hash':'wallet.txHash',
 'No rankings yet.':'leaderboard.none','Your Rank':'leaderboard.yourRank','Total earned':'common.totalEarned','Daily':'tasks.daily','Loading secure payout controls…':'wallet.loadingControls'
};

type TextState={source:string;output:string};
type AttrState={source:string;output:string};
const textStates=new WeakMap<Text,TextState>();
const attrStates=new WeakMap<Element,Record<string,AttrState>>();
const skip=(el:Element|null)=>!el||!!el.closest('script,style,code,pre,[data-no-i18n],.withdraw-wallet-code,.withdraw-tx,[class*="admin-"]');
const technicalOnly=(s:string)=>/^(?:[\s+≈·,:./#()\-–—✓×]*|\d[\d\s.,:%/+\-]*|(?:WIENER|USDT|TON|Polygon|BEP20|AdsGram|Binance UID)(?:\s|$)|0x[a-fA-F0-9]{8,}|[EUUk0][Qq][A-Za-z0-9_-]{20,}|@[A-Za-z0-9_]{3,}|https?:\/\/\S+)$/i.test(s.trim());
const fill=(template:string,value:string)=>template.replaceAll('{value}',value);

function dynamicTranslate(original:string,tr:(key:string,fallback?:string)=>string){
 let m:RegExpMatchArray|null;
 if((m=original.match(/^Ready in\s+(.+)$/i)))return fill(tr('dynamic.readyIn',original),m[1]);
 if((m=original.match(/^Today's farms\s*·\s*(.+)$/i)))return fill(tr('dynamic.todayFarms',original),m[1]);
 if((m=original.match(/^Minimum is\s+(.+)\.$/i)))return fill(tr('dynamic.minimumIs',original),m[1]);
 if((m=original.match(/^Next withdrawal available in\s+(.+)$/i)))return fill(tr('dynamic.nextWithdrawal',original),m[1]);
 if((m=original.match(/^(\d+)\s+current tasks completed$/i)))return fill(tr('dynamic.tasksCompleted',original),m[1]);
 if((m=original.match(/^Streak\s*·\s*Day\s+(.+)\s+of\s+7$/i)))return fill(tr('dynamic.dayOf',original),m[1]);
 if((m=original.match(/^Best streak:\s*(\d+)\s+days\.?/i)))return fill(tr('dynamic.bestStreak',original),m[1]);
 if((m=original.match(/^(.+)\s+today$/i))&&!/withdraw|farm|claimed/i.test(original))return fill(tr('dynamic.adsToday',original),m[1]);
 if((m=original.match(/^(.+)\s+each(?:\s*·.*)?$/i)))return fill(tr('dynamic.each',original),m[1]);
 if((m=original.match(/^Ends\s+(.+)$/i)))return fill(tr('dynamic.ends',original),m[1]);
 return null;
}

export function LocalizedSurface(){
 const {lang,t}=useI18n();
 useEffect(()=>{
  let stopped=false;
  const tr=(key:string,fallback?:string)=>EXTRA_PACKS[lang]?.[key]||t(key,fallback);
  const translate=(source:string)=>{if(lang==='en'||technicalOnly(source))return source;const key=exact[source];if(key)return tr(key,source);return dynamicTranslate(source,tr)||source};
  const applyAttrs=(el:Element)=>{
   if(skip(el))return;
   const attrs=['placeholder','title','aria-label'] as const;
   let saved=attrStates.get(el);if(!saved){saved={};attrStates.set(el,saved)}
   for(const attr of attrs){
    const cur=el.getAttribute(attr);if(!cur)continue;
    let st=saved[attr];
    if(!st||cur!==st.output){st={source:cur,output:cur};saved[attr]=st}
    const output=translate(st.source);
    st.output=output;
    if(cur!==output)el.setAttribute(attr,output);
   }
  };
  const apply=(root:Node=document.body)=>{
   if(stopped)return;
   if(root.nodeType===Node.ELEMENT_NODE)applyAttrs(root as Element);
   if(root.nodeType!==Node.TEXT_NODE){const ew=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT);let e;while((e=ew.nextNode()))applyAttrs(e as Element)}
   const nodes:Text[]=[];
   if(root.nodeType===Node.TEXT_NODE)nodes.push(root as Text);else{const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;while((n=w.nextNode()))nodes.push(n as Text)}
   for(const node of nodes){
    const parent=node.parentElement;if(skip(parent))continue;
    const current=node.nodeValue||'',trim=current.trim();if(!trim)continue;
    let st=textStates.get(node);
    if(!st||trim!==st.output){st={source:trim,output:trim};textStates.set(node,st)}
    const translated=translate(st.source);
    st.output=translated;
    const lead=current.match(/^\s*/)?.[0]||'',tail=current.match(/\s*$/)?.[0]||'';
    const next=lead+translated+tail;
    if(node.nodeValue!==next)node.nodeValue=next;
   }
  };
  apply();
  const observer=new MutationObserver(ms=>{for(const m of ms){if(m.type==='characterData')apply(m.target);else if(m.type==='attributes')apply(m.target);else for(const n of Array.from(m.addedNodes))apply(n)}});
  observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder','title','aria-label']});
  return()=>{stopped=true;observer.disconnect()}
 },[lang,t]);
 return null
}
