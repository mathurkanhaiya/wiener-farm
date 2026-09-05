#!/usr/bin/env python3
from pathlib import Path
import os

p=Path(os.environ.get('WIENER_BACKEND_FILE','/opt/wiener-backend/server.mjs'))
if not p.exists():
    for q in [Path('/opt/wiener-backend/server.js'),Path('/opt/wiener-backend/server.mjs')]:
        if q.exists():
            p=q
            break
s=p.read_text()
TAG='// === WIENER REFERRAL FIVE AD RULE V27 ==='
if TAG in s:
    print('V27 referral rule already installed')
    raise SystemExit(0)

changes=0

old="A referral qualifies after ${n18(s.referral_active_ads_required)} verified ads."
if old in s:
    s=s.replace(old,"A referral qualifies after 5 verified ads.")
    changes+=1

old2="const qualified=refs.filter(r=>r.referral_active===true&&r.referral_reward_eligible!==false).length;return res.json({ok:true,data:{referrals:refs,qualified,leaderboard:lb}})"
new2="const normalized=refs.map(r=>({...r,referral_active:r.referral_reward_eligible!==false&&(r.referral_active===true||Number(r.total_ads||0)>=5)}));const qualified=normalized.filter(r=>r.referral_active===true).length;return res.json({ok:true,data:{referrals:normalized,qualified,leaderboard:lb}})"
if old2 in s:
    s=s.replace(old2,new2,1)
    changes+=1

marker="\napp.use((_req,res)=>\n  res.status(404).json({ok:false,error:'route_not_enabled_yet'})\n);\n"
if marker not in s:
    raise SystemExit('ERROR: final backend fallback marker not found')

code=r'''
// === WIENER REFERRAL FIVE AD RULE V27 ===
async function referralViewV27(uid){
  const [u,s]=await Promise.all([
    pool.query(`select telegram_id,referrals_count,active_referrals_count,referral_earnings from public.users where telegram_id=$1`,[uid]).then(r=>r.rows[0]),
    st18()
  ]);
  if(!u)return{text:'👥 REFERRALS\n\nOpen WIENER Farm first to create your account.',markup:kb18([[web18('🌭 OPEN WIENER FARM',app18(s))]])};
  const bot=String(s.bot_username||'WienerDogeFarmBot').replace('@',''),link=`https://t.me/${bot}?startapp=ref_${uid}`,a=app18(s);
  return{text:`👥 REFERRALS\n\nInvited: ${n18(u.referrals_count)}\nActive: ${n18(u.active_referrals_count)}\nEarned: ${fmt18(u.referral_earnings)} WIENER\nReward: +${fmt18(s.referral_active_reward)} WIENER per active referral\n\n✅ Active requirement: 5 verified ads\nThere are no extra 10/20-ad qualification levels.`,markup:kb18([[url18('📤 SHARE INVITE',`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('Join WIENER Farm and earn rewards with me!')}`)],[web18('👥 OPEN REFERRALS',`${a}?page=invite`)],[cb18('◀️ MAIN MENU','ux:home')]])};
}
async function handleReferralRuleV27(uid,text,m,q){
  if(!uid)return false;
  if(m?.chat?.type==='private'&&/^\/(referral|invite)(?:@\w+)?$/i.test(text)){
    const x=await referralViewV27(uid);await safeTg18('sendMessage',{chat_id:uid,text:x.text,reply_markup:x.markup,disable_web_page_preview:true});return true;
  }
  if(q&&['ux:refs','v7:refs'].includes(String(q.data||''))){
    const x=await referralViewV27(uid);await edit18(q,x);await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:'Referral status'}).catch(()=>null);return true;
  }
  return false;
}
// === END WIENER REFERRAL FIVE AD RULE V27 ===
'''
s=s.replace(marker,"\n"+code+marker,1)

hook="    try{if(await handleAdminParityV19(up,uid,text,m,q)) return done();}catch(e){console.error('v19_admin_parity',String(e?.message||e));}\n"
if hook in s:
    s=s.replace(hook,"    try{if(await handleReferralRuleV27(uid,text,m,q)) return done();}catch(e){console.error('v27_referral_bot',String(e?.message||e));}\n"+hook,1)
else:
    hook2="    try{if(await handleBotFullV18(up,uid,text,m,q)) return done();}catch(e){console.error('v18_bot_ops',String(e?.message||e));}\n"
    if hook2 in s:
        s=s.replace(hook2,"    try{if(await handleReferralRuleV27(uid,text,m,q)) return done();}catch(e){console.error('v27_referral_bot',String(e?.message||e));}\n"+hook2,1)
    else:
        raise SystemExit('ERROR: bot webhook hook not found for V27')



if changes<1:
    raise SystemExit('ERROR: V27 could not find referral bot/API anchors; refusing partial patch')

p.write_text(s)
print(f'Installed V27 referral five-ad rule; backend_changes={changes}')
