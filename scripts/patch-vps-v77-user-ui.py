from pathlib import Path

p=Path('/opt/wiener-backend/server.mjs')
if not p.exists():
    alt=Path('/opt/wiener-backend/server.js')
    if alt.exists(): p=alt
if not p.exists(): raise SystemExit('ERROR: backend server file missing')

s=p.read_text()
TAG='WIENER USER UI V77'
if TAG in s:
    print('V77 already installed')
    raise SystemExit(0)

for need in ['WIENER VPS FULL BOT PARITY V18','async function handleBotFullV18','async function register18','async function safeTg18','async function edit18','const kb18=','const cb18=','const web18=']:
    if need not in s: raise SystemExit('ERROR: required anchor missing: '+need)

anchor='async function handleBotFullV18(up,uid,text,m,q){'
needle='  if(!uid&&!q)return false;\n'
if anchor not in s: raise SystemExit('ERROR: handler anchor missing')
if needle not in s: raise SystemExit('ERROR: uid anchor missing')

code=r'''

// === WIENER USER UI V77 ===
// User-only Telegram UI. Admin, payouts, economy, Mini App and legacy handlers untouched.
async function sendUser77(uid,screen){
  return safeTg18('sendMessage',{chat_id:uid,text:screen.text,reply_markup:screen.markup,disable_web_page_preview:true});
}
function homeMarkup77(s){const a=app18(s);return kb18([
 [web18('🌭 OPEN WIENER FARM',a)],
 [cb18('💰 WALLET','u77:wallet'),cb18('🎁 REWARDS','u77:rewards')],
 [cb18('👥 NETWORK','u77:network'),cb18('🏆 PROGRESS','u77:progress')],
 [cb18('📜 ACTIVITY','u77:activity'),cb18('🔎 STATUS','u77:status')],
 [cb18('👑 PROFILE','ux:profile'),cb18('❓ HELP','u77:help')]
])}
async function home77(uid){
 const s=await st18(),u=await usr18(uid),a=app18(s);
 if(!u)return{text:'🌭 WIENER FARM\n\nOpen Wiener Farm to create your account.',markup:kb18([[web18('🌭 OPEN WIENER FARM',a)]])};
 let today=0;try{today=n18((await pool.query(`select coalesce(sum(amount),0) v from public.transactions where telegram_id=$1 and amount>0 and created_at::date=current_date`,[uid])).rows[0]?.v)}catch{}
 return{text:`🌭 WIENER FARM\nEarn • Grow • Withdraw\n\n💰 ${fmt18(u.balance)} WIENER\n📈 +${fmt18(today)} earned today\n🔥 ${n18(u.daily_streak)} day streak\n👥 ${n18(u.active_referrals_count)} active referrals\n\nChoose an option below.`,markup:homeMarkup77(s)};
}
async function wallet77(uid){
 const s=await st18(),u=await usr18(uid),a=app18(s);if(!u)return home77(uid);
 let last=null;try{last=(await pool.query(`select status,receive_usdt,method_key,network,created_at from public.withdrawals where telegram_id=$1 order by created_at desc limit 1`,[uid])).rows[0]||null}catch{}
 const lt=last?`${String(last.status||'pending').toUpperCase()} · ${n18(last.receive_usdt).toFixed(last.method_key==='gram_ton'?6:4)} ${last.method_key==='gram_ton'?'GRAM':'USDT'}`:'No withdrawals yet';
 return{text:`💰 WALLET\n\nAvailable\n🌭 ${fmt18(u.balance)} WIENER\n\nLatest withdrawal\n${lt}`,markup:kb18([[web18('💸 OPEN WALLET',`${a}?page=wallet`)],[cb18('📜 ACTIVITY','u77:activity'),cb18('⌂ HOME','u77:home')]])};
}
async function rewards77(uid){
 const s=await st18(),a=app18(s);
 return{text:'🎁 REWARD CENTER\n\nClaim and open your earning features from one place.',markup:kb18([[web18('🎁 DAILY BONUS',`${a}?page=daily`)],[web18('🎡 SPIN & EARN',`${a}?page=ads`)],[web18('🎟 PROMO CODE',a)],[cb18('🎉 WEEKLY DRAW','ux:giveaways')],[cb18('⌂ HOME','u77:home')]])};
}
async function network77(uid){
 const s=await st18(),u=await usr18(uid),a=app18(s);if(!u)return home77(uid);
 const bot=String(s.bot_username||'WienerDogeFarmBot').replace('@',''),link=`https://t.me/${bot}?startapp=ref_${uid}`;
 const pending=Math.max(0,n18(u.referrals_count)-n18(u.active_referrals_count));
 return{text:`👥 NETWORK\n\nInvited: ${n18(u.referrals_count)}\nActive: ${n18(u.active_referrals_count)}\nPending: ${pending}\nEarned: ${fmt18(u.referral_earnings)} WIENER\n\nQualification: ${n18(s.referral_active_ads_required||5)} verified ads.`,markup:kb18([[url18('📤 INVITE FRIEND',`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('Join WIENER Farm and earn with me!')}`)],[web18('👥 MY REFERRALS',`${a}?page=invite`)],[cb18('🏆 REFERRAL RANKING','lb:inviters')],[cb18('⌂ HOME','u77:home')]])};
}
async function progress77(uid){
 const u=await usr18(uid);if(!u)return home77(uid);let tasks=0;try{tasks=(await pool.query(`select count(*)::int c from public.task_completions where telegram_id=$1`,[uid])).rows[0]?.c||0}catch{}
 return{text:`🏆 PROGRESS\n\n📈 Total earned: ${fmt18(u.total_earned)} WIENER\n📺 Ads watched: ${n18(u.total_ads)}\n✅ Tasks: ${tasks}\n🌾 Farm sessions: ${n18(u.farm_sessions)}\n👥 Active referrals: ${n18(u.active_referrals_count)}\n🔥 Best streak: ${n18(u.best_streak)} days`,markup:kb18([[cb18('👑 PROFILE','ux:profile'),cb18('🏆 LEADERBOARD','ux:leaderboard')],[cb18('⌂ HOME','u77:home')]])};
}
async function activity77(uid){
 let tx=[];try{tx=(await pool.query(`select amount,description,kind,created_at from public.transactions where telegram_id=$1 order by created_at desc limit 8`,[uid])).rows}catch{}
 const body=tx.map(x=>`${n18(x.amount)>=0?'➕':'➖'} ${fmt18(Math.abs(n18(x.amount)))} · ${String(x.description||x.kind||'Activity').slice(0,34)}`).join('\n')||'No activity yet.';
 return{text:`📜 RECENT ACTIVITY\n\n${body}`,markup:kb18([[cb18('↻ REFRESH','u77:activity')],[cb18('💰 WALLET','u77:wallet'),cb18('⌂ HOME','u77:home')]])};
}
async function status77(uid){
 const u=await usr18(uid);if(!u)return home77(uid);let pending=0;try{pending=(await pool.query(`select count(*)::int c from public.withdrawals where telegram_id=$1 and status='pending'`,[uid])).rows[0]?.c||0}catch{}
 return{text:`🔎 ACCOUNT STATUS\n\n🟢 Account active\n${pending?'🟡':'🟢'} Withdrawals: ${pending?`${pending} processing`:'Available'}\n🟢 Bot access active\n\n${pending?'Your withdrawal is being processed.':'Everything looks good.'}`,markup:kb18([[cb18('💰 WALLET','u77:wallet'),cb18('🎁 REWARDS','u77:rewards')],[cb18('⌂ HOME','u77:home')]])};
}
async function help77(uid){
 const s=await st18();return{text:'❓ WIENER HELP\n\n/start — Home\n/wallet — Wallet\n/rewards — Reward center\n/network — Referrals\n/progress — Progress\n/activity — Activity\n/status — Account status\n/profile — Profile\n/help — Help',markup:kb18([[web18('🌭 OPEN WIENER FARM',app18(s))],[url18('💬 SUPPORT',String(s.support_url||'https://t.me/WienerSupport'))],[cb18('⌂ HOME','u77:home')]])};
}
async function userBotV77(uid,text,m,q){
 const isPrivate=m?m.chat?.type==='private':q?.message?.chat?.type==='private';if(!isPrivate)return false;
 if(m&&text.startsWith('/')){
   const cmd=text.split(/\s+/)[0].replace(/^\//,'').split('@')[0].toLowerCase();
   if(cmd==='start'){await register18(m);await sendUser77(uid,await home77(uid));return true}
   const map={menu:home77,wallet:wallet77,balance:wallet77,rewards:rewards77,network:network77,referral:network77,invite:network77,progress:progress77,activity:activity77,status:status77,help:help77,support:help77};
   if(map[cmd]){await sendUser77(uid,await map[cmd](uid));return true}
 }
 if(q&&String(q.data||'').startsWith('u77:')){
   const key=String(q.data).slice(4),map={home:home77,wallet:wallet77,rewards:rewards77,network:network77,progress:progress77,activity:activity77,status:status77,help:help77};
   if(!map[key])return false;await edit18(q,await map[key](uid));await safeTg18('answerCallbackQuery',{callback_query_id:q.id});return true;
 }
 return false;
}
// === END WIENER USER UI V77 ===
'''

s=s.replace(anchor,code+'\n'+anchor,1)
s=s.replace(needle,needle+'  if(await userBotV77(uid,text,m,q))return true;\n',1)
p.write_text(s)
print('V77 applied: user UI with working inline buttons; core/admin/payout logic untouched')
