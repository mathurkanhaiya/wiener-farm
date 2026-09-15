from pathlib import Path

p=Path('/opt/wiener-backend/server.mjs')
s=p.read_text()
marker="\napp.use((_req,res)=>\n  res.status(404).json({ok:false,error:'route_not_enabled_yet'})\n);\n"
if 'WIENER VPS FINAL ROUTES V4' in s:
    print('Final routes already installed')
    raise SystemExit(0)
if marker not in s:
    raise SystemExit('ERROR: final insertion marker not found')

code=r'''
// === WIENER VPS FINAL ROUTES V4 ===

async function needAdminV4(id,perm=null){
  const a=await isAdmin(id);
  if(!a) throw new Error('admin_required');
  if(perm && !(a.role==='owner'||a.role==='admin'||a.permissions?.[perm]===true)) throw new Error('admin_forbidden');
  return a;
}

function safeSettingsV4(x){
  if(!x) return x;
  const y={...x};
  for(const k of ['telegram_webhook_secret','notification_cron_secret','adsgram_reward_secret_hash']) delete y[k];
  return y;
}

app.post('/functions/v1/wiener-admin-api',async(req,res)=>{
  try{
    const b=req.body||{}; const {id}=await edgeUser(b); const action=String(b.action||'');
    const actor=await needAdminV4(id);
    if(action==='admin_get'){
      const [settings,users,tasks,promos,withdrawals,audit,admins,notifications,total,active,newu,banned]=await Promise.all([
        pool.query(`select * from public.app_settings where id=true limit 1`),
        pool.query(`select telegram_id,username,first_name,balance,total_earned,total_ads,is_banned,ban_reason,created_at,last_active from public.users order by created_at desc limit 1000`),
        pool.query(`select * from public.tasks order by sort_order`),
        pool.query(`select * from public.promo_codes order by created_at desc limit 500`),
        pool.query(`select * from public.withdrawals order by created_at desc limit 500`),
        pool.query(`select * from public.audit_logs order by created_at desc limit 500`),
        pool.query(`select * from public.admins order by created_at`),
        pool.query(`select event_type,status,created_at from public.notification_log order by created_at desc limit 100`),
        pool.query(`select count(*)::int c from public.users`),
        pool.query(`select count(*)::int c from public.users where last_active>=now()-interval '24 hours'`),
        pool.query(`select count(*)::int c from public.users where created_at>=now()-interval '24 hours'`),
        pool.query(`select count(*)::int c from public.users where is_banned=true`)
      ]);
      return res.json({ok:true,data:{settings:safeSettingsV4(settings.rows[0]),users:users.rows,tasks:tasks.rows,promos:promos.rows,withdrawals:withdrawals.rows,audit:audit.rows,admins:admins.rows,notifications:notifications.rows,stats:{total_users:num(total.rows[0]?.c),active_24h:num(active.rows[0]?.c),new_24h:num(newu.rows[0]?.c),banned_users:num(banned.rows[0]?.c)}}});
    }
    if(action==='admin_user_search'){
      const q=String(b.query||'').trim().replace(/^@/,''); let r;
      if(!q) r=await pool.query(`select telegram_id,username,first_name,last_name,balance,total_earned,total_withdrawn,total_ads,referrals_count,active_referrals_count,is_banned,device_blocked,referral_active,created_at,last_active from public.users order by last_active desc limit 80`);
      else if(/^\d+$/.test(q)) r=await pool.query(`select telegram_id,username,first_name,last_name,balance,total_earned,total_withdrawn,total_ads,referrals_count,active_referrals_count,is_banned,device_blocked,referral_active,created_at,last_active from public.users where telegram_id=$1 or username ilike $2 or first_name ilike $2 order by last_active desc limit 80`,[num(q),`%${q}%`]);
      else r=await pool.query(`select telegram_id,username,first_name,last_name,balance,total_earned,total_withdrawn,total_ads,referrals_count,active_referrals_count,is_banned,device_blocked,referral_active,created_at,last_active from public.users where username ilike $1 or first_name ilike $1 or last_name ilike $1 order by last_active desc limit 80`,[`%${q}%`]);
      return res.json({ok:true,data:{users:r.rows}});
    }
    if(action==='admin_user_inspect'){
      const uid=num(b.telegram_id); if(!uid) throw new Error('invalid_user');
      const [u,refs,flags,tx,w,tasks,ads,tads,adsg]=await Promise.all([
        pool.query(`select * from public.users where telegram_id=$1 limit 1`,[uid]),
        pool.query(`select telegram_id,username,first_name,referral_active,referral_reward_eligible,referral_ineligible_reason,total_ads,created_at,last_active,is_banned,device_blocked from public.users where referred_by=$1 order by created_at desc limit 500`,[uid]),
        pool.query(`select * from public.referral_abuse_flags where telegram_id=$1 or related_telegram_id=$1 order by created_at desc limit 200`,[uid]),
        pool.query(`select * from public.transactions where telegram_id=$1 order by created_at desc limit 300`,[uid]),
        pool.query(`select * from public.withdrawals where telegram_id=$1 order by created_at desc limit 100`,[uid]),
        pool.query(`select tc.*,t.title,t.category,t.task_type,t.verification from public.task_completions tc left join public.tasks t on t.id=tc.task_id where tc.telegram_id=$1 order by tc.created_at desc limit 200`,[uid]),
        pool.query(`select * from public.ad_sessions where telegram_id=$1 order by started_at desc limit 200`,[uid]),
        pool.query(`select * from public.tads_ad_sessions where telegram_id=$1 order by started_at desc limit 200`,[uid]),
        pool.query(`select * from public.adsgram_task_sessions where telegram_id=$1 order by created_at desc limit 100`,[uid])
      ]);
      if(!u.rows[0]) throw new Error('user_not_found');
      const allAds=[...ads.rows,...tads.rows,...adsg.rows];
      return res.json({ok:true,data:{user:u.rows[0],summary:{direct_referrals:refs.rows.length,valid_referrals:refs.rows.filter(x=>x.referral_active||x.referral_reward_eligible).length,invalid_referrals:refs.rows.filter(x=>!x.referral_active&&!x.referral_reward_eligible).length,tasks_completed:tasks.rows.length,tracked_ads:allAds.length,withdrawals:w.rows.length,transactions:tx.rows.length,abuse_flags:flags.rows.length},referrals:{level1:refs.rows,level2:[]},security:{flags:flags.rows,device_unbans:[]},activity:{timeline:[],transactions:tx.rows,withdrawals:w.rows,tasks:tasks.rows,ads:allAds,promos:[],bot_verifications:[],task_visits:[],giveaways:[],notifications:[],diagnostics:{ad_sessions:allAds}}}});
    }
    if(action==='admin_settings_save'){
      const x={...(b.settings||{})}; for(const k of ['id','created_at','telegram_webhook_secret','notification_cron_secret','adsgram_reward_secret_hash']) delete x[k];
      const keys=Object.keys(x); if(!keys.length) return res.json({ok:true,data:safeSettingsV4((await pool.query(`select * from public.app_settings where id=true`)).rows[0])});
      const vals=keys.map(k=>x[k]); const set=keys.map((k,i)=>`"${k}"=$${i+1}`).join(',');
      const q=await pool.query(`update public.app_settings set ${set},updated_at=now() where id=true returning *`,vals); return res.json({ok:true,data:safeSettingsV4(q.rows[0])});
    }
    if(action==='admin_user_update'){
      const uid=num(b.telegram_id); if(!uid) throw new Error('invalid_user'); if(num(b.amount)!==0) await rpc('admin_adjust_balance',[id,uid,num(b.amount),String(b.reason||'Admin adjustment')]);
      if(typeof b.is_banned==='boolean') await pool.query(`update public.users set is_banned=$2,ban_reason=$3 where telegram_id=$1`,[uid,b.is_banned,b.ban_reason||null]);
      return res.json({ok:true,data:{ok:true}});
    }
    if(action==='admin_task_delete'){await pool.query(`delete from public.tasks where id=$1`,[b.id||b.task_id]);return res.json({ok:true,data:{ok:true}})}
    if(action==='admin_task_save'){
      const t=b.task||{}; const vals=[String(t.title||'').trim(),t.description||null,t.category||'official',t.task_type||'telegram',num(t.reward),t.url||null,t.telegram_chat_id||null,t.verification||'none',!!t.is_daily,t.enabled!==false,num(t.sort_order),t.expires_at||null];
      let q;if(t.id) q=await pool.query(`update public.tasks set title=$2,description=$3,category=$4,task_type=$5,reward=$6,url=$7,telegram_chat_id=$8,verification=$9,is_daily=$10,enabled=$11,sort_order=$12,expires_at=$13,updated_at=now() where id=$1 returning *`,[t.id,...vals]); else q=await pool.query(`insert into public.tasks(title,description,category,task_type,reward,url,telegram_chat_id,verification,is_daily,enabled,sort_order,expires_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning *`,vals);return res.json({ok:true,data:q.rows[0]});
    }
    if(action==='admin_promo_delete'){await pool.query(`delete from public.promo_codes where code=$1`,[String(b.code||'').toUpperCase()]);return res.json({ok:true,data:{ok:true}})}
    if(action==='admin_promo_save'){
      const x=b.promo||{},code=String(x.code||'').trim().toUpperCase(),reward=num(x.reward),type=['wiener','treasury_point','treasury_key'].includes(String(x.reward_type||''))?String(x.reward_type):'wiener'; if(code.length<4)throw new Error('promo_code_too_short');if(reward<=0)throw new Error('invalid_promo_reward');
      const q=await pool.query(`insert into public.promo_codes(code,reward,reward_type,max_claims,expires_at,enabled,created_by,note) values($1,$2,$3,$4,$5,$6,$7,$8) on conflict(code) do update set reward=excluded.reward,reward_type=excluded.reward_type,max_claims=excluded.max_claims,expires_at=excluded.expires_at,enabled=excluded.enabled,note=excluded.note returning *`,[code,reward,type,x.max_claims===''?null:x.max_claims,x.expires_at||null,x.enabled!==false,id,x.note||null]);return res.json({ok:true,data:q.rows[0]});
    }
    if(action==='admin_admin_save'){
      if(actor.role!=='owner') throw new Error('owner_required'); const uid=num(b.telegram_id); if(!uid)throw new Error('invalid_admin'); const role=['owner','admin','moderator'].includes(String(b.role))?String(b.role):'admin';
      const q=await pool.query(`insert into public.admins(telegram_id,role,permissions,enabled) values($1,$2,$3::jsonb,$4) on conflict(telegram_id) do update set role=excluded.role,permissions=excluded.permissions,enabled=excluded.enabled returning *`,[uid,role,JSON.stringify(b.permissions||{}),b.enabled!==false]);return res.json({ok:true,data:q.rows[0]});
    }
    if(action==='admin_admin_delete'){
      if(actor.role!=='owner')throw new Error('owner_required');const uid=num(b.telegram_id);if(uid===id)throw new Error('cannot_remove_self');const q=await pool.query(`select role from public.admins where telegram_id=$1`,[uid]);if(q.rows[0]?.role==='owner')throw new Error('cannot_remove_owner');await pool.query(`delete from public.admins where telegram_id=$1`,[uid]);return res.json({ok:true,data:{ok:true}});
    }
    throw new Error('unsupported_action');
  }catch(e){return edgeFail(res,e)}
});

async function ambassadorAdminV4(id){const a=await isAdmin(id);return !!a&&(a.role==='owner'||a.role==='admin'||a.permissions?.ambassadors===true)}
async function ambassadorCfgV4(){return (await pool.query(`select * from public.ambassador_settings where id=true limit 1`)).rows[0]}
function ambUnameV4(v){let x=String(v||'').trim().replace(/^https?:\/\/(?:www\.)?t\.me\//i,'').split(/[/?#]/)[0].replace(/^@/,'');if(!/^[A-Za-z0-9_]{5,32}$/.test(x))throw new Error('invalid_channel_username');return '@'+x}
async function verifyAmbChannelV4(id,target){const c=await ambassadorCfgV4(),ref=ambUnameV4(target),chat=await telegramApi('getChat',{chat_id:ref});if(chat.type!=='channel')throw new Error('target_is_not_channel');if(!chat.username)throw new Error('public_channel_required');const me=await telegramApi('getMe',{}),applicant=await telegramApi('getChatMember',{chat_id:chat.id,user_id:id});if(!['creator','administrator'].includes(applicant?.status))throw new Error('you_must_be_channel_admin');const bm=await telegramApi('getChatMember',{chat_id:chat.id,user_id:me.id});if(!['creator','administrator'].includes(bm?.status))throw new Error('add_wiener_bot_as_admin');if(bm.status==='administrator'&&bm.can_post_messages!==true)throw new Error('bot_needs_post_permission');const count=num(await telegramApi('getChatMemberCount',{chat_id:chat.id}));const used=await pool.query(`select telegram_id from public.ambassadors where channel_id=$1 and telegram_id<>$2 limit 1`,[chat.id,id]);if(used.rows.length)throw new Error('channel_already_connected');if(count<num(c.min_subscribers))throw new Error(`minimum_${c.min_subscribers}_subscribers_required`);return{channel_id:num(chat.id),channel_username:'@'+chat.username,channel_title:String(chat.title||chat.username),subscriber_count:count,applicant_role:applicant.status,bot_is_admin:true,bot_can_post:true,verified_at:new Date().toISOString(),last_channel_check_at:new Date().toISOString()}}

app.post('/functions/v1/wiener-ambassador',async(req,res)=>{
 try{const b=req.body||{}, {id}=await edgeUser(b), a=String(b.action||'');
  if(a==='overview'){const c=await ambassadorCfgV4();const q=await pool.query(`select * from public.ambassadors where telegram_id=$1 limit 1`,[id]);const amb=q.rows[0]||null;let promos=[],withdrawals=[];if(amb){promos=(await pool.query(`select * from public.ambassador_promos where ambassador_id=$1 order by created_at desc limit 30`,[amb.id])).rows;withdrawals=(await pool.query(`select * from public.ambassador_withdrawals where ambassador_id=$1 order by requested_at desc limit 20`,[amb.id])).rows}return res.json({ok:true,data:{settings:c,ambassador:amb,promos,withdrawals,week_claims:0,weekly_rank:null,leaderboard:[]}})}
  if(a==='verify_channel'){const v=await verifyAmbChannelV4(id,b.channel);const old=(await pool.query(`select * from public.ambassadors where telegram_id=$1`,[id])).rows[0];const status=old&&['approved','active'].includes(old.status)&&num(old.channel_id)===v.channel_id?old.status:'draft';const q=await pool.query(`insert into public.ambassadors(telegram_id,channel_id,channel_username,channel_title,subscriber_count,applicant_role,bot_is_admin,bot_can_post,verified_at,last_channel_check_at,status,rejection_reason,updated_at) values($1,$2,$3,$4,$5,$6,true,true,$7,$8,$9,null,now()) on conflict(telegram_id) do update set channel_id=excluded.channel_id,channel_username=excluded.channel_username,channel_title=excluded.channel_title,subscriber_count=excluded.subscriber_count,applicant_role=excluded.applicant_role,bot_is_admin=true,bot_can_post=true,verified_at=excluded.verified_at,last_channel_check_at=excluded.last_channel_check_at,status=excluded.status,rejection_reason=null,updated_at=now() returning *`,[id,v.channel_id,v.channel_username,v.channel_title,v.subscriber_count,v.applicant_role,v.verified_at,v.last_channel_check_at,status]);return res.json({ok:true,data:q.rows[0]})}
  if(a==='refresh_channel'){const amb=(await pool.query(`select * from public.ambassadors where telegram_id=$1`,[id])).rows[0];if(!amb?.channel_username)throw new Error('channel_not_connected');const v=await verifyAmbChannelV4(id,amb.channel_username);await pool.query(`update public.ambassadors set subscriber_count=$2,bot_is_admin=true,bot_can_post=true,verified_at=$3,last_channel_check_at=$3,updated_at=now(),below_min_since=null where id=$1`,[amb.id,v.subscriber_count,v.verified_at]);return res.json({ok:true,data:v})}
  if(a==='apply'){const c=await ambassadorCfgV4(),amb=(await pool.query(`select * from public.ambassadors where telegram_id=$1`,[id])).rows[0];if(!amb)throw new Error('verify_channel_first');if(num(amb.subscriber_count)<num(c.min_subscribers)||!amb.bot_is_admin||!amb.bot_can_post)throw new Error('channel_not_eligible');const q=await pool.query(`update public.ambassadors set status='pending',applied_at=now(),rejection_reason=null,updated_at=now() where id=$1 returning *`,[amb.id]);return res.json({ok:true,data:q.rows[0]})}
  if(a==='withdraw'){const data=await rpc('request_ambassador_withdrawal',[id,num(b.amount),String(b.wallet||'').trim()]);return res.json({ok:true,data:{id:data}})}
  if(!await ambassadorAdminV4(id))throw new Error('admin_forbidden');
  if(a==='admin_boot'){const [apps,w,bcasts]=await Promise.all([pool.query(`select * from public.ambassadors order by created_at desc limit 100`),pool.query(`select aw.*,a.channel_username,a.channel_title from public.ambassador_withdrawals aw left join public.ambassadors a on a.id=aw.ambassador_id order by aw.requested_at desc limit 100`),pool.query(`select * from public.ambassador_broadcasts order by created_at desc limit 20`)]);return res.json({ok:true,data:{applications:apps.rows,withdrawals:w.rows,broadcasts:bcasts.rows,settings:await ambassadorCfgV4()}})}
  if(a==='admin_status'){const st=String(b.status||'');if(!['active','approved','suspended','rejected'].includes(st))throw new Error('invalid_status');const q=await pool.query(`update public.ambassadors set status=$2,rejection_reason=$3,approved_at=case when $2 in ('active','approved') then now() else approved_at end,approved_by=case when $2 in ('active','approved') then $4 else approved_by end,updated_at=now() where id=$1 returning *`,[String(b.ambassador_id||''),st,st==='rejected'?String(b.reason||'Application rejected').slice(0,300):null,id]);return res.json({ok:true,data:q.rows[0]})}
  if(a==='admin_withdraw_paid'){await rpc('pay_ambassador_withdrawal',[String(b.withdrawal_id||''),id,String(b.tx_hash||'')]);return res.json({ok:true,data:true})}
  if(a==='admin_withdraw_reject'){await rpc('reject_ambassador_withdrawal',[String(b.withdrawal_id||''),id,String(b.reason||'Rejected')]);return res.json({ok:true,data:true})}
  if(a==='admin_settings'){const allowed=['enabled','min_subscribers','commission_per_valid_claim_usdt','min_withdraw_usdt','weekly_prize_pool_usdt','subscriber_grace_days'];const keys=allowed.filter(k=>b[k]!==undefined);if(keys.length){const vals=keys.map(k=>b[k]);await pool.query(`update public.ambassador_settings set ${keys.map((k,i)=>`"${k}"=$${i+1}`).join(',')},updated_at=now() where id=true`,vals)}return res.json({ok:true,data:await ambassadorCfgV4()})}
  throw new Error('unknown_action');
 }catch(e){return edgeFail(res,e)}
});

app.post('/functions/v1/wiener-ambassador-board',async(req,res)=>{try{const b=req.body||{}, {id}=await edgeUser(b);await rpc('settle_ambassador_weekly_rounds',[]).catch(()=>null);const c=await ambassadorCfgV4();const start=c.weekly_round_start_at||new Date().toISOString(),end=c.weekly_round_end_at||new Date(Date.now()+7*86400000).toISOString();const q=await pool.query(`select a.id,a.telegram_id,a.channel_username,a.channel_title,u.username,u.first_name,u.last_name,count(ac.id)::int claims,max(ac.created_at) reached_at from public.ambassadors a join public.users u on u.telegram_id=a.telegram_id left join public.ambassador_commissions ac on ac.ambassador_id=a.id and ac.status='credited' and ac.created_at between $1 and $2 where a.status in ('active','approved') group by a.id,u.username,u.first_name,u.last_name order by claims desc,reached_at asc nulls last limit 25`,[start,end]);const min=num(c.weekly_min_valid_claims||5),prizes=[num(c.weekly_rank_1_usdt),num(c.weekly_rank_2_usdt),num(c.weekly_rank_3_usdt)];const leaderboard=q.rows.map((x,i)=>({...x,rank:i+1,eligible:num(x.claims)>=min,prize_usdt:i<3&&num(x.claims)>=min?prizes[i]:0,user:x.username?'@'+x.username:[x.first_name,x.last_name].filter(Boolean).join(' ')||`UID ${x.telegram_id}`}));const me=leaderboard.find(x=>num(x.telegram_id)===id);return res.json({ok:true,data:{weekly_prize_pool_usdt:num(c.weekly_prize_pool_usdt),weekly_min_valid_claims:min,prizes_usdt:prizes,round_start_at:start,round_end_at:end,leaderboard,my_rank:me?.rank||null,my_claims:num(me?.claims),my_eligible:!!me?.eligible,history:[]}})}catch(e){return edgeFail(res,e)}});

app.post('/functions/v1/wiener-ambassador-check-all',async(req,res)=>{try{const b=req.body||{}, {id}=await edgeUser(b);if(!await ambassadorAdminV4(id))throw new Error('admin_forbidden');const me=await telegramApi('getMe',{}),rows=(await pool.query(`select * from public.ambassadors where channel_id is not null order by created_at`)).rows,results=[];let connected=0,failed=0;for(const a of rows){let ok=false,reason=null,count=num(a.subscriber_count),title=a.channel_title,username=a.channel_username,botAdmin=false,botCanPost=false;try{const chat=await telegramApi('getChat',{chat_id:a.channel_id}),bm=await telegramApi('getChatMember',{chat_id:a.channel_id,user_id:me.id});title=String(chat.title||title);username=chat.username?'@'+chat.username:username;botAdmin=['creator','administrator'].includes(bm?.status);botCanPost=bm?.status==='creator'||(bm?.status==='administrator'&&bm.can_post_messages===true);count=num(await telegramApi('getChatMemberCount',{chat_id:a.channel_id}));ok=chat.type==='channel'&&botAdmin&&botCanPost}catch(e){reason=String(e.message||e).slice(0,160)}if(ok)connected++;else failed++;await pool.query(`update public.ambassadors set channel_title=$2,channel_username=$3,subscriber_count=$4,bot_is_admin=$5,bot_can_post=$6,last_channel_check_at=now(),updated_at=now(),verified_at=case when $7 then now() else verified_at end where id=$1`,[a.id,title,username,count,botAdmin,botCanPost,ok]);results.push({id:a.id,telegram_id:a.telegram_id,channel_id:a.channel_id,channel_username:username,channel_title:title,status:a.status,subscriber_count:count,connected:ok,bot_is_admin:botAdmin,bot_can_post:botCanPost,reason})}return res.json({ok:true,data:{checked:results.length,connected,failed,checked_at:new Date().toISOString(),results}})}catch(e){return edgeFail(res,e)}});

app.post('/functions/v1/wiener-ambassador-publish',async(req,res)=>{try{const b=req.body||{}, {id}=await edgeUser(b);if(String(b.action||'publish')!=='publish')throw new Error('unknown_action');if(!await ambassadorAdminV4(id))throw new Error('admin_forbidden');/* keep provider-side posting on Supabase until bot broadcast worker is ported */return res.status(503).json({ok:false,error:'vps_publish_worker_pending'})}catch(e){return edgeFail(res,e)}});

let tonCorePromise=null; async function tonCore(){if(!tonCorePromise)tonCorePromise=import('@ton/core');return tonCorePromise}
async function normalizeTonV4(v){const {Address}=await tonCore();let x=String(v||'').trim();if(/^[0-9a-fA-F]{64}$/.test(x))x='0:'+x;let a;try{a=Address.parse(x)}catch{throw new Error('invalid_ton_wallet')}return{raw:a.toRawString().toLowerCase(),friendly:a.toString({bounceable:false,testOnly:false,urlSafe:true})}}
let tonPriceCache=null;async function tonUsdV4(force=false){if(!force&&tonPriceCache&&Date.now()-tonPriceCache.at<20000)return tonPriceCache.price;const r=await fetch('https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd');if(!r.ok)throw new Error('ton_price_unavailable');const j=await r.json(),price=num(j?.['the-open-network']?.usd);if(price<=0.05||price>1000)throw new Error('ton_price_unavailable');tonPriceCache={price,at:Date.now()};return price}
app.post('/functions/v1/wiener-ton-wallet',async(req,res)=>{try{const b=req.body||{}, {id}=await edgeUser(b),a=String(b.action||'status');if(a==='status'){const [w,m,s]=await Promise.all([pool.query(`select telegram_id,address,address_key,provider,connected_at,updated_at from public.user_wallets where telegram_id=$1 and network='TON' limit 1`,[id]),pool.query(`select * from public.withdrawal_methods where method_key='gram_ton' limit 1`),pool.query(`select token_per_usdt from public.app_settings where id=true`)]);let price=null;try{price=await tonUsdV4()}catch{}return res.json({ok:true,data:{wallet:w.rows[0]?{address:w.rows[0].address,provider:w.rows[0].provider,connected_at:w.rows[0].connected_at,updated_at:w.rows[0].updated_at}:null,method:m.rows[0]||null,wiener_per_usdt:num(s.rows[0]?.token_per_usdt)||15000,ton_usd:price,price_source:'CoinGecko'}})}if(a==='bind'){const x=await normalizeTonV4(b.address),provider=String(b.provider||'TON Connect').trim().slice(0,80);const used=await pool.query(`select telegram_id from public.user_wallets where network='TON' and telegram_id<>$1 and (lower(address_key)=$2 or address=$3) limit 1`,[id,x.raw,x.friendly]);if(used.rows.length)throw new Error('ton_wallet_already_used');const q=await pool.query(`insert into public.user_wallets(telegram_id,network,address,address_key,provider,connected_at,updated_at) values($1,'TON',$2,$3,$4,now(),now()) on conflict(telegram_id,network) do update set address=excluded.address,address_key=excluded.address_key,provider=excluded.provider,connected_at=now(),updated_at=now() returning address,provider,connected_at,updated_at`,[id,x.friendly,x.raw,provider]);return res.json({ok:true,data:q.rows[0]})}if(a==='unbind'){await pool.query(`delete from public.user_wallets where telegram_id=$1 and network='TON'`,[id]);return res.json({ok:true,data:{disconnected:true}})}if(a==='withdraw'){const amount=num(b.amount_wiener);if(amount<=0)throw new Error('invalid_wiener_amount');const [m,w]=await Promise.all([pool.query(`select * from public.withdrawal_methods where method_key='gram_ton'`),pool.query(`select * from public.user_wallets where telegram_id=$1 and network='TON'`,[id])]);if(!m.rows[0]?.enabled)throw new Error('withdraw_method_disabled');if(!w.rows[0]?.address)throw new Error('ton_wallet_required');const price=await tonUsdV4(true),gross=Number(((amount/15000)/price).toFixed(8));if(gross<num(m.rows[0].minimum_usdt))throw new Error('below_minimum');if(gross<=num(m.rows[0].fee_usdt))throw new Error('amount_below_fee');const data=await rpc('request_ton_withdrawal',[id,amount,gross,price,w.rows[0].address]);const row=(await pool.query(`select * from public.withdrawals where id=$1`,[data.id])).rows[0];return res.json({ok:true,data:{...data,withdrawal:row,price_source:'CoinGecko'}})}if(a==='admin_save_gram'){await needAdminV4(id,'withdrawals');const enabled=!!b.enabled,minimum=num(b.minimum),fee=num(b.fee);if(minimum<=0||fee<0||minimum<=fee)throw new Error('invalid_method_limits');const q=await pool.query(`update public.withdrawal_methods set enabled=$2,minimum_usdt=$3,fee_usdt=$4,updated_at=now(),label='Gram (TON)',network='TON' where method_key='gram_ton' returning *`,['gram_ton',enabled,minimum,fee]);return res.json({ok:true,data:{method:q.rows[0]}})}throw new Error('unknown_action')}catch(e){return edgeFail(res,e)}});

// === END WIENER VPS FINAL ROUTES V4 ===
'''

s=s.replace(marker,'\n'+code+'\n'+marker,1)
p.write_text(s)
print('Installed WIENER VPS FINAL ROUTES V4')
