import {useEffect} from 'react';
import {useI18n} from './i18n';
import {EXTRA_PACKS} from './i18n-extra';
import {POPUP_PACKS} from './i18n-popups';
import {FULL_UI_PACKS} from './FullUiTranslator';
import {V75_PACKS} from './i18n-v75';

const exact:Record<string,string>={
 'TOTAL BALANCE':'home.totalBalance','Total Balance':'home.totalBalance','Total balance':'home.totalBalance',
 'Sessions':'home.sessions','SESSIONS':'home.sessions',
 'Ads':'nav.ads','ADS':'nav.ads',
 'Referrals':'common.referrals','REFERRALS':'common.referrals',
 'Today’s farms':'home.todayFarms','TODAY’S FARMS':'home.todayFarms',"Today's farms":'home.todayFarms',
 'DAILY FARM LIMIT REACHED':'home.dailyLimit','Daily farm limit reached':'home.dailyLimit',
 'START FARM':'home.startFarm','Start Farm':'home.startFarm',
 'STARTING…':'home.starting','Starting…':'home.starting',
 'WIENER IS GROWING':'home.growing','WIENER is growing':'home.growing',
 'Tasks':'common.tasks','TASKS':'common.tasks',
 'View all':'home.viewAll','VIEW ALL':'home.viewAll',
 'Invite':'nav.invite','INVITE':'nav.invite',
 'Watch Ads':'home.watchAds','WATCH ADS':'home.watchAds','Watch ads':'home.watchAds',
 'Daily Bonus':'daily.title','DAILY BONUS':'daily.title',
 'Streak':'profile.streak','STREAK':'profile.streak',
 'Best streak':'daily.bestStreak','Best Streak':'daily.bestStreak','BEST STREAK':'daily.bestStreak',
 'CLAIMED TODAY':'daily.claimedToday','Claimed today':'daily.claimedToday',
 'Promo Code':'promo.title','PROMO CODE':'promo.title',
 'ENTER CODE':'promo.enter','Enter code':'promo.enter',
 'Watch one rewarded ad to claim':'promo.subtitle',
 'SHOWING AD…':'promo.showing','Showing ad…':'promo.showing',
 'CLAIM AGAIN':'promo.claimAgain','Claim again':'promo.claimAgain',
 'Promo Claimed':'promo.claimed','PROMO CLAIMED':'promo.claimed',
 'GOT IT':'promo.gotIt','Got it':'promo.gotIt',
 'Complete the rewarded ad, then your promo reward will be credited.':'promo.complete',
 'Your Progress':'tasks.progress','YOUR PROGRESS':'tasks.progress','Your progress':'tasks.progress',
 'current tasks completed':'tasks.completed',
 'Official':'tasks.official','OFFICIAL':'tasks.official',
 'Exclusive':'tasks.exclusive','EXCLUSIVE':'tasks.exclusive',
 'Partner':'tasks.partner','PARTNER':'tasks.partner',
 'DAILY':'tasks.daily','Daily':'tasks.daily',
 'DONE':'common.done','Done':'common.done',
 'JOIN':'common.join','Join':'common.join',
 'WAIT':'common.wait','Wait':'common.wait',
 'WATCH':'common.watch','Watch':'common.watch',
 'CLAIM':'common.claim','Claim':'common.claim',
 'APPLY':'common.apply','Apply':'common.apply',
 'Back':'common.back','BACK':'common.back',
 'Continue':'common.continue','CONTINUE':'common.continue',
 'Review':'common.review','REVIEW':'common.review',
 'Balance':'common.balance','BALANCE':'common.balance',
 'Status':'common.status','STATUS':'common.status',
 'Network':'common.network','NETWORK':'common.network',
 'Fee':'common.fee','FEE':'common.fee',
 'Amount':'common.amount','AMOUNT':'common.amount',
 'Rank':'common.rank','RANK':'common.rank',
 'Total Earned':'common.totalEarned','TOTAL EARNED':'common.totalEarned','Total earned':'common.totalEarned',
 'Qualified':'common.qualified','QUALIFIED':'common.qualified',
 'Special Missions':'special.title','SPECIAL MISSIONS':'special.title',
 'Extra ways to earn':'special.subtitle','EXTRA WAYS TO EARN':'special.subtitle',
 'Earn · Grow · Withdraw':'brand.tagline','EARN · GROW · WITHDRAW':'brand.tagline',
 'Home':'nav.home','HOME':'nav.home',
 'Wallet':'nav.wallet','WALLET':'nav.wallet',
 'Play':'nav.play','PLAY':'nav.play',
 'Invite Friends':'invite.title','INVITE FRIENDS':'invite.title','Invite friends':'invite.title',
 'INVITED':'invite.invited','Invited':'invite.invited',
 'EARNED':'invite.earned','Earned':'invite.earned',
 'YOUR INVITE LINK':'invite.link','Your Invite Link':'invite.link',
 'SHARE INVITE':'invite.share','Share Invite':'invite.share',
 'Per qualified':'invite.perQualified','PER QUALIFIED':'invite.perQualified',
 'Recent referrals':'invite.recent','RECENT REFERRALS':'invite.recent',
 'WIENER PROFILE':'profile.title','Profile':'profile.title',
 'OPEN WALLET':'profile.openWallet','Open Wallet':'profile.openWallet',
 'AVAILABLE BALANCE':'wallet.available','Available Balance':'wallet.available','Available balance':'wallet.available',
 'MAX WITHDRAWABLE':'wallet.withdrawable','Max withdrawable':'wallet.withdrawable',
 'Select withdrawal method':'wallet.selectMethod','SELECT WITHDRAWAL METHOD':'wallet.selectMethod',
 'Choose the exact network. WIENER never changes it automatically.':'wallet.selectHint',
 'You receive':'wallet.youReceive','You Receive':'wallet.youReceive','YOU RECEIVE':'wallet.youReceive',
 'WIENER used':'wallet.wienerUsed','WIENER USED':'wallet.wienerUsed',
 'ENTER WITHDRAWAL AMOUNT':'wallet.enterAmount','Enter withdrawal amount':'wallet.enterAmount',
 'WALLET ADDRESS':'wallet.walletAddress','Wallet address':'wallet.walletAddress',
 'REVIEW WITHDRAWAL':'common.review','Review Withdrawal':'wallet.reviewTitle',
 'CONFIRM WITHDRAWAL':'wallet.confirm','Confirm Withdrawal':'wallet.confirm',
 'CREATING…':'wallet.creating','Creating…':'wallet.creating',
 'Withdrawal History':'wallet.history','WITHDRAWAL HISTORY':'wallet.history',
 'Tap any row for full details.':'wallet.historyHint',
 'No withdrawals yet.':'wallet.noHistory',
 'Withdrawal Details':'wallet.details',
 'PENDING':'wallet.pending','Pending':'wallet.pending',
 'PAID':'wallet.paid','Paid':'wallet.paid',
 'REJECTED':'wallet.rejected','Rejected':'wallet.rejected',
 'You already have a pending withdrawal.':'wallet.pendingExisting','Insufficient WIENER balance.':'wallet.insufficient','OPEN BLOCKCHAIN EXPLORER':'wallet.openExplorer',
 'Account Blocked':'system.blocked','CONTACT SUPPORT':'system.contactSupport','Account restricted':'system.restricted','Unable to open':'system.unable','Maintenance':'system.maintenance',
 'Loading your rewards':'system.loadingRewards','Secure Telegram session':'system.secure','OPEN WIENER':'system.openTelegram',
 'One Last Step':'mandatory.lastStep','Join the required communities to unlock WIENER.':'mandatory.copy','CHECKING…':'mandatory.checking','CHECK & CONTINUE':'mandatory.continue','JOINED':'mandatory.joined','Join the missing community, then return and continue.':'mandatory.hint','Community group':'mandatory.group','Official channel':'mandatory.channel','Required':'mandatory.required','Bot cannot verify this chat yet':'mandatory.verifyError',
 'OPENING CLAIM AD':'farm.openingAd','LOADING REWARD…':'farm.loadingReward','Please wait. Don’t tap claim again.':'farm.pleaseWait','PARTIAL FARM REWARD':'farm.partial','FARM REWARD UNLOCKED':'farm.unlocked','CLAIM AD':'farm.claimAd','INTERACTION':'farm.interaction','CLAIMED ✓':'farm.claimed','CLAIM NOT COMPLETED':'farm.notCompleted','TRY AGAIN':'farm.tryAgain','Cancel':'farm.cancel',
 'Temporarily unavailable':'common.unavailable','Available':'wallet.available','Minimum withdrawal':'wallet.minimum','Withdrawal fee':'common.fee','Selected network:':'wallet.selectedNetwork','Requested Amount':'wallet.requestedAmount','Amount Received':'wallet.amountReceived','Requested':'wallet.requested','Processed':'wallet.processed','TX Hash':'wallet.txHash',
 'No rankings yet.':'leaderboard.none','Your Rank':'leaderboard.yourRank','Daily':'tasks.daily','Loading secure payout controls…':'wallet.loadingControls',
 'FULL REWARD UNLOCKED':'ad.full','PARTIAL REWARD':'ad.partial','Nice! You visited the advertiser and earned the full reward.':'ad.fullText','Keep doing this to earn more every ad.':'ad.tipFull','Visit the advertiser during the ad to unlock the full reward next time.':'ad.tipPartial','AD SHOWN':'ad.shown',
 '💡 TIP':'promo.tip','more WIENER from ads':'promo.moreAds','Visit / Play / Open':'promo.tapVisit',
 'Unable to load ad progress':'error.loadAds','Daily ad limit reached':'error.dailyAdLimit','Ad was not completed':'error.adNotCompleted','Reward could not be credited':'error.rewardFailed',
 'Promo already claimed':'promo.already','Invalid promo code':'promo.invalid','Complete the rewarded ad to claim this promo.':'promo.completeToClaim','Promo reward confirmation failed':'promo.rewardFailed',
 'Nice! You unlocked the full farm reward. Start the next farm manually whenever you’re ready.':'farm.fullText','Tip: Visit the advertiser during the claim ad to unlock the full reward next time.':'farm.tipPartial','Complete the ad and try again.':'farm.tryComplete',
 'No tasks right now.':'tasks.none','No partner tasks right now.':'tasks.none'
};

