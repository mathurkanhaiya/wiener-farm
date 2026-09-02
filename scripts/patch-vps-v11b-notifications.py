from pathlib import Path
p=Path('/opt/wiener-backend/server.mjs')
s=p.read_text()
if 'WIENER VPS NOTIFICATIONS V11B' in s:
 print('V11B already installed'); raise SystemExit(0)
route="""    const [proof,farm,amb,giveaways]=await Promise.all([
      runProofRemindersV8(),runFarmRemindersV8(),runAmbassadorV8(),runGiveawaysV8()
    ]);
    return res.json({ok:true,busy:false,proof_reminders:proof,farm_reminders:farm,ambassador:amb,giveaways});"""
if route not in s: raise SystemExit('ERROR: V8B cron body not found')
helper=r'''

// === WIENER VPS NOTIFICATIONS V11B ===
async function runLegacyNotificationsV11B(){
  const st=(await pool.query(`select app_url,token_per_usdt from public.app_settings where id=true`)).rows[0]||{};
  const app=String(st.app_url||'https://wiener-farm.vercel.app').replace(/\/$/,''),day=new Date().toISOString().slice(0,10),hour=new Date().getUTCHours();
  let sent=0,failed=0,skipped=0;
  async function canSend(uid,type,key,counts=true,cooldownHours=0){
    if((await pool.query(`select 1 from public.notification_log where telegram_id=$1 and event_key=$2 and status='sent' limit 1`,[uid,key])).rows.length)return false;
    if(cooldownHours&&(await pool.query(`select 1 from public.notification_log where telegram_id=$1 and event_type=$2 and status='sent' and created_at>=now()-($3::text||' hours')::interval limit 1`,[uid,type,String(cooldownHours)])).rows.length)return false;
    if(counts){const q=await pool.query(`select count(*)::int c from public.notification_log where telegram_id=$1 and status='sent' and created_at>=date_trunc('day',now() at time zone 'utc') and event_type not in ('withdrawal_paid','withdrawal_rejected','security','withdrawal_proof_reminder','admin_security','admin_payout_queue','admin_treasury')`,[uid]);if(Number(q.rows[0]?.c||0)>=2)return false}
    return true;
  }
  async function send(uid,type,key,text,button,url,meta={},counts=true,cooldownHours=0){
    if(!await canSend(uid,type,key,counts,cooldownHours)){skipped++;return false}
    let log;try{log=(await pool.query(`insert into public.notification_log(telegram_id,event_type,event_key,status,metadata) values($1,$2,$3,'pending',$4::jsonb) returning id`,[uid,type,key,JSON.stringify(meta)])).rows[0]}catch{skipped++;return false}
    const reply_markup=button&&url?{inline_keyboard:[[{text:button,web_app:{url}}]]}:undefined;
    try{const m=await tgV8('sendMessage',{chat_id:uid,text,disable_web_page_preview:true,reply_markup});await pool.query(`update public.notification_log set status='sent',telegram_message_id=$2,sent_at=now(),error=null where id=$1`,[log.id,m.message_id]);sent++;return true}catch(e){const msg=String(e?.message||e);await pool.query(`update public.notification_log set status='failed',error=$2 where id=$1`,[log.id,msg]);if(/blocked by the user|chat not found|user is deactivated|can't initiate conversation/i.test(msg))await pool.query(`update public.users set notification_unreachable_at=now() where telegram_id=$1`,[uid]);failed++;return false}
  }
  const refs=(await pool.query(`select id,telegram_id,amount from public.transactions where kind='referral_qualified' and created_at>=now()-interval '24 hours' order by created_at asc limit 2000`)).rows;
  const byUser=new Map();for(const r of refs){const uid=Number(r.telegram_id);if(!byUser.has(uid))byUser.set(uid,[]);byUser.get(uid).push(r)}
  for(const [uid,rr] of byUser){const ids=[];let total=0;for(const r of rr){const k=`referral:${r.id}`;if(!(await pool.query(`select 1 from public.notification_log where telegram_id=$1 and event_key=$2 and status='sent'`,[uid,k])).rows.length){ids.push(r.id);total+=Number(r.amount||0)}}if(ids.length)await send(uid,'referral_qualified',`referral:${ids.join(',')}`,`👥 Referral reward\n\n+${total} WIENER added${ids.length>1?` from ${ids.length} qualified referrals`:''}.`,'VIEW REFERRALS',`${app}?page=referral`,{count:ids.length,total,ids},true,6)}
  const sponsored=(await pool.query(`select id,reward from public.tasks where enabled=true and created_at>=now()-interval '24 hours' and (sponsored_order_id is not null or reward>=100) order by created_at desc limit 100`)).rows;
  if(sponsored.length){const users=(await pool.query(`select telegram_id from public.users where is_banned=false and notification_unreachable_at is null limit 2000`)).rows;for(const u of users){const uid=Number(u.telegram_id),done=(await pool.query(`select task_id from public.task_completions where telegram_id=$1 and created_at>=now()-interval '7 days'`,[uid])).rows.map(x=>String(x.task_id)),av=sponsored.filter(t=>!done.includes(String(t.id)));if(av.length){const total=av.reduce((a,t)=>a+Number(t.reward||0),0);await send(uid,'new_tasks',`sponsored_tasks:${day}`,`🎯 New sponsored task${av.length>1?'s':''}\n\n${av.length} available · up to +${total} WIENER.`,'VIEW TASKS',`${app}?page=tasks`,{count:av.length,total},true,20)}}}
  if(hour>=14&&hour<=17){const users=(await pool.query(`select telegram_id,daily_streak,last_daily_claim_date from public.users where is_banned=false and notification_unreachable_at is null and daily_streak>0 limit 2000`)).rows;for(const u of users)if(String(u.last_daily_claim_date||'').slice(0,10)!==day)await send(Number(u.telegram_id),'streak_warning',`streak:${day}`,`🔥 Daily reward waiting\n\nCurrent streak: ${Number(u.daily_streak||0)} day${Number(u.daily_streak||0)===1?'':'s'}.`,'CLAIM DAILY',`${app}?page=daily`,{streak:Number(u.daily_streak||0)},true,20)}
  const methods=(await pool.query(`select minimum_usdt from public.withdrawal_methods where enabled=true order by minimum_usdt`)).rows,min=methods.length?Math.min(...methods.map(x=>Number(x.minimum_usdt||0))):0,threshold=min*Number(st.token_per_usdt||0);
  if(threshold>0){const users=(await pool.query(`select telegram_id,balance from public.users where is_banned=false and notification_unreachable_at is null and balance>=$1 limit 2000`,[threshold])).rows;for(const u of users)await send(Number(u.telegram_id),'withdraw_ready',`withdraw_ready:${threshold}`,`💎 Withdrawal unlocked\n\nBalance: ${Number(u.balance||0).toLocaleString()} WIENER.`,'OPEN WALLET',`${app}?page=wallet`,{threshold},true,87600)}
  const pending=(await pool.query(`select id,telegram_id,receive_usdt from public.withdrawals where status='pending' and method_key='gram_ton' order by created_at asc limit 250`)).rows;
  if(pending.length){const admins=(await pool.query(`select telegram_id,role,permissions from public.admins where enabled=true`)).rows.filter(a=>a.role==='owner'||a.role==='admin'||a.permissions?.withdrawals===true),value=pending.reduce((a,w)=>a+Number(w.receive_usdt||0),0);for(const a of admins)await send(Number(a.telegram_id),'admin_payout_queue',`admin_queue:${day}:${Math.floor(hour/4)}`,`💎 GRAM payout queue\n\nPending: ${pending.length}\nValue: ${value.toFixed(6)} GRAM`,'OPEN WIENER FARM',app,{pending:pending.length,pending_ton:value},False if False else False,4)}
  return {sent,failed,skipped};
}
'''.replace('False if False else False','false')
insert_at=s.find("app.post('/internal/cron'")
if insert_at<0: raise SystemExit('ERROR: cron route not found')
s=s[:insert_at]+helper+'\n'+s[insert_at:]
new="""    const [proof,farm,amb,giveaways,legacy_notifications]=await Promise.all([
      runProofRemindersV8(),runFarmRemindersV8(),runAmbassadorV8(),runGiveawaysV8(),runLegacyNotificationsV11B()
    ]);
    return res.json({ok:true,busy:false,proof_reminders:proof,farm_reminders:farm,ambassador:amb,giveaways,legacy_notifications});"""
s=s.replace(route,new,1)
p.write_text(s)
print('Installed WIENER VPS NOTIFICATIONS V11B')
