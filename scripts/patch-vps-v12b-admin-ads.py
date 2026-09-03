from pathlib import Path

p=Path('/opt/wiener-backend/server.mjs')
s=p.read_text()

if 'WIENER VPS V12B ADMIN ADS' in s:
    print('V12B already installed')
    raise SystemExit(0)

# Replace ad usage route with ledger-backed counting. Never trust the cached user day counter.
ad_start="app.post('/functions/v1/wiener-ad-usage',async(req,res)=>{"
ad_end="app.post('/functions/v1/wiener-admin-settings',async(req,res)=>{"
a=s.find(ad_start)
b=s.find(ad_end,a)
if a<0 or b<0:
    raise SystemExit('ERROR: ad usage route not found')

ad_code=r'''app.post('/functions/v1/wiener-ad-usage',async(req,res)=>{
  try{
    const body=req.body||{}; const {id}=await edgeUser(body);
    const [userQ,settingsQ,countQ,lastQ]=await Promise.all([
      pool.query(`select is_banned from public.users where telegram_id=$1 limit 1`,[id]),
      pool.query(`select ads_enabled,daily_ad_limit,ad_reward,adsgram_block_id,maintenance_enabled from public.app_settings where id=true limit 1`),
      pool.query(`select count(*)::int c from public.ad_sessions where telegram_id=$1 and status='credited' and coalesce(credited_at,verified_at,started_at)>=date_trunc('day',now()) and coalesce(credited_at,verified_at,started_at)<date_trunc('day',now())+interval '1 day'`,[id]),
      pool.query(`select coalesce(credited_at,verified_at,started_at) at from public.ad_sessions where telegram_id=$1 and status='credited' order by coalesce(credited_at,verified_at,started_at) desc limit 1`,[id])
    ]);
    const user=userQ.rows[0],st=settingsQ.rows[0];
    if(!user) throw new Error('user_not_found');
    if(!st) throw new Error('settings_unavailable');
    if(user.is_banned) throw new Error('user_banned');
    const used=num(countQ.rows[0]?.c||0),limit=num(st.daily_ad_limit||0);
    let cooldown=0; const at=lastQ.rows[0]?.at;
    if(at) cooldown=Math.max(0,Math.ceil((20000-(Date.now()-new Date(at).getTime()))/1000));
    return res.json({ok:true,data:{used,limit,remaining:Math.max(0,limit-used),cooldown_seconds:cooldown,full_reward:num(st.ad_reward),block_id:st.adsgram_block_id,ads_enabled:!!st.ads_enabled,maintenance_enabled:!!st.maintenance_enabled,source:'ledger'}});
  }catch(e){return edgeFail(res,e)}
});

'''
s=s[:a]+ad_code+s[b:]

# Replace admin inspector with a resilient version. Optional history failures must never blank the admin UI.
start="    if(action==='admin_user_inspect'){"
end="    if(action==='admin_settings_save'){"
a=s.find(start)
b=s.find(end,a)
if a<0 or b<0:
    raise SystemExit('ERROR: admin inspector block not found')

