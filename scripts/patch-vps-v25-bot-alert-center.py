#!/usr/bin/env python3
from pathlib import Path
import os, re, sys

p=Path(os.environ.get('WIENER_BACKEND_FILE','/opt/wiener-backend/server.js'))
if not p.exists():
    alt=Path('/opt/wiener-backend/server.mjs')
    if alt.exists(): p=alt
s=p.read_text()
TAG='// === WIENER BOT ALERT CENTER V25 ==='
if TAG in s:
    print('V25 bot alert center already installed')
    raise SystemExit(0)

if 'handleAdminParityV19' not in s or 'notification_log' not in s:
    raise SystemExit('ERROR: V19 bot/admin parity + notification log required')

marker="\napp.use((_req,res)=>\n  res.status(404).json({ok:false,error:'route_not_enabled_yet'})\n);\n"
if marker not in s:
    raise SystemExit('ERROR: final backend fallback marker not found')

code=r'''
// === WIENER BOT ALERT CENTER V25 ===
let alertRunBusyV25=false;
const appUrlV25=async()=>String((await st18()).app_url||'https://wiener-farm.vercel.app').replace(/\/$/,'');
const fmtV25=(v,d=6)=>{const n=Number(v||0);if(!Number.isFinite(n))return '0';return n.toLocaleString(undefined,{maximumFractionDigits:d,minimumFractionDigits:0})};
const shortV25=(v)=>{const s=String(v||'');return s.length>20?s.slice(0,8)+'…'+s.slice(-6):s};
async function tableV25(name){return !!(await pool.query(`select to_regclass($1) v`,['public.'+name])).rows[0]?.v}
async function columnV25(table,col){return !!(await pool.query(`select 1 from information_schema.columns where table_schema='public' and table_name=$1 and column_name=$2 limit 1`,[table,col])).rows.length}
async function prefV25(uid){
  let r=(await pool.query(`select * from public.wiener_alert_preferences where telegram_id=$1`,[uid])).rows[0];
  if(!r)r=(await pool.query(`insert into public.wiener_alert_preferences(telegram_id) values($1) on conflict(telegram_id) do update set telegram_id=excluded.telegram_id returning *`,[uid])).rows[0];
  return r||{};
}
function prefKeyV25(type){
  if(type==='wiener_ready'||type==='farm_ready')return'user_farm_ready';
  if(type==='streak_warning'||type==='daily_reminder')return'user_daily_reminder';
  if(type==='referral_qualified'||type==='referral_reward')return'user_referral_rewards';
  if(type==='new_tasks')return'user_new_tasks';
  if(type==='promotion'||type==='promo'||type==='giveaway')return'user_promotions';
  if(type==='admin_withdrawal'||type==='admin_payout_queue'||type==='admin_payout_failed')return'admin_withdrawals';
  if(type==='admin_fraud'||type==='admin_security')return'admin_fraud';
  if(type==='admin_treasury'||type==='admin_ton_scanner')return'admin_treasury';
  if(type==='admin_ads')return'admin_ads';
  if(type==='admin_tasks')return'admin_tasks';
  if(type==='admin_ambassador')return'admin_ambassador';
  if(type==='admin_system')return'admin_system';
  return null;
}
async function alertAllowedV25(uid,type,isAdmin=false,severity='info'){
  if(['withdrawal_submitted','withdrawal_paid','withdrawal_rejected','security','account_restored'].includes(type))return true;
  if(isAdmin&&severity==='critical')return true;
  const k=prefKeyV25(type);if(!k)return true;
  const p=await prefV25(uid);return p[k]!==false;
}
async function stateGetV25(key,def=''){const r=(await pool.query(`select state_value from public.wiener_alert_state where state_key=$1`,[key])).rows[0];return r?.state_value??def}
async function stateSetV25(key,val){await pool.query(`insert into public.wiener_alert_state(state_key,state_value,updated_at) values($1,$2,now()) on conflict(state_key) do update set state_value=excluded.state_value,updated_at=now()`,[key,String(val)])}
async function sendAlertV25(o){
  const uid=Number(o.uid||0),type=String(o.type||'alert'),key=String(o.key||'').slice(0,240),severity=String(o.severity||'info');
  if(!uid||!key)return false;
  if(!await alertAllowedV25(uid,type,!!o.admin,severity))return false;
  const prior=(await pool.query(`select id,status,created_at from public.notification_log where telegram_id=$1 and event_key=$2 order by created_at desc limit 1`,[uid,key])).rows[0]||null;
  if(prior?.status==='sent')return false;
  if(prior?.status==='pending'&&new Date(prior.created_at).getTime()>Date.now()-300000)return false;
  if(o.cooldownHours){const q=await pool.query(`select 1 from public.notification_log where telegram_id=$1 and event_type=$2 and status='sent' and created_at>=now()-($3::text||' hours')::interval limit 1`,[uid,type,String(o.cooldownHours)]);if(q.rows.length)return false}
  let log=null;
  try{
    if(prior?.id){await pool.query(`update public.notification_log set status='pending',error=null,metadata=$2::jsonb where id=$1`,[prior.id,JSON.stringify({severity,...(o.meta||{})})]);log={id:prior.id}}
    else log=(await pool.query(`insert into public.notification_log(telegram_id,event_type,event_key,status,metadata) values($1,$2,$3,'pending',$4::jsonb) returning id`,[uid,type,key,JSON.stringify({severity,...(o.meta||{})})])).rows[0]
  }catch{return false}
  try{
    const api=typeof safeTg18==='function'?safeTg18:tgV10;
    const m=await api('sendMessage',{chat_id:uid,text:String(o.text||''),disable_web_page_preview:true,reply_markup:o.markup||undefined});
    if(!m?.message_id)throw new Error('telegram_send_failed');
    await pool.query(`update public.notification_log set status='sent',telegram_message_id=$2,sent_at=now(),error=null where id=$1`,[log.id,m.message_id]);
    return true;
  }catch(e){
    const msg=String(e?.message||e);
    await pool.query(`update public.notification_log set status='failed',error=$2 where id=$1`,[log.id,msg]).catch(()=>null);
    if(/blocked by the user|chat not found|user is deactivated|can't initiate conversation/i.test(msg))await pool.query(`update public.users set notification_unreachable_at=now() where telegram_id=$1`,[uid]).catch(()=>null);
    return false;
  }
}
async function adminsV25(category='system'){
  const rows=(await pool.query(`select telegram_id,role,permissions from public.admins where enabled=true`)).rows;
  return rows.filter(a=>a.role==='owner'||a.role==='admin'||a.permissions?.[category]===true);
}
async function sendAdminsV25(category,o){
  const rows=await adminsV25(category),out=[];
  for(const a of rows)out.push(await sendAlertV25({...o,uid:Number(a.telegram_id),admin:true,key:`${o.key}:admin:${a.telegram_id}`}));
  return out.filter(Boolean).length;
}
function userAlertCardV25(p,isAdmin=false){
  const b=(label,key,on)=>({text:`${on?'✅':'⚪'} ${label}`,callback_data:`al25:ut:${key}`});
  const rows=[
    [b('Farm Ready','user_farm_ready',p.user_farm_ready!==false),b('Daily Reminder','user_daily_reminder',p.user_daily_reminder!==false)],
    [b('Referral Rewards','user_referral_rewards',p.user_referral_rewards!==false),b('New Tasks','user_new_tasks',p.user_new_tasks!==false)],
    [b('Promotions','user_promotions',p.user_promotions===true)]
  ];
  if(isAdmin)rows.push([{text:'🛡 ADMIN ALERTS',callback_data:'al25:admin'}]);
  rows.push([{text:'◀️ MAIN MENU',callback_data:'ux:home'}]);
  return{text:'🔔 NOTIFICATIONS\n\nChoose the optional reminders you want.\n\nWithdrawal, payout and account-security messages always stay enabled.',markup:{inline_keyboard:rows}};
}
function adminAlertCardV25(p){
  const b=(label,key,on)=>({text:`${on?'✅':'⚪'} ${label}`,callback_data:`al25:at:${key}`});
  return{text:'🔔 ADMIN ALERTS\n\nOperational alerts are routed through your current admin permissions. Critical payout/security alerts cannot be muted.\n\nChoose normal/warning alert categories:',markup:{inline_keyboard:[
    [b('Withdrawals','admin_withdrawals',p.admin_withdrawals!==false),b('Fraud','admin_fraud',p.admin_fraud!==false)],
    [b('Treasury','admin_treasury',p.admin_treasury!==false),b('Ads','admin_ads',p.admin_ads!==false)],
    [b('Tasks','admin_tasks',p.admin_tasks!==false),b('Ambassador','admin_ambassador',p.admin_ambassador!==false)],
    [b('System','admin_system',p.admin_system!==false)],
    [{text:'↩️ USER ALERTS',callback_data:'al25:user'},{text:'◀️ ADMIN HOME',callback_data:'adm:home'}]
  ]}};
}
async function handleAlertsV25(up,uid,text,m,q){
  if(!uid)return false;
  if(m?.chat?.type==='private'&&/^\/alerts(?:@\w+)?$/i.test(text)){
    let a=null;try{a=await adm18(uid)}catch{}
    const x=userAlertCardV25(await prefV25(uid),!!a);await safeTg18('sendMessage',{chat_id:uid,text:x.text,reply_markup:x.markup});return true;
  }
  if(!q||!String(q.data||'').startsWith('al25:'))return false;
  const data=String(q.data),parts=data.split(':'),act=parts[1];
  if(act==='user'){let a=null;try{a=await adm18(uid)}catch{}await edit18(q,userAlertCardV25(await prefV25(uid),!!a));await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:'Notifications'});return true}
  if(act==='ut'){
    const key=parts[2],allowed=['user_farm_ready','user_daily_reminder','user_referral_rewards','user_new_tasks','user_promotions'];if(!allowed.includes(key))return true;
    const p=await prefV25(uid),next=!(p[key]!==false);await pool.query(`update public.wiener_alert_preferences set "${key}"=$2,updated_at=now() where telegram_id=$1`,[uid,next]);
    let a=null;try{a=await adm18(uid)}catch{}await edit18(q,userAlertCardV25(await prefV25(uid),!!a));await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:next?'Enabled':'Muted'});return true;
  }
  if(act==='admin'||act==='at'){
    let a=null;try{a=await adm18(uid)}catch{}if(!a){await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:'Admin permission required',show_alert:true});return true}
    if(act==='at'){const key=parts[2],allowed=['admin_withdrawals','admin_fraud','admin_treasury','admin_ads','admin_tasks','admin_ambassador','admin_system'];if(allowed.includes(key)){const p=await prefV25(uid),next=!(p[key]!==false);await pool.query(`update public.wiener_alert_preferences set "${key}"=$2,updated_at=now() where telegram_id=$1`,[uid,next]);await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:next?'Enabled':'Muted'})}}
    await edit18(q,adminAlertCardV25(await prefV25(uid)));if(act==='admin')await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:'Admin alerts'});return true;
  }
  return false;
}
async function runAlertsV25(){
  if(alertRunBusyV25)return{busy:true};alertRunBusyV25=true;
  const out={withdrawals:0,risk:0,payout_failed:0,tasks:0,ambassador:0,system:0,ads:0,treasury:0};
  try{
    const installed=await stateGetV25('installed_at',new Date().toISOString()),lastPoll=await stateGetV25('last_poll_at',installed),pollNow=new Date().toISOString(),lastMs=Date.parse(lastPoll),scanSince=Number.isFinite(lastMs)?new Date(Math.max(Date.parse(installed)||0,lastMs-30*60*1000)).toISOString():installed,app=await appUrlV25();
    const fresh=(await pool.query(`select w.*,u.first_name,u.is_banned,u.device_blocked,coalesce(r.risk_score,0) risk_score,coalesce(r.enforcement_state,'normal') enforcement_state from public.withdrawals w left join public.users u on u.telegram_id=w.telegram_id left join public.user_risk_profiles r on r.telegram_id=w.telegram_id where w.created_at>=$1 order by w.created_at asc limit 500`,[scanSince])).rows;
    for(const w of fresh){
      const ton=w.method_key==='gram_ton'||String(w.network).toUpperCase()==='TON',asset=ton?'GRAM':'USDT',gross=fmtV25(w.gross_usdt,ton?6:4),recv=fmtV25(w.receive_usdt,ton?6:4),uname=w.username?'@'+w.username:(w.first_name||'User'),wallet=`${app}?page=wallet`;
      await sendAlertV25({uid:w.telegram_id,type:'withdrawal_submitted',key:`withdraw_submitted:${w.id}`,severity:'critical',text:`💸 WITHDRAWAL SUBMITTED\n\nAmount: ${gross} ${asset}\nEstimated receive: ${recv} ${asset}\nNetwork: ${w.network||''}\nStatus: ${String(w.status||'pending').toUpperCase()}\n\nWe'll notify you when it is processed.`,markup:{inline_keyboard:[[{text:'💸 VIEW WITHDRAWAL',web_app:{url:wallet}}]]},meta:{withdrawal_id:w.id}});
      let gate='—';if(await tableV25('withdraw_ad_sessions'))gate=String((await pool.query(`select count(*)::int c from public.withdraw_ad_sessions where telegram_id=$1 and day=(now() at time zone 'utc')::date and counted=true`,[w.telegram_id])).rows[0]?.c||0)+'/5';
      const review={inline_keyboard:[[{text:'💸 REVIEW PAYOUT',callback_data:'wpay:home'}],[{text:'👤 VIEW USER',web_app:{url:`${app}?page=admin&user=${w.telegram_id}`}}]]};
      out.withdrawals+=await sendAdminsV25('withdrawals',{type:'admin_withdrawal',key:`admin_withdrawal:${w.id}`,severity:'info',text:`💸 NEW WITHDRAWAL\n\n👤 ${uname}\n🆔 ${w.telegram_id}\n\n💵 ${gross} ${asset}\n💰 Pay: ${recv} ${asset}\n🌐 ${w.network||''}\n🔓 Withdraw ads: ${gate}\n🛡 Risk: ${Number(w.risk_score||0)}/100 · ${w.enforcement_state||'normal'}\n\nStatus: ${String(w.status||'pending').toUpperCase()}`,markup:review,meta:{withdrawal_id:w.id}});
      const risky=Number(w.risk_score||0)>=40||w.is_banned||w.device_blocked||!['normal','watch'].includes(String(w.enforcement_state||'normal'));
      if(risky)out.risk+=await sendAdminsV25('withdrawals',{type:'admin_fraud',key:`risky_withdrawal:${w.id}`,severity:Number(w.risk_score||0)>=60||w.is_banned||w.device_blocked?'critical':'warning',text:`🟠 WITHDRAWAL REVIEW REQUIRED\n\n👤 ${uname} · ${w.telegram_id}\nAmount: ${recv} ${asset}\n\nRisk: ${Number(w.risk_score||0)}/100 · ${w.enforcement_state||'normal'}\nApp ban: ${w.is_banned?'YES':'NO'}\nDevice blocked: ${w.device_blocked?'YES':'NO'}\nWithdraw ads: ${gate}\n\nReview the user before payout.`,markup:review,meta:{withdrawal_id:w.id,risk:Number(w.risk_score||0)}});
    }

    if(await tableV25('wiener_payout_attempts')){
      const failed=(await pool.query(`select a.*,w.telegram_id,w.username,w.network from public.wiener_payout_attempts a left join public.withdrawals w on w.id=a.withdrawal_id where a.state='failed' and a.created_at>=$1 order by a.created_at asc limit 100`,[scanSince])).rows;
      for(const a of failed){const reason=String(a.failure_code||a.error||'payout_failed').replace(/_/g,' ').slice(0,180);out.payout_failed+=await sendAdminsV25('withdrawals',{type:'admin_payout_failed',key:`payout_failed:${a.withdrawal_id}:${a.retry_count||0}`,severity:'critical',text:`🔴 PAYOUT FAILED\n\nWithdrawal: ${String(a.withdrawal_id).slice(0,8)}\n👤 ${a.username?'@'+a.username:'UID '+(a.telegram_id||'—')}\nAmount: ${fmtV25(a.amount_usdt,9)} ${String(a.network).toUpperCase()==='TON'?'GRAM':'USDT'}\n\nReason: ${reason}\n\nNo unsafe automatic retry was made.`,markup:{inline_keyboard:[[{text:'💸 OPEN PAY CENTER',callback_data:'wpay:home'}]]},meta:{withdrawal_id:a.withdrawal_id}})}
    }

    if(await tableV25('exclusive_task_orders')){
      const rows=(await pool.query(`select id,title,target_completions,payment_received_ton,tx_hash,activated_at from public.exclusive_task_orders where status='live' and activated_at>=$1 order by activated_at asc limit 100`,[scanSince])).rows;
      for(const o of rows)out.tasks+=await sendAdminsV25('tasks',{type:'admin_tasks',key:`task_activated:${o.id}`,severity:'info',text:`✅ TASK PAYMENT RECEIVED\n\n${String(o.title||'Sponsored task').slice(0,80)}\nCompletions: ${Number(o.target_completions||0).toLocaleString()}\nReceived: ${fmtV25(o.payment_received_ton,9)} TON\n\nPayment verified and task is LIVE.`,markup:{inline_keyboard:[[{text:'✅ OPEN TASKS',web_app:{url:`${app}?page=tasks`}}]]},meta:{order_id:o.id}})
    }

    if(await tableV25('ambassador_broadcast_items')&&await tableV25('ambassador_broadcasts')){
      const rows=(await pool.query(`select i.id,i.channel_username,i.channel_title,i.error,b.completed_at from public.ambassador_broadcast_items i join public.ambassador_broadcasts b on b.id=i.broadcast_id where i.status='failed' and b.completed_at>=$1 order by b.completed_at asc limit 100`,[scanSince])).rows;
      for(const x of rows)out.ambassador+=await sendAdminsV25('ambassadors',{type:'admin_ambassador',key:`ambassador_publish_failed:${x.id}`,severity:'warning',text:`🟠 AMBASSADOR PUBLISH FAILED\n\nChannel: ${x.channel_username||x.channel_title||'Unknown'}\nReason: ${String(x.error||'Posting permission unavailable').replace(/_/g,' ').slice(0,180)}\n\nCheck the channel connection and bot posting permission.`,markup:{inline_keyboard:[[{text:'🖥 OPEN ADMIN',web_app:{url:`${app}?page=admin`}}]]},meta:{item_id:x.id}})
    }

    if(await columnV25('app_settings','ton_treasury_scan_failures')){
      const st=(await pool.query(`select ton_treasury_scan_enabled,ton_treasury_scan_failures,ton_treasury_last_success_at,ton_treasury_last_scan_error from public.app_settings where id=true`)).rows[0]||{},fail=Number(st.ton_treasury_scan_failures||0),prev=await stateGetV25('ton_scanner_health','ok');
      if(st.ton_treasury_scan_enabled&&fail>=3&&prev!=='degraded'){out.system+=await sendAdminsV25('system',{type:'admin_ton_scanner',key:`ton_scanner_degraded:${Date.now()}`,severity:'warning',text:`🟠 TON SCANNER DEGRADED\n\nConsecutive failures: ${fail}\nLast successful scan: ${st.ton_treasury_last_success_at?new Date(st.ton_treasury_last_success_at).toLocaleString():'Never'}\nLast issue: ${String(st.ton_treasury_last_scan_error||'Provider unavailable').slice(0,160)}\n\nDeposits/payout records remain safe while automatic retries continue.`,markup:{inline_keyboard:[[{text:'⚙️ TON CONFIG',callback_data:'cfg20:home'}]]}});await stateSetV25('ton_scanner_health','degraded')}
      if(fail===0&&prev==='degraded'){out.system+=await sendAdminsV25('system',{type:'admin_ton_scanner',key:`ton_scanner_recovered:${Date.now()}`,severity:'info',text:'🟢 TON SCANNER RECOVERED\n\nAutomatic TON scanning is operating normally again.',markup:{inline_keyboard:[[{text:'⚙️ TON CONFIG',callback_data:'cfg20:home'}]]}});await stateSetV25('ton_scanner_health','ok')}
    }

    if(await tableV25('ad_sessions')){
      const q=(await pool.query(`select count(*)::int total,count(*) filter(where lower(coalesce(status,'')) not in ('credited','verified','completed','rewarded'))::int bad from public.ad_sessions where started_at>=now()-interval '1 hour' and started_at<now()-interval '2 minutes'`)).rows[0]||{},total=Number(q.total||0),bad=Number(q.bad||0),rate=total?bad/total:0,prev=await stateGetV25('adsgram_health','ok');
      if(total>=20&&rate>=.40&&prev!=='degraded'){out.ads+=await sendAdminsV25('system',{type:'admin_ads',key:`adsgram_degraded:${Date.now()}`,severity:'warning',text:`🟠 ADSGRAM ISSUE DETECTED\n\nLast hour attempts: ${total}\nUncredited/unfinished: ${bad}\nRate: ${Math.round(rate*100)}%\n\nCheck AdsGram availability before changing reward logic.`,markup:{inline_keyboard:[[{text:'📺 ADS ADMIN',web_app:{url:`${app}?page=admin`}}]]}});await stateSetV25('adsgram_health','degraded')}
      if(total>=20&&rate<.25&&prev==='degraded'){out.ads+=await sendAdminsV25('system',{type:'admin_ads',key:`adsgram_recovered:${Date.now()}`,severity:'info',text:`🟢 ADSGRAM RECOVERED\n\nRecent ad completion health is back to normal.\nAttempts checked: ${total}`});await stateSetV25('adsgram_health','ok')}
    }

    if(typeof tonConfigStatus20==='function'){
      const admins=await adminsV25('withdrawals'),owner=admins[0];
      if(owner?.telegram_id){try{const x=await tonConfigStatus20(Number(owner.telegram_id)),bal=Number(x?.payout?.ton_balance),pending=Number(x?.pending?.v||0),prev=await stateGetV25('ton_treasury_health','ok');if(Number.isFinite(bal)&&pending>0){const level=bal<pending?'critical':bal<pending*2?'warning':'ok';if(level!=='ok'&&prev!==level){out.treasury+=await sendAdminsV25('withdrawals',{type:'admin_treasury',key:`ton_treasury_low:${level}:${Date.now()}`,severity:level,text:`${level==='critical'?'🔴':'🟠'} TON TREASURY LOW\n\nBalance: ${fmtV25(bal,9)} TON\nPending payouts: ${fmtV25(pending,9)} TON\n\n${level==='critical'?'Available balance is below the pending payout value.':'Reserve is below 2× the pending payout value.'}`,markup:{inline_keyboard:[[{text:'💎 TON CONFIG',callback_data:'cfg20:home'}]]}});await stateSetV25('ton_treasury_health',level)}if(level==='ok'&&prev!=='ok'){out.treasury+=await sendAdminsV25('withdrawals',{type:'admin_treasury',key:`ton_treasury_recovered:${Date.now()}`,severity:'info',text:`🟢 TON TREASURY HEALTHY\n\nBalance: ${fmtV25(bal,9)} TON\nPending payouts: ${fmtV25(pending,9)} TON`});await stateSetV25('ton_treasury_health','ok')}}}catch(e){console.error('alerts_v25_treasury',String(e?.message||e))}}
    }
    await stateSetV25('last_poll_at',pollNow);
    return out;
  }finally{alertRunBusyV25=false}
}
// === END WIENER BOT ALERT CENTER V25 ===
'''

