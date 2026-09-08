from pathlib import Path

p=Path('/opt/wiener-backend/server.mjs')
if not p.exists():
    alt=Path('/opt/wiener-backend/server.js')
    if alt.exists(): p=alt
if not p.exists(): raise SystemExit('ERROR: Wiener backend server file not found')
s=p.read_text()
TAG='WIENER USER BOT UI V76'
if TAG in s:
    print('V76 user bot UI already installed')
    raise SystemExit(0)
for need in ['WIENER VPS FULL BOT PARITY V18','async function handleBotFullV18','async function syncTelegramV18','async function usr18','async function st18','const kb18=','const cb18=','const web18=']:
    if need not in s: raise SystemExit('ERROR: required bot anchor missing: '+need)

anchor='async function handleBotFullV18(up,uid,text,m,q){'
if anchor not in s: raise SystemExit('ERROR: V18 handler anchor missing')
code=r'''

// === WIENER USER BOT UI V76 ===
// User-facing Telegram redesign only. Admin handlers, payout logic, economy,
// mini-app features and legacy commands remain untouched.
function home76(s){const a=app18(s);return kb18([
 [web18('🌭 OPEN WIENER FARM',a)],
 [cb18('💰 WALLET','u76:wallet'),cb18('🎁 REWARDS','u76:rewards')],
 [cb18('👥 NETWORK','u76:network'),cb18('🏆 PROGRESS','u76:progress')],
 [cb18('••• MORE','u76:more')]
])}
async function dashboard76(uid){const s=await st18(),u=await usr18(uid),a=app18(s);if(!u)return{text:'🌭 WIENER FARM\n\nOpen Wiener Farm to create your account.',markup:kb18([[web18('🌭 OPEN WIENER FARM',a)]])};const day=new Date().toISOString().slice(0,10);let today=0;try{today=n18((await pool.query(`select coalesce(sum(amount),0) v from public.transactions where telegram_id=$1 and amount>0 and created_at::date=$2::date`,[uid,day])).rows[0]?.v)}catch{}return{text:`🌭 WIENER FARM\nEarn • Grow • Withdraw\n\n🌭 ${fmt18(u.balance)} WIENER\n+${fmt18(today)} earned today\n\n🔥 ${n18(u.daily_streak)} day streak   •   👥 ${n18(u.active_referrals_count)} active\n\nYour farm is ready.`,markup:home76(s)}}
async function wallet76(uid){const s=await st18(),u=await usr18(uid),a=app18(s);if(!u)return dashboard76(uid);let w=[];try{w=(await pool.query(`select status,receive_usdt,network,method_key,created_at from public.withdrawals where telegram_id=$1 order by created_at desc limit 1`,[uid])).rows}catch{}const last=w[0],lastText=last?`${last.status==='paid'?'✓':last.status==='rejected'?'✕':'●'} ${String(last.status||'pending').toUpperCase()} · ${n18(last.receive_usdt).toFixed(last.method_key==='gram_ton'?6:4)} ${last.method_key==='gram_ton'?'GRAM':'USDT'}`:'No withdrawals yet';return{text:`💰 MY WALLET\n\n🌭 ${fmt18(u.balance)} WIENER\n\nWithdrawable\n${fmt18(u.balance)} WIENER\n\nLast withdrawal\n${lastText}`,markup:kb18([[web18('↓ WITHDRAW',`${a}?page=wallet`)],[cb18('📜 ACTIVITY','u76:activity'),cb18('⌂ HOME','u76:home')]])}}
async function rewards76(uid){const s=await st18(),u=await usr18(uid),a=app18(s);if(!u)return dashboard76(uid);const day=new Date().toISOString().slice(0,10),daily=String(u.last_daily_claim_date||'')===day;return{text:`🎁 REWARDS\n\n${daily?'✓':'●'} Daily Bonus        ${daily?'CLAIMED':'READY'}\n◎ Spin & Earn         OPEN\n🎟 Promo Code          ENTER\n🎉 Weekly Draw         VIEW\n\nKeep everything claimable in one place.`,markup:kb18([[web18(daily?'✓ DAILY CLAIMED':'🎁 CLAIM DAILY',`${a}?page=daily`)],[web18('◎ OPEN SPIN',`${a}?page=ads`),web18('🎟 PROMO',a)],[cb18('🎉 WEEKLY DRAW','ux:giveaways')],[cb18('⌂ HOME','u76:home')]])}}
async function network76(uid){const s=await st18(),u=await usr18(uid),a=app18(s);if(!u)return dashboard76(uid);const bot=String(s.bot_username||'WienerDogeFarmBot').replace('@',''),link=`https://t.me/${bot}?startapp=ref_${uid}`,pending=Math.max(0,n18(u.referrals_count)-n18(u.active_referrals_count));return{text:`👥 MY NETWORK\n\n${n18(u.referrals_count)} Invited\n${n18(u.active_referrals_count)} Active   •   ${pending} Pending\n\n🌭 ${fmt18(u.referral_earnings)}\nReferral earnings\n\nA referral becomes active after ${n18(s.referral_active_ads_required||5)} verified ads.`,markup:kb18([[url18('↗ INVITE FRIEND',`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('Join WIENER Farm and earn rewards with me!')}`)],[web18('👥 MY REFERRALS',`${a}?page=invite`),cb18('🏆 RANKING','lb:inviters')],[cb18('⌂ HOME','u76:home')]])}}
async function progress76(uid){const s=await st18(),u=await usr18(uid),a=app18(s);if(!u)return dashboard76(uid);let tasks=0;try{tasks=(await pool.query(`select count(*)::int c from public.task_completions where telegram_id=$1`,[uid])).rows[0]?.c||0}catch{}return{text:`🏆 MY PROGRESS\n\n🌭 Lifetime earned    ${fmt18(u.total_earned)}\n📺 Ads watched        ${n18(u.total_ads)}\n✅ Tasks completed    ${tasks}\n🌾 Farm sessions      ${n18(u.farm_sessions)}\n👥 Active referrals   ${n18(u.active_referrals_count)}\n🔥 Best streak        ${n18(u.best_streak)} days`,markup:kb18([[web18('👑 OPEN PROFILE',`${a}?page=profile`)],[cb18('🏆 LEADERBOARD','ux:leaderboard'),cb18('📜 ACTIVITY','u76:activity')],[cb18('⌂ HOME','u76:home')]])}}
async function activity76(uid){let tx=[];try{tx=(await pool.query(`select amount,description,kind,created_at from public.transactions where telegram_id=$1 order by created_at desc limit 10`,[uid])).rows}catch{}return{text:`📜 ACTIVITY\n\n${tx.map(x=>`${n18(x.amount)>=0?'+':'−'}${fmt18(Math.abs(n18(x.amount)))}  ${String(x.description||x.kind||'Activity').slice(0,32)}`).join('\n')||'No activity yet.'}`,markup:kb18([[cb18('↻ REFRESH','u76:activity')],[cb18('⌂ HOME','u76:home')]])}}
async function status76(uid){const s=await st18(),u=await usr18(uid);if(!u)return dashboard76(uid);let pending=0;try{pending=(await pool.query(`select count(*)::int c from public.withdrawals where telegram_id=$1 and status='pending'`,[uid])).rows[0]?.c||0}catch{}const day=new Date().toISOString().slice(0,10),daily=String(u.last_daily_claim_date||'')===day;return{text:`🔎 ACCOUNT STATUS\n\nAccount            🟢 Active\nWithdrawals        ${pending?'🟡 Processing':'🟢 Available'}\nDaily              ${daily?'✓ Claimed':'🎁 Ready'}\nFarm               ${s.maintenance_enabled?'⏸ Paused':'🟢 Available'}\nReferral           ${Math.max(0,n18(u.referrals_count)-n18(u.active_referrals_count))} pending\n\n${pending?'A withdrawal is currently processing.':'No action required.'}`,markup:kb18([[cb18('💰 WALLET','u76:wallet'),cb18('🎁 REWARDS','u76:rewards')],[cb18('⌂ HOME','u76:home')]])}}
async function more76(uid){return{text:'••• MORE\n\nQuick access to your account tools.',markup:kb18([[cb18('📜 ACTIVITY','u76:activity'),cb18('🔎 STATUS','u76:status')],[cb18('👑 PROFILE','ux:profile'),cb18('❓ HELP','u76:help')],[cb18('⌂ HOME','u76:home')]])}}
async function help76(uid){const s=await st18();return{text:`❓ WIENER HELP\n\n/start — Home\n/wallet — Wallet\n/rewards — Rewards\n/network — Referrals\n/progress — Progress\n/activity — Recent activity\n/status — Account status\n/profile — Profile card\n/help — Help\n\nMost earning actions open directly inside Wiener Farm.`,markup:kb18([[web18('🌭 OPEN WIENER FARM',app18(s))],[url18('💬 SUPPORT',String(s.support_url||'https://t.me/WienerSupport'))],[cb18('⌂ HOME','u76:home')]])}}
async function userBotV76(uid,text,m,q){
 const isPrivate=!!m?m.chat?.type==='private':q?.message?.chat?.type==='private';if(!isPrivate)return false;
 if(m&&text.startsWith('/')){const cmd=text.split(/\s+/)[0].replace(/^\//,'').split('@')[0].toLowerCase();
   if(cmd==='start'){await register18(m);await safeTg18('sendMessage',{chat_id:uid,...await dashboard76(uid),disable_web_page_preview:true});return true}
   const map={menu:'home',wallet:'wallet',balance:'wallet',rewards:'rewards',network:'network',referral:'network',invite:'network',progress:'progress',activity:'activity',status:'status',help:'help',support:'help'};if(map[cmd]){const fn={home:dashboard76,wallet:wallet76,rewards:rewards76,network:network76,progress:progress76,activity:activity76,status:status76,help:help76}[map[cmd]];await safeTg18('sendMessage',{chat_id:uid,...await fn(uid),disable_web_page_preview:true});return true}
 }
 if(q&&String(q.data||'').startsWith('u76:')){const key=String(q.data).slice(4),fn={home:dashboard76,wallet:wallet76,rewards:rewards76,network:network76,progress:progress76,activity:activity76,status:status76,more:more76,help:help76}[key];if(!fn)return false;await edit18(q,await fn(uid));await safeTg18('answerCallbackQuery',{callback_query_id:q.id});return true}
 return false
}
// === END WIENER USER BOT UI V76 ===
'''
s=s.replace(anchor,code+'\n'+anchor,1)