admin_code=r'''    if(action==='admin_user_inspect'){
      const uid=num(b.telegram_id); if(!uid) throw new Error('invalid_user');
      const uq=await pool.query(`select * from public.users where telegram_id=$1 limit 1`,[uid]);
      const user=uq.rows[0]; if(!user) throw new Error('user_not_found');
      const q=async(sql,args=[uid])=>{try{return (await pool.query(sql,args)).rows}catch(err){console.error('admin inspector optional query',String(err?.message||err));return []}};
      const [refs,flags,tx,withdrawals,tasks,ads,tads,adsg,promos,botVerify,visits,deviceUnban,giveaways,notifications]=await Promise.all([
        q(`select telegram_id,username,first_name,referral_active,referral_reward_eligible,referral_ineligible_reason,total_ads,created_at,last_active,is_banned,device_blocked from public.users where referred_by=$1 order by created_at desc limit 500`),
        q(`select * from public.referral_abuse_flags where telegram_id=$1 or related_telegram_id=$1 order by created_at desc limit 200`),
        q(`select * from public.transactions where telegram_id=$1 order by created_at desc limit 300`),
        q(`select * from public.withdrawals where telegram_id=$1 order by created_at desc limit 100`),
        q(`select tc.*,jsonb_build_object('title',t.title,'category',t.category,'task_type',t.task_type,'verification',t.verification) tasks from public.task_completions tc left join public.tasks t on t.id=tc.task_id where tc.telegram_id=$1 order by tc.created_at desc limit 200`),
        q(`select *, 'AdsGram Rewarded Ad'::text provider, 'adsgram_rewarded'::text source from public.ad_sessions where telegram_id=$1 order by started_at desc limit 200`),
        q(`select *, 'Bonus Interstitial Ad'::text provider, 'bonus_interstitial'::text source from public.tads_ad_sessions where telegram_id=$1 order by started_at desc limit 200`),
        q(`select *, 'AdsGram Sponsored Task'::text provider, 'adsgram_task'::text source from public.adsgram_task_sessions where telegram_id=$1 order by created_at desc limit 100`),
        q(`select * from public.promo_ad_sessions where telegram_id=$1 order by created_at desc limit 100`),
        q(`select * from public.bot_task_verifications where telegram_id=$1 order by requested_at desc limit 100`),
        q(`select v.*,jsonb_build_object('title',t.title,'category',t.category) tasks from public.external_task_visits v left join public.tasks t on t.id=v.task_id where v.telegram_id=$1 order by v.opened_at desc limit 100`),
        q(`select * from public.device_unban_audit where telegram_id=$1 order by created_at desc limit 50`),
        q(`select gp.*,jsonb_build_object('public_code',g.public_code,'status',g.status,'prize_input',g.prize_input,'winners_count',g.winners_count,'end_at',g.end_at) giveaways from public.giveaway_participants gp left join public.giveaways g on g.id=gp.giveaway_id where gp.telegram_id=$1 order by gp.joined_at desc limit 100`),
        q(`select event_type,status,created_at from public.notification_log where telegram_id=$1 order by created_at desc limit 100`)
      ]);
      const refIds=refs.map(x=>num(x.telegram_id)).filter(Boolean);
      let level2=[];
      if(refIds.length){try{level2=(await pool.query(`select telegram_id,username,first_name,referred_by,referral_active,referral_reward_eligible,referral_ineligible_reason,total_ads,created_at,is_banned,device_blocked from public.users where referred_by=any($1::bigint[]) order by created_at desc limit 1000`,[refIds])).rows}catch{level2=[]}}
      const allAds=[...ads,...tads,...adsg].sort((x,y)=>new Date(y.started_at||y.created_at||0).getTime()-new Date(x.started_at||x.created_at||0).getTime());
      const creditedAds=allAds.filter(x=>x.credited_at||x.verified_at||['credited','completed','rewarded'].includes(String(x.status||'').toLowerCase()));
      const presentTx=tx.map(x=>{const raw=String(x.kind||'transaction').toLowerCase(),m=x.metadata||{};let title=String(x.description||x.kind||'Transaction'),detail='Balance transaction';if(raw==='rewarded_ad'||raw==='ad_reward'||(raw.includes('rewarded')&&raw.includes('ad'))){title='AdsGram Rewarded Ad';detail='AdsGram · credited'}else if(raw==='tads_ad'||raw==='bonus_ad'||raw==='bonus_interstitial_ad'){title='Bonus Interstitial Ad';detail='Bonus ad · credited'}else if(raw.includes('adsgram_task')){title='AdsGram Sponsored Task';detail='AdsGram task · credited'}else if(raw==='task'||raw==='task_reward'||raw.includes('task_reward')){title='Task Reward';detail=m?.task_id?'Task completed':'Task · credited'}else if(raw.includes('referral')){title='Referral Reward';detail='Valid referral · credited'}else if(raw.includes('promo')){title='Promo Reward';detail='Promo code · credited'}else if(raw.includes('farm')){title='Farm Reward';detail='Farm claim · credited'}else if(raw.includes('daily')){title='Daily Reward';detail='Daily claim · credited'}else if(raw.includes('giveaway')){title='Giveaway Reward';detail='Giveaway · credited'}else if(raw.includes('admin')&&raw.includes('adjust')){title='Admin Balance Adjustment';detail='Admin adjustment'}else if(raw.includes('withdraw')){title='Withdrawal';detail='Balance deduction'}else if(raw.includes('transfer')){title='Internal Transfer';detail='Balance transfer'}return {...x,description:title,kind:detail,raw_kind:x.kind}});
      const timeline=[];
      for(const x of presentTx)timeline.push({type:'transaction',at:x.created_at,title:x.description,detail:x.kind,amount:num(x.amount),status:'credited',meta:x.metadata});
      for(const x of withdrawals)timeline.push({type:'withdrawal',at:x.updated_at||x.created_at,title:`Withdrawal ${String(x.status||'pending').toUpperCase()}`,detail:`${x.network||x.method_key||''} · ${num(x.receive_usdt||x.gross_usdt).toFixed(4)} USDT`,amount:0,status:x.status});
      for(const x of refs)timeline.push({type:'referral',at:x.created_at,title:`Invited ${x.username?'@'+x.username:(x.first_name||x.telegram_id)}`,detail:x.referral_active?'Valid referral':(x.referral_ineligible_reason||'Pending / invalid'),amount:0,status:x.referral_active?'valid':'invalid'});
      timeline.sort((x,y)=>new Date(y.at||0).getTime()-new Date(x.at||0).getTime());
      const validRefs=refs.filter(x=>x.referral_active||x.referral_reward_eligible).length;
      return res.json({ok:true,data:{user,summary:{direct_referrals:refs.length,valid_referrals:validRefs,invalid_referrals:refs.length-validRefs,second_level_referrals:level2.length,tasks_completed:tasks.length,tracked_ads:allAds.length,credited_ads:creditedAds.length,withdrawals:withdrawals.length,transactions:presentTx.length,abuse_flags:flags.length},referrals:{level1:refs,level2},security:{flags,device_unbans:deviceUnban},activity:{timeline:timeline.slice(0,500),transactions:presentTx,withdrawals,tasks,ads:creditedAds,promos,bot_verifications:botVerify,task_visits:visits,giveaways,notifications,diagnostics:{ad_sessions:allAds}}}});
    }
'''
s=s[:a]+admin_code+s[b:]

# marker
insert_at=s.find("// === END WIENER VPS ROUTES V9 ===")
if insert_at>=0:
    s=s[:insert_at]+"// === WIENER VPS V12B ADMIN ADS ===\n"+s[insert_at:]
else:
    s += "\n// === WIENER VPS V12B ADMIN ADS ===\n"

p.write_text(s)
print('Installed WIENER VPS V12B ADMIN ADS')