s=s.replace(marker,'\n'+code+marker,1)

hook="    try{if(await handleAdminParityV19(up,uid,text,m,q)) return done();}catch(e){console.error('v19_admin_parity',String(e?.message||e));}\n"
if hook not in s:
    raise SystemExit('ERROR: V19 webhook handler hook not found')
s=s.replace(hook,"    try{if(await handleAlertsV25(up,uid,text,m,q)) return done();}catch(e){console.error('v25_alert_ui',String(e?.message||e));}\n"+hook,1)

# Add Alerts to the main user keyboard when the current V18 home markup is present.
home_old="[cb18('🎁 Promos','ux:promos'),cb18('🎉 Giveaways','ux:giveaways')],[cb18('❓ Help','ux:help')]])"
home_new="[cb18('🎁 Promos','ux:promos'),cb18('🎉 Giveaways','ux:giveaways')],[cb18('🔔 Alerts','al25:user'),cb18('❓ Help','ux:help')]])"
if home_old in s:s=s.replace(home_old,home_new,1)
else:print('WARNING: user home Alerts button anchor not found; /alerts still works')

# Add Alerts to the current V19 admin home.
adm_old=r"""[cb18('⚙️ SYSTEM','adm:system'),cb18('📜 AUDIT','adm:audit')],[cb18('👮 ADMINS','adm:admins'),web18('🖥 FULL ADMIN',`${a}?page=admin`)]]"""
adm_new=r"""[cb18('⚙️ SYSTEM','adm:system'),cb18('🔔 ALERTS','al25:admin')],[cb18('📜 AUDIT','adm:audit'),cb18('👮 ADMINS','adm:admins')],[web18('🖥 FULL ADMIN',`${a}?page=admin`)]]"""
if adm_old in s:s=s.replace(adm_old,adm_new,1)
else:print('WARNING: admin Alerts button anchor not found; /alerts still exposes admin settings')