type NodeState={source:string;lastOutput:string};
type AttrState={source:string;lastOutput:string};
const textStates=new WeakMap<Text,NodeState>();
const attrStates=new WeakMap<Element,Record<string,AttrState>>();
const skip=(el:Element|null)=>!el||!!el.closest('script,style,code,pre,[data-no-i18n],.withdraw-wallet-code,.withdraw-tx,[class*="admin-"]');
const technicalOnly=(s:string)=>/^(?:[\s+≈·,:./#()\-–—✓×!*]*|\d[\d\s.,:%/+\-]*|(?:WIENER|W|USDT|TON|Polygon|BEP20|AdsGram|Binance UID)(?:\s|$)|0x[a-fA-F0-9]{8,}|[EUUk0][Qq][A-Za-z0-9_-]{20,}|@[A-Za-z0-9_]{3,}|https?:\/\/\S+)$/i.test(s.trim());
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
 if((m=original.match(/^Next ad in\s+(.+)$/i)))return fill(tr('dynamic.nextAd','Next ad in {value}'),m[1]);
 if((m=original.match(/^You could[’']ve earned\s+(.+?)\s+more WIENER\s+by visiting the advertiser\.?$/i)))return fill(tr('dynamic.couldEarn','You could have earned {value} more WIENER by visiting the advertiser.'),m[1]);
 if((m=original.match(/^CLAIM DAY 7 \+ ⭐ · ([\d.,]+) WIENER$/i)))return `${tr('common.claim','Claim')} ${m[1]} WIENER · ⭐`;
 if((m=original.match(/^CLAIM ([\d.,]+) WIENER$/i)))return `${tr('common.claim','Claim')} ${m[1]} WIENER`;
 if((m=original.match(/^Week (\d+) · Day (\d+) claimed$/i)))return `#${m[1]} · ${fill(tr('dynamic.dayOf','Day {value} of 7'),m[2])} · ${tr('daily.claimedToday','Claimed')}`;
 if((m=original.match(/^Week (\d+) · Day (\d+) of 7$/i)))return `#${m[1]} · ${fill(tr('dynamic.dayOf','Day {value} of 7'),m[2])}`;
 if((m=original.match(/^Minimum withdrawal is ([\d.]+) TON$/i)))return `${tr('wallet.minimum','Minimum')} ${m[1]} TON`;
 if((m=original.match(/^WATCH AD · (\d+\/\d+)$/i)))return `${tr('common.watch','Watch')} · ${m[1]}`;
 if((m=original.match(/^AdsGram — (\d+) ads$/i)))return `AdsGram — ${m[1]} ${tr('nav.ads','Ads')}`;
 if((m=original.match(/^Bonus Ads — (\d+) ads$/i)))return `${tr('nav.ads','Ads')} — ${m[1]}`;
 if((m=original.match(/^(.+ WIENER · \d+\/\d+) today$/i)))return fill(tr('dynamic.adsToday','{value} today'),m[1]);
 if((m=original.match(/^WATCH AD → \+1 SPIN \((\d+) left\)$/i)))return `${tr('common.watch','Watch')} → +1 SPIN (${m[1]})`;
 return null;
}

export function LocalizedSurface(){
 const {lang,t}=useI18n();
 useEffect(()=>{
  let stopped=false;
  const tr=(key:string,fallback?:string)=>POPUP_PACKS[lang]?.[key]||EXTRA_PACKS[lang]?.[key]||t(key,fallback);
  const translate=(source:string)=>{if(lang==='en'||technicalOnly(source))return source;const clean=source.replace(/^[^\p{L}\p{N}@]+/u,'').replace(/[→✓×]+$/u,'').trim();const vpack=V75_PACKS[lang] as any,fpack=FULL_UI_PACKS[lang] as any;const ci=(obj:any)=>Object.entries(obj||{}).find(([k])=>k.toLocaleLowerCase()===clean.toLocaleLowerCase())?.[1] as string|undefined;const newest=vpack?.[source]||vpack?.[clean]||ci(vpack);if(newest)return newest;const direct=fpack?.[source]||fpack?.[clean]||ci(fpack);if(direct)return direct;const key=exact[source]||exact[clean]||Object.entries(exact).find(([k])=>k.toLocaleLowerCase()===clean.toLocaleLowerCase())?.[1];if(key)return tr(key,source);const dyn=dynamicTranslate(source,tr)||dynamicTranslate(clean,tr);if(dyn)return dyn;if(/(?:verification failed|request failed|could not load|something went wrong|SDK unavailable|Block ID is not configured|temporarily unavailable)/i.test(source))return tr('common.unavailable','Temporarily unavailable');if(/invite link copied/i.test(source))return tr('invite.copied','Invite link copied');if(/no (?:partner |sponsored )?tasks? (?:right now|here)/i.test(source))return tr('tasks.none','No tasks right now.');if(/account restricted/i.test(source))return tr('system.restricted','Account restricted');return source};
  const applyAttrs=(el:Element)=>{
   if(skip(el))return;
   const attrs=['placeholder','title','aria-label'] as const;
   let saved=attrStates.get(el);if(!saved){saved={};attrStates.set(el,saved)}
   for(const attr of attrs){
    const cur=el.getAttribute(attr);if(!cur)continue;
    let st=saved[attr];
    if(!st){st={source:cur,lastOutput:cur};saved[attr]=st}
    else if(cur!==st.lastOutput){st.source=cur;st.lastOutput=cur}
    const output=translate(st.source);
    st.lastOutput=output;
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
    if(!st){st={source:trim,lastOutput:trim};textStates.set(node,st)}
    else if(trim!==st.lastOutput){st.source=trim;st.lastOutput=trim}
    const translated=translate(st.source);
    st.lastOutput=translated;
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
