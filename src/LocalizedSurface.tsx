import {useEffect} from 'react';
import {useI18n} from './i18n';

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
 'WAIT':'common.wait','WATCH':'common.watch','CLAIM':'common.claim','APPLY':'common.apply','Back':'common.back','Network':'common.network','Status':'common.status',
 'Account Blocked':'system.blocked','CONTACT SUPPORT':'system.contactSupport','Account restricted':'system.restricted','Unable to open':'system.unable','Maintenance':'system.maintenance'
};
const origins=new WeakMap<Text,string>();
const skip=(el:Element|null)=>!el||!!el.closest('script,style,code,pre,[data-no-i18n],.withdraw-wallet-code,.withdraw-tx,[class*="admin-"]');

export function LocalizedSurface(){const {lang,t}=useI18n();useEffect(()=>{let stopped=false;const apply=(root:Node=document.body)=>{if(stopped)return;const nodes:Text[]=[];if(root.nodeType===Node.TEXT_NODE)nodes.push(root as Text);else{const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;while((n=w.nextNode()))nodes.push(n as Text)}for(const node of nodes){const parent=node.parentElement;if(skip(parent))continue;const current=node.nodeValue||'',trim=current.trim();if(!trim)continue;let original=origins.get(node);if(!original){original=trim;origins.set(node,original)}const key=exact[original];if(!key)continue;const translated=lang==='en'?original:t(key,original);const lead=current.match(/^\s*/)?.[0]||'',tail=current.match(/\s*$/)?.[0]||'';const next=lead+translated+tail;if(node.nodeValue!==next)node.nodeValue=next}};apply();const observer=new MutationObserver(ms=>{for(const m of ms){if(m.type==='characterData')apply(m.target);else for(const n of Array.from(m.addedNodes))apply(n)}});observer.observe(document.body,{subtree:true,childList:true,characterData:true});return()=>{stopped=true;observer.disconnect()}},[lang,t]);return null}