# Make existing V11B user/admin reminders respect V25 preferences without replacing their proven scheduler.
legacy="async function send(uid,type,key,text,button,url,meta={},counts=true,cooldownHours=0){\n    if(!await canSend(uid,type,key,counts,cooldownHours)){skipped++;return false}"
legacy_new="async function send(uid,type,key,text,button,url,meta={},counts=true,cooldownHours=0){\n    if(typeof alertAllowedV25==='function'&&!await alertAllowedV25(uid,type,String(type).startsWith('admin_'),'info')){skipped++;return false}\n    if(!await canSend(uid,type,key,counts,cooldownHours)){skipped++;return false}"
if legacy in s:s=s.replace(legacy,legacy_new,1)
else:print('WARNING: legacy notification preference hook not found; existing reminders remain unchanged')

# Route the existing new-user/device alert to all owner/admin recipients through V25 preferences.
dev_admin_old=r"""const admin=(await pool.query(`select telegram_id from public.admins where enabled=true and role in ('owner','admin') order by telegram_id limit 1`)).rows[0];if(!admin?.telegram_id)return;"""
dev_admin_new=r"""const admins=(await pool.query(`select telegram_id from public.admins where enabled=true and role in ('owner','admin') order by telegram_id`)).rows;if(!admins.length)return;"""
if dev_admin_old in s:
    s=s.replace(dev_admin_old,dev_admin_new,1)
    dev_send_old=r"""await tgV10('sendMessage',{chat_id:Number(admin.telegram_id),text,reply_markup:kb18([[web18('👤 VIEW USER',`https://wiener-farm.vercel.app/?page=admin&user=${a.telegram_id}`)]]),disable_web_page_preview:true});"""
    dev_send_new=r"""if(blocked){await sendAlertV25({uid:Number(a.telegram_id),type:'security',key:`device_restricted:${a.telegram_id}:${a.created_at||a.alert_id||'new'}`,severity:'critical',text:'🛡 ACCOUNT RESTRICTED\\n\\nWIENER Farm detected activity that requires review.\\nYour app and withdrawal access are restricted until reviewed.',markup:{inline_keyboard:[[{text:'💬 CONTACT SUPPORT',url:'https://t.me/WienerSupport'}]]},meta:{blocked:true}})}for(const admin of admins){const severity=blocked?'critical':same?'warning':'info';await sendAlertV25({uid:Number(admin.telegram_id),type:'admin_security',key:`device_alert:${a.telegram_id}:${a.created_at||a.alert_id||'new'}`,severity,admin:true,text,markup:kb18([[web18('👤 VIEW USER',`https://wiener-farm.vercel.app/?page=admin&user=${a.telegram_id}`)]]),meta:{target_uid:a.telegram_id,blocked,same_device:same}})}"""
    if dev_send_old in s:s=s.replace(dev_send_old,dev_send_new,1)
    else:print('WARNING: V19B device alert send anchor not found')