needle="  if(!uid&&!q)return false;\n"
if needle not in s: raise SystemExit('ERROR: V18 uid anchor missing')
s=s.replace(needle,needle+"  if(await userBotV76(uid,text,m,q))return true;\n",1)

old="{command:'start',description:'Open WIENER dashboard'},{command:'menu',description:'Main menu'},{command:'balance',description:'Check WIENER balance'},{command:'farm',description:'Farm status'},{command:'ads',description:'Ads status'},{command:'tasks',description:'Available tasks'},{command:'referral',description:'Referral stats'},{command:'withdraw',description:'Open wallet'},{command:'profile',description:'Account profile'},{command:'leaderboard',description:'WIENER rankings'},{command:'promo',description:'Active promos'},{command:'giveaway',description:'Active giveaway'},{command:'addtask',description:'Create sponsored task'},{command:'support',description:'Support'},{command:'help',description:'Help and commands'}"
new="{command:'start',description:'Open WIENER home'},{command:'wallet',description:'Wallet & withdrawals'},{command:'rewards',description:'Reward center'},{command:'network',description:'Referral network'},{command:'progress',description:'Your progress'},{command:'activity',description:'Recent activity'},{command:'status',description:'Account status'},{command:'profile',description:'VIP profile card'},{command:'help',description:'Help & support'}"
if old not in s: raise SystemExit('ERROR: Telegram user command list anchor missing')
s=s.replace(old,new,1)

p.write_text(s)
print('V76 applied: clean user-only Telegram bot UI; admin and legacy handlers unchanged')