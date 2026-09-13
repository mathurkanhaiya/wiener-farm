#!/usr/bin/env python3
from pathlib import Path
import os

p=Path(os.environ.get('WIENER_BACKEND_FILE','/opt/wiener-backend/server.mjs'))
if not p.exists():
    alt=Path('/opt/wiener-backend/server.js')
    if alt.exists(): p=alt
if not p.exists(): raise SystemExit('ERROR: Wiener backend server file not found')
s=p.read_text()
TAG='WIENER REFERRAL ALERTS V99'
if TAG in s:
    print('V99 referral alerts already installed')
    raise SystemExit(0)
if 'WIENER REFERRAL COUNTRY REWARDS V98' not in s:
    raise SystemExit('ERROR: V98 referral system not installed')

anchor='async function refCreditStageV98(row,stage,amount){'
if anchor not in s: raise SystemExit('ERROR: V98 credit anchor not found')

helpers=r'''// === WIENER REFERRAL ALERTS V99 ===
function refEscV99(v){return String(v??'—').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function refMoneyV99(w){return (Number(w||0)/20000).toFixed(3)}
function refFlagV99(cc){cc=String(cc||'').toUpperCase();if(!/^[A-Z]{2}$/.test(cc))return '🌍';return String.fromCodePoint(...[...cc].map(c=>127397+c.charCodeAt(0)))}
async function refTgV99(chatId,text){try{await telegramApi('sendMessage',{chat_id:String(chatId),text,parse_mode:'HTML',disable_web_page_preview:true});return true}catch(e){console.error('v99_alert_send_failed',chatId,String(e?.message||e));return false}}
async function refUserDetailV99(id){try{return (await pool.query(`select telegram_id,username,first_name,last_name,language_code,total_ads,total_tasks,balance,total_earned,created_at,referred_by,is_banned,device_blocked,referral_reward_eligible,referral_ineligible_reason from public.users where telegram_id=$1 limit 1`,[id])).rows[0]||null}catch{return await refUserV98(id)}}
async function refAdminIdsV99(){
  const out=new Set();
  for(const key of ['ADMIN_ID','ADMIN_IDS','BOT_ADMIN_ID','OWNER_ID'])for(const x of String(process.env[key]||'').split(/[,;\s]+/)){if(/^\d+$/.test(x))out.add(x)}
  try{const q=await pool.query(`select telegram_id from public.users where coalesce(is_admin,false)=true limit 30`);for(const r of q.rows)out.add(String(r.telegram_id))}catch{}
  return [...out]
}
async function refAdminJoinAlertV99(row,risk=null){
  try{
    const u=await refUserDetailV99(row.referred_user_id),inv=await refUserDetailV99(row.inviter_user_id);if(!u)return;
    const cc=String(row.country_code||risk?.country||'').toUpperCase(), flag=refFlagV99(cc), total=Number(row.total_reward_wiener||0), req=Number(row.required_ads||5);
    const name=refEscV99([u.first_name,u.last_name].filter(Boolean).join(' ')||'Unknown');
    const uname=u.username?'@'+refEscV99(u.username):'No username';
    const invName=inv?(inv.username?'@'+refEscV99(inv.username):refEscV99(inv.first_name||inv.telegram_id)):'Unknown';
    const vpn=!!(risk?.is_vpn||risk?.is_proxy||risk?.is_tor||row.vpn_blocked);
    const multi=!!u.device_blocked||String(u.referral_ineligible_reason||'').toLowerCase().match(/same.?device|multi|device/);
    const self=Number(u.referred_by)===Number(u.telegram_id);
    const clean=!vpn&&!multi&&!self&&!u.is_banned;
    const security=clean?'🟢 <b>CLEAN & ACTIVE</b>':vpn?'🟡 <b>VERIFICATION PAUSED</b>':'🔴 <b>REFERRAL REJECTED</b>';
    const text=`🟢 <b>NEW USER • WIENER FARM</b>\n\n👤 <b>USER</b>\n${name} · ${uname}\n🆔 <code>${u.telegram_id}</code>\n🌐 Language: ${refEscV99(u.language_code||'—')}\n\n🌍 <b>LOCATION</b>\n${flag} ${refEscV99(cc||'Unknown')}\nVPN / Proxy: ${vpn?'⚠️ Detected':'✅ Clear'}\n\n🤝 <b>REFERRAL</b>\nInvited by: ${invName}\nReferrer ID: <code>${row.inviter_user_id}</code>\n💰 Value: <b>${total} WIENER · $${refMoneyV99(total)}</b>\n🎁 Join credit: <b>${Number(row.join_reward_wiener||100)} WIENER</b>\n⏳ Remaining: <b>${Number(row.completion_reward_wiener||0)} WIENER</b>\n🎯 Unlock: <b>${req} valid ads</b>\n\n📊 <b>ACTIVITY</b>\nAds: <b>${Number(u.total_ads||0)} / ${req}</b>\nTasks: <b>${Number(u.total_tasks||0)}</b>\n\n🛡 <b>SECURITY</b>\nDevice: ${multi?'🚫 Duplicate / blocked':'✅ Unique'}\nMulti-account: ${multi?'🚫 Detected':'✅ Clear'}\nSelf-referral: ${self?'🚫 Detected':'✅ Clear'}\nVPN / Proxy: ${vpn?'⚠️ Detected':'✅ Clear'}\nEligible: ${clean?'✅ Yes':'❌ No / paused'}\n\n${security}`;
    for(const id of await refAdminIdsV99())await refTgV99(id,text)
  }catch(e){console.error('v99_admin_join_alert',String(e?.message||e))}
}
async function refInviterAlertV99(row,stage,amount){
  try{
    const u=await refUserDetailV99(row.referred_user_id), total=Number(row.total_reward_wiener||0), req=Number(row.required_ads||5), ads=Math.min(Number(u?.total_ads||0),req);
    const who=u?.first_name?`<b>${refEscV99(u.first_name)}</b>`:'Your friend';
    if(stage==='join'){
      const remain=Number(row.completion_reward_wiener||0);
      await refTgV99(row.inviter_user_id,`🌭 <b>NEW REFERRAL</b>\n\n${who} joined WIENER Farm through your invite.\n\n💰 <b>+${Number(amount)} WIENER</b> credited\n🎯 Progress: <b>${ads}/${req} valid ads</b>\n🔓 Complete ${req} ads to unlock <b>+${remain} WIENER</b>\n\n🏆 Total reward: <b>${total} WIENER · $${refMoneyV99(total)}</b>`)
    }else{
      await refTgV99(row.inviter_user_id,`💸 <b>REFERRAL REWARD UNLOCKED</b>\n\n${who} completed <b>${req}/${req} valid ads</b> ✅\n\n🎁 <b>+${Number(amount)} WIENER</b> credited\n🏆 Total earned from this referral: <b>${total} WIENER · $${refMoneyV99(total)}</b>\n\n✅ <b>Referral completed</b>`)
    }
  }catch(e){console.error('v99_inviter_alert',String(e?.message||e))}
}
// === END WIENER REFERRAL ALERTS V99 ===

'''
s=s.replace(anchor,helpers+anchor,1)

old="""await c.query('commit');return !!ins.rowCount"""
new="""await c.query('commit');
    if(ins.rowCount){setImmediate(()=>refInviterAlertV99(row,stage,amount).catch(e=>console.error('v99_inviter_alert_async',String(e?.message||e))))}
    return !!ins.rowCount"""
if old not in s: raise SystemExit('ERROR: V98 commit anchor not found')
s=s.replace(old,new,1)

old2="""let row=await refEnsureRowV98(u,country);if(!row)return null;"""
new2="""const existingBeforeV99=(await pool.query(`select referred_user_id from public.referral_v2 where referred_user_id=$1 limit 1`,[id])).rowCount>0;
  let row=await refEnsureRowV98(u,country);if(!row)return null;
  if(!existingBeforeV99){setImmediate(()=>refAdminJoinAlertV99(row,risk).catch(e=>console.error('v99_admin_alert_async',String(e?.message||e))))}"""
if old2 not in s: raise SystemExit('ERROR: V98 ensure-row anchor not found')
s=s.replace(old2,new2,1)

p.write_text(s)
print('V99 referral/admin alerts installed')