else:
    print('WARNING: V19B device admin routing anchor not found')

# If V24 withdrawal-ad enforcement is already live, add a deduplicated bypass warning.
v24_guard_old=r"""if(a==='withdraw'){const withdrawAdCount=await withdrawAdCountV24(id);if(withdrawAdCount<5)throw new Error(`withdraw_ads_required_${withdrawAdCount}_of_5`);const amount=num(b.amount_wiener);"""
v24_guard_new=r"""if(a==='withdraw'){const withdrawAdCount=await withdrawAdCountV24(id);if(withdrawAdCount<5){void sendAdminsV25('withdrawals',{type:'admin_fraud',key:`withdraw_gate_bypass:${id}:${Math.floor(Date.now()/21600000)}`,severity:'warning',text:`🟠 WITHDRAWAL GATE BYPASS ATTEMPT\n\nUID: ${id}\nWithdrawal ads: ${withdrawAdCount}/5\n\nDirect withdrawal request was blocked server-side.`,meta:{target_uid:id,count:withdrawAdCount}}).catch(()=>null);throw new Error(`withdraw_ads_required_${withdrawAdCount}_of_5`)}const amount=num(b.amount_wiener);"""
if v24_guard_old in s:s=s.replace(v24_guard_old,v24_guard_new,1)
elif 'withdraw_gate_bypass:' not in s:print('WARNING: V24 bypass alert anchor not found; V24 may not be installed yet')

