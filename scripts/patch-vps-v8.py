from pathlib import Path

p=Path('/opt/wiener-backend/server.mjs')
s=p.read_text()
marker="\napp.use((_req,res)=>\n  res.status(404).json({ok:false,error:'route_not_enabled_yet'})\n);\n"
if 'WIENER VPS CRON ROUTES V8' in s:
    print('WIENER VPS CRON ROUTES V8 already installed')
    raise SystemExit(0)
if marker not in s:
    raise SystemExit('ERROR: insertion marker not found')

code=r'''
// === WIENER VPS CRON ROUTES V8 ===
async function cronSecretV8(){
  const q=await pool.query(`select notification_cron_secret from public.app_settings where id=true limit 1`);
  return String(q.rows[0]?.notification_cron_secret||'');
}
async function tgV8(method,payload){
  const r=await fetch(`https://api.telegram.org/bot${BOT}/${method}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
  const x=await r.json().catch(()=>({ok:false,description:'telegram_invalid_response'}));
  if(!x.ok) throw new Error(x.description||method);
  return x.result;
}
async function runProofRemindersV8(){
  const q=await pool.query(`select id,telegram_id from public.withdrawals where status='paid' and proof_reminder_sent_at is null and proof_reminder_due_at is not null and proof_reminder_due_at<=now() order by proof_reminder_due_at limit 100`);
  let sent=0;
  for(const w of q.rows){
    try{
      await tgV8('sendMessage',{chat_id:w.telegram_id,text:'📸 Payment received?\n\nShare your payout proof in the community if you want.',reply_markup:{inline_keyboard:[[{text:'SEND PROOF',url:'https://t.me/wienerfarmChat'}]]}});
      await pool.query(`update public.withdrawals set proof_reminder_sent_at=now() where id=$1 and proof_reminder_sent_at is null`,[w.id]);
      sent++;
    }catch(e){console.error('proof reminder',w.id,String(e?.message||e));}
  }
  return sent;
}
async function runFarmRemindersV8(){
  const s=(await pool.query(`select app_url,farm_claim_cooldown_seconds from public.app_settings where id=true`)).rows[0]||{};
  const day=new Date().toISOString().slice(0,10);
  const q=await pool.query(`select telegram_id,farm_started_at,farm_claims_day,farm_claims_today from public.users where is_banned=false and notification_unreachable_at is null and farm_started_at is not null and farm_started_at + (($1::int||' seconds')::interval) <= now() limit 1000`,[Number(s.farm_claim_cooldown_seconds||0)]);
  let sent=0;
  for(const u of q.rows){
    const claims=String(u.farm_claims_day||'').slice(0,10)===day?Number(u.farm_claims_today||0):0;
    if(claims>=5) continue;
    const key=`wiener_ready:${day}`;
    const exists=await pool.query(`select 1 from public.notification_log where telegram_id=$1 and event_key=$2 and status='sent' limit 1`,[u.telegram_id,key]);
    if(exists.rows.length) continue;
    try{
      const m=await tgV8('sendMessage',{chat_id:u.telegram_id,text:'🌭 Farm reward ready\n\nYour WIENER is ready to claim.',reply_markup:{inline_keyboard:[[{text:'CLAIM',web_app:{url:String(s.app_url||'https://wiener-farm.vercel.app')+'?page=claim'}}]]}});
      await pool.query(`insert into public.notification_log(telegram_id,event_type,event_key,status,telegram_message_id,sent_at,metadata) values($1,'wiener_ready',$2,'sent',$3,now(),'{}'::jsonb) on conflict do nothing`,[u.telegram_id,key,m.message_id]);
      sent++;
    }catch(e){console.error('farm reminder',u.telegram_id,String(e?.message||e));}
  }
  return sent;
}
async function runAmbassadorV8(){
  let settled=null;
  try{settled=await rpc('settle_ambassador_weekly_rounds',[])}catch(e){console.error('amb settle',String(e?.message||e));}
  const rows=(await pool.query(`select id,channel_id from public.ambassadors where channel_id is not null and (last_channel_check_at is null or last_channel_check_at<now()-interval '6 hours') order by coalesce(last_channel_check_at,'epoch') limit 100`)).rows;
  let checked=0;
  let me=null;
  try{me=await tgV8('getMe',{})}catch{}
  if(me){
    for(const a of rows){
      try{
        const [chat,bm,count]=await Promise.all([
          tgV8('getChat',{chat_id:a.channel_id}),
          tgV8('getChatMember',{chat_id:a.channel_id,user_id:me.id}),
          tgV8('getChatMemberCount',{chat_id:a.channel_id})
        ]);
        const admin=['creator','administrator'].includes(bm?.status);
        const post=bm?.status==='creator'||(bm?.status==='administrator'&&bm.can_post_messages===true);
        await pool.query(`update public.ambassadors set channel_title=$2,channel_username=$3,subscriber_count=$4,bot_is_admin=$5,bot_can_post=$6,last_channel_check_at=now(),updated_at=now() where id=$1`,[a.id,String(chat.title||''),chat.username?'@'+chat.username:null,Number(count||0),admin,post]);
        checked++;
      }catch(e){
        await pool.query(`update public.ambassadors set bot_is_admin=false,bot_can_post=false,last_channel_check_at=now(),updated_at=now() where id=$1`,[a.id]).catch(()=>null);
      }
    }
  }
  return {settled,checked};
}
async function runGiveawaysV8(){
  const gs=(await pool.query(`select * from public.giveaways where giveaway_type='auto' and status in ('open','processing') and end_at<=now()-interval '2 minutes' order by end_at limit 20`)).rows;
  let processed=0;
  for(const g of gs){
    try{
      const claimed=await rpc('claim_auto_giveaway_finalize',[g.id]);
      if(!claimed) continue;
      const parts=(await pool.query(`select gp.*,u.total_ads,u.active_referrals_count,u.is_banned,u.device_blocked from public.giveaway_participants gp join public.users u on u.telegram_id=gp.telegram_id where gp.giveaway_id=$1 and gp.valid=true`,[g.id])).rows;
      const valid=[];
      for(const x of parts){
        let ok=!x.is_banned&&!x.device_blocked;
        if(g.requirement_type==='ads') ok=ok&&Number(x.total_ads||0)>=Number(g.requirement_value||0);
        if(g.requirement_type==='referrals') ok=ok&&Number(x.active_referrals_count||0)>=Number(g.requirement_value||0);
        if(g.requirement_type==='tasks'){
          const c=await pool.query(`select count(*)::int c from public.task_completions where telegram_id=$1`,[x.telegram_id]);
          ok=ok&&Number(c.rows[0]?.c||0)>=Number(g.requirement_value||0);
        }
        if(ok) valid.push(x);
      }
      if(!valid.length){await pool.query(`update public.giveaways set status='needs_review',processing_error='No valid participants at deadline',valid_count=0,updated_at=now() where id=$1`,[g.id]);continue;}
      for(let i=valid.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[valid[i],valid[j]]=[valid[j],valid[i]];}
      const winners=valid.slice(0,Math.min(Number(g.winners_count||1),valid.length));
      await pool.query('begin');
      try{
        await pool.query(`delete from public.giveaway_winners where giveaway_id=$1`,[g.id]);
        for(let i=0;i<winners.length;i++){
          const x=winners[i];
          await pool.query(`insert into public.giveaway_winners(giveaway_id,rank,telegram_id,username,first_name,amount) values($1,$2,$3,$4,$5,$6)`,[g.id,i+1,x.telegram_id,x.username||null,x.first_name||null,Number(g.prize_each||0)]);
        }
        await pool.query(`update public.giveaways set status='selected',selected_at=now(),valid_count=$2,processing_error=null,updated_at=now() where id=$1`,[g.id,valid.length]);
        await pool.query('commit');
      }catch(e){await pool.query('rollback');throw e;}
      await rpc('credit_giveaway',[g.id,g.created_by]);
      const ws=(await pool.query(`select * from public.giveaway_winners where giveaway_id=$1 order by rank`,[g.id])).rows;
      for(const w of ws){try{await tgV8('sendMessage',{chat_id:w.telegram_id,text:`🎉 YOU WON!\n\nYou won the WIENER Farm Giveaway.\n🏆 Reward: +${Number(w.amount||0).toLocaleString()} WIENER\n💰 Credited automatically to your balance.`});await pool.query(`update public.giveaway_winners set notified_at=now(),notification_error=null where giveaway_id=$1 and rank=$2`,[g.id,w.rank]);}catch(e){console.error('winner notify',String(e?.message||e));}}
      await pool.query(`update public.giveaways set auto_processed_at=now(),updated_at=now() where id=$1`,[g.id]);
      processed++;
    }catch(e){console.error('giveaway worker',g.id,String(e?.message||e));}
  }
  return processed;
}
app.post('/internal/cron',async(req,res)=>{
  try{
    const sec=await cronSecretV8();
    if(!sec||String(req.headers['x-wiener-cron-secret']||'')!==sec) return res.status(403).send('forbidden');
    const [proof,farm,amb,giveaways]=await Promise.all([runProofRemindersV8(),runFarmRemindersV8(),runAmbassadorV8(),runGiveawaysV8()]);
    return res.json({ok:true,proof_reminders:proof,farm_reminders:farm,ambassador:amb,giveaways});
  }catch(e){console.error('cron v8',e);return res.status(500).json({ok:false,error:String(e?.message||e)});}
});
// === END WIENER VPS CRON ROUTES V8 ===
'''
s=s.replace(marker,'\n'+code+'\n'+marker,1)
p.write_text(s)
print('Installed WIENER VPS CRON ROUTES V8')
