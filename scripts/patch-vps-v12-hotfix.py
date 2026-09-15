from pathlib import Path

p=Path('/opt/wiener-backend/server.mjs')
s=p.read_text()

if 'WIENER VPS V12 HOTFIX' in s:
    print('V12 hotfix already installed')
    raise SystemExit(0)

start="    if(action==='admin_user_inspect'){"
end="    if(action==='admin_settings_save'){"
a=s.find(start)
b=s.find(end,a)
if a<0 or b<0:
    raise SystemExit('ERROR: admin inspector block not found')

new=r'''    if(action==='admin_user_inspect'){
      const uid=num(b.telegram_id); if(!uid) throw new Error('invalid_user');
      const [u,refs,flags,tx,w,tasks,ads,tads,adsg,promo,botVerify,visits,deviceUnban,gparts,notify]=await Promise.all([
        pool.query(`select * from public.users where telegram_id=$1 limit 1`,[uid]),
        pool.query(`select telegram_id,username,first_name,referral_active,referral_reward_eligible,referral_ineligible_reason,total_ads,created_at,last_active,is_banned,device_blocked from public.users where referred_by=$1 order by created_at desc limit 500`,[uid]),
        pool.query(`select * from public.referral_abuse_flags where telegram_id=$1 or related_telegram_id=$1 order by created_at desc limit 200`,[uid]),
        pool.query(`select * from public.transactions where telegram_id=$1 order by created_at desc limit 300`,[uid]),
        pool.query(`select * from public.withdrawals where telegram_id=$1 order by created_at desc limit 100`,[uid]),
        pool.query(`select tc.*,jsonb_build_object('title',t.title,'category',t.category,'task_type',t.task_type,'verification',t.verification) tasks from public.task_completions tc left join public.tasks t on t.id=tc.task_id where tc.telegram_id=$1 order by tc.created_at desc limit 200`,[uid]),
        pool.query(`select *, 'AdsGram Rewarded Ad'::text provider, 'adsgram_rewarded'::text source from public.ad_sessions where telegram_id=$1 order by started_at desc limit 200`,[uid]),
        pool.query(`select *, 'Bonus Interstitial Ad'::text provider, 'bonus_interstitial'::text source from public.tads_ad_sessions where telegram_id=$1 order by started_at desc limit 200`,[uid]),
        pool.query(`select *, 'AdsGram Sponsored Task'::text provider, 'adsgram_task'::text source from public.adsgram_task_sessions where telegram_id=$1 order by created_at desc limit 100`,[uid]),
        pool.query(`select * from public.promo_ad_sessions where telegram_id=$1 order by created_at desc limit 100`,[uid]),
        pool.query(`select * from public.bot_task_verifications where telegram_id=$1 order by requested_at desc limit 100`,[uid]),
        pool.query(`select v.*,jsonb_build_object('title',t.title,'category',t.category) tasks from public.external_task_visits v left join public.tasks t on t.id=v.task_id where v.telegram_id=$1 order by v.opened_at desc limit 100`,[uid]),
        pool.query(`select * from public.device_unban_audit where telegram_id=$1 order by created_at desc limit 50`,[uid]),
        pool.query(`select gp.*,jsonb_build_object('public_code',g.public_code,'status',g.status,'prize_input',g.prize_input,'winners_count',g.winners_count,'end_at',g.end_at) giveaways from public.giveaway_participants gp left join public.giveaways g on g.id=gp.giveaway_id where gp.telegram_id=$1 order by gp.joined_at desc limit 100`,[uid]),
        pool.query(`select event_type,status,created_at from public.notification_log where telegram_id=$1 order by created_at desc limit 100`,[uid])
      ]);
      if(!u.rows[0]) throw new Error('user_not_found');
      const refIds=refs.rows.map(x=>num(x.telegram_id)).filter(Boolean);
      let level2=[];
      if(refIds.length){
        level2=(await pool.query(`select telegram_id,username,first_name,referred_by,referral_active,referral_reward_eligible,referral_ineligible_reason,total_ads,created_at,is_banned,device_blocked from public.users where referred_by=any($1::bigint[]) order by created_at desc limit 1000`,[refIds])).rows;
      }
      const allAds=[...ads.rows,...tads.rows,...adsg.rows].sort((x,y)=>new Date(y.started_at||y.created_at||0)-new Date(x.started_at||x.created_at||0));
      const creditedAds=allAds.filter(x=>x.credited_at||x.verified_at||['credited','completed','rewarded'].includes(String(x.status||'').toLowerCase()));
      const presentTx=tx.rows.map(x=>{const raw=String(x.kind||'transaction').toLowerCase(),m=x.metadata||{};let title=String(x.description||x.kind||'Transaction'),detail='Balance transaction';if(raw==='rewarded_ad'||raw==='ad_reward'||(raw.includes('rewarded')&&raw.includes('ad'))){title='AdsGram Rewarded Ad';detail='AdsGram · credited'}else if(raw==='tads_ad'||raw==='bonus_ad'||raw==='bonus_interstitial_ad'){title='Bonus Interstitial Ad';detail='Bonus ad · credited'}else if(raw.includes('adsgram_task')){title='AdsGram Sponsored Task';detail='AdsGram task · credited'}else if(raw==='task'||raw==='task_reward'||raw.includes('task_reward')){title='Task Reward';detail=m?.task_id?'Task completed':'Task · credited'}else if(raw.includes('referral')){title='Referral Reward';detail='Valid referral · credited'}else if(raw.includes('promo')){title='Promo Reward';detail='Promo code · credited'}else if(raw.includes('farm')){title='Farm Reward';detail='Farm claim · credited'}else if(raw.includes('daily')){title='Daily Reward';detail='Daily claim · credited'}else if(raw.includes('giveaway')){title='Giveaway Reward';detail='Giveaway · credited'}else if(raw.includes('admin')&&raw.includes('adjust')){title='Admin Balance Adjustment';detail='Admin adjustment'}else if(raw.includes('withdraw')){title='Withdrawal';detail='Balance deduction'}else if(raw.includes('transfer')){title='Internal Transfer';detail='Balance transfer'}return {...x,description:title,kind:detail,raw_kind:x.kind}});
      const timeline=[];
      for(const x of presentTx)timeline.push({type:'transaction',at:x.created_at,title:x.description,detail:x.kind,amount:num(x.amount),status:'credited',meta:x.metadata});
      for(const x of w.rows)timeline.push({type:'withdrawal',at:x.updated_at||x.created_at,title:`Withdrawal ${String(x.status||'pending').toUpperCase()}`,detail:`${x.network||x.method_key||''} · ${num(x.receive_usdt||x.gross_usdt).toFixed(4)} USDT`,amount:0,status:x.status});
      for(const x of refs.rows)timeline.push({type:'referral',at:x.created_at,title:`Invited ${x.username?'@'+x.username:(x.first_name||x.telegram_id)}`,detail:x.referral_active?'Valid referral':(x.referral_ineligible_reason||'Pending / invalid'),amount:0,status:x.referral_active?'valid':'invalid'});
      timeline.sort((x,y)=>new Date(y.at||0)-new Date(x.at||0));
      const validRefs=refs.rows.filter(x=>x.referral_active||x.referral_reward_eligible).length;
      const invalidRefs=refs.rows.filter(x=>!x.referral_active&&!x.referral_reward_eligible).length;
      return res.json({ok:true,data:{user:u.rows[0],summary:{direct_referrals:refs.rows.length,valid_referrals:validRefs,invalid_referrals:invalidRefs,second_level_referrals:level2.length,tasks_completed:tasks.rows.length,tracked_ads:allAds.length,credited_ads:creditedAds.length,withdrawals:w.rows.length,transactions:presentTx.length,abuse_flags:flags.rows.length},referrals:{level1:refs.rows,level2},security:{flags:flags.rows,device_unbans:deviceUnban.rows},activity:{timeline:timeline.slice(0,500),transactions:presentTx,withdrawals:w.rows,tasks:tasks.rows,ads:creditedAds,promos:promo.rows,bot_verifications:botVerify.rows,task_visits:visits.rows,giveaways:gparts.rows,notifications:notify.rows,diagnostics:{ad_sessions:allAds}}}});
    }
'''

s=s[:a]+new+s[b:]

# Make ad usage resilient to date serialization and derive today's count from the actual ledger if needed.
old="const used=String(user.ads_day||'')===today?num(user.ads_watched_today):0;"
newused="const day=String(user.ads_day||'').slice(0,10); let used=day===today?num(user.ads_watched_today):0; if(used===0){used=num((await pool.query(`select count(*)::int c from public.ad_sessions where telegram_id=$1 and network='adsgram' and status='credited' and credited_at::date=current_date`,[id])).rows[0]?.c||0)}"
if old in s:
    s=s.replace(old,newused,1)
else:
    print('WARN: V9 ad usage line not found; admin fix still applied')

# Marker for idempotency.
s=s.replace("// === END WIENER VPS ROUTES V9 ===","// === WIENER VPS V12 HOTFIX ===\n// === END WIENER VPS ROUTES V9 ===",1)
p.write_text(s)
print('Installed WIENER VPS V12 HOTFIX')