# Add clear mandatory account-status messages to the existing manual ban/unban flow.
ban_anchor=r"""await tgV10('sendMessage',{chat_id:uid,text:cmd==='ban'?`🚫 User Banned\nUID: ${target}`:`✅ User Fully Unbanned\nUID: ${target}`});return true}"""
if ban_anchor in s:
    ban_notice=r"""if(cmd==='unban'){const a25=await appUrlV25();await sendAlertV25({uid:target,type:'account_restored',key:`account_restored:${target}:${Date.now()}`,severity:'critical',text:'✅ ACCOUNT ACCESS RESTORED\n\nYour WIENER Farm account has been unrestricted.\nYou can use the Mini App normally again.',markup:{inline_keyboard:[[{text:'🌭 OPEN WIENER FARM',web_app:{url:a25}}]]}})}else{await sendAlertV25({uid:target,type:'security',key:`account_restricted:${target}:${Date.now()}`,severity:'critical',text:'🛡 ACCOUNT RESTRICTED\n\nYour WIENER Farm account access has been restricted.\nIf you believe this is a mistake, contact WIENER Support.',markup:{inline_keyboard:[[{text:'💬 CONTACT SUPPORT',url:'https://t.me/WienerSupport'}]]}})}"""
    s=s.replace(ban_anchor,ban_notice+ban_anchor,1)
else:
    print('WARNING: manual ban/unban notification anchor not found')

# Trigger V25 asynchronously from the existing authenticated internal cron.
cron_pos=s.find("app.post('/internal/cron'")
if cron_pos<0:raise SystemExit('ERROR: internal cron route not found')
guard="return res.status(403).send('forbidden');"
guard_pos=s.find(guard,cron_pos,cron_pos+2500)
if guard_pos<0:raise SystemExit('ERROR: internal cron auth guard not found')
inject="\n    void runAlertsV25().catch(e=>console.error('alerts_v25_cron',String(e?.message||e)));"
if "alerts_v25_cron" not in s[cron_pos:cron_pos+3000]:
    s=s[:guard_pos+len(guard)]+inject+s[guard_pos+len(guard):]

p.write_text(s)
print('Installed WIENER Bot Alert Center V25')
