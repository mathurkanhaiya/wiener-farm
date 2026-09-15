from pathlib import Path

p=Path('/opt/wiener-backend/server.mjs')
s=p.read_text()
TAG='WIENER ADVANCED BROADCAST CENTER V78'
if TAG in s:
    print('V78 advanced broadcast center already installed')
    raise SystemExit(0)
if 'WIENER VPS FULL BOT PARITY V18' not in s:
    raise SystemExit('ERROR: V18 bot parity anchor missing')
if 'WIENER BROADCAST MEDIA V57' not in s:
    raise SystemExit('ERROR: V57 media broadcast anchor missing')

insert_anchor='async function handleBotFullV18(up,uid,text,m,q){'
if insert_anchor not in s:
    raise SystemExit('ERROR: V18 handler anchor missing')

code=r'''

// === WIENER ADVANCED BROADCAST CENTER V78 ===
// Admin-only broadcast orchestration. Economy, payouts and user flows are untouched.
const bc78Workers=new Set();
const bc78Sleep=ms=>new Promise(r=>setTimeout(r,ms));
const bc78Pct=(a,b)=>b?((Number(a||0)/Number(b))*100).toFixed(1):'0.0';
const bc78ShortId=id=>String(id||'').split('-')[0].toUpperCase();

async function bc78Session(id){return (await pool.query(`select * from public.admin_broadcast_sessions where admin_id=$1 limit 1`,[id])).rows[0]||null}
async function bc78SetSession(id,patch={}){
  await pool.query(`insert into public.admin_broadcast_sessions(admin_id,step,draft_message,updated_at) values($1,'bc78_audience',null,now()) on conflict(admin_id) do nothing`,[id]);
  const allowed=['step','draft_message','source_chat_id','source_message_id','media_kind','audience_v78','filter_v78','broadcast_id_v78','button_text_v78'];
  for(const [k,v] of Object.entries(patch)){if(allowed.includes(k))await pool.query(`update public.admin_broadcast_sessions set ${k}=$2,updated_at=now() where admin_id=$1`,[id,v])}
  return bc78Session(id);
}
async function bc78ClearSession(id){await pool.query(`update public.admin_broadcast_sessions set step='idle',draft_message=null,source_chat_id=null,source_message_id=null,media_kind=null,audience_v78='all',filter_v78=null,broadcast_id_v78=null,button_text_v78=null,updated_at=now() where admin_id=$1`,[id])}

async function bc78Stats(){
  const [u,g,c,f]=await Promise.all([
    pool.query(`select count(*)::int c from public.users where is_banned=false`),
    pool.query(`select count(*)::int c from public.bot_chats where active=true and can_post=true and chat_type in ('group','supergroup')`),
    pool.query(`select count(*)::int c from public.bot_chats where active=true and can_post=true and chat_type='channel'`),
    pool.query(`select count(distinct telegram_id)::int c from public.admin_broadcast_deliveries where status='failed' and updated_at>=now()-interval '30 days'`)
  ]);
  return{private:u.rows[0]?.c||0,groups:g.rows[0]?.c||0,channels:c.rows[0]?.c||0,failed30:f.rows[0]?.c||0}
}
function bc78AudienceLabel(a,f){
  if(f==='active1')return 'Private · active 24h';if(f==='active7')return 'Private · active 7d';if(f==='active30')return 'Private · active 30d';
  if(f==='ads_today')return 'Private · watched ads today';if(f==='referrals')return 'Private · has referrals';if(f==='balance1000')return 'Private · balance ≥1,000';if(f==='inactive7')return 'Private · inactive 7d+';if(String(f||'').startsWith('uid:'))return `Private · UID ${String(f).slice(4)}`;
  return a==='private'?'Private users':a==='groups'?'Groups':a==='channels'?'Channels':'All reachable';
}
async function bc78Targets(a='all',f=null){
  const out=[],seen=new Set();
  const add=(id,kind)=>{id=Number(id);if(!id||seen.has(id))return;seen.add(id);out.push({id,kind})};
  if(a==='all'||a==='private'||a==='custom'){
    let where=`is_banned=false`,vals=[];
    if(f==='active1')where+=` and last_active>=now()-interval '1 day'`;
    else if(f==='active7')where+=` and last_active>=now()-interval '7 days'`;
    else if(f==='active30')where+=` and last_active>=now()-interval '30 days'`;
    else if(f==='ads_today')where+=` and ads_day=current_date and ads_watched_today>0`;
    else if(f==='referrals')where+=` and referrals_count>0`;
    else if(f==='balance1000')where+=` and balance>=1000`;
    else if(f==='inactive7')where+=` and (last_active is null or last_active<now()-interval '7 days')`;
    else if(String(f||'').startsWith('uid:')){vals=[Number(String(f).slice(4))];where+=` and telegram_id=$1`}
    const q=await pool.query(`select telegram_id from public.users where ${where}`,vals);for(const x of q.rows)add(x.telegram_id,'private');
  }
  if(a==='all'||a==='groups'){const q=await pool.query(`select chat_id,chat_type from public.bot_chats where active=true and can_post=true and chat_type in ('group','supergroup')`);for(const x of q.rows)add(x.chat_id,String(x.chat_type||'group'))}
  if(a==='all'||a==='channels'){const q=await pool.query(`select chat_id from public.bot_chats where active=true and can_post=true and chat_type='channel'`);for(const x of q.rows)add(x.chat_id,'channel')}
  return out;
}
function bc78Counts(targets){return{private:targets.filter(x=>x.kind==='private').length,groups:targets.filter(x=>['group','supergroup'].includes(x.kind)).length,channels:targets.filter(x=>x.kind==='channel').length,total:targets.length}}

function bc78Buttons(job){
  let b=[];try{b=Array.isArray(job?.buttons)?job.buttons:(typeof job?.buttons==='string'?JSON.parse(job.buttons):[])}catch{}
  if(!b.length)b=[{text:'🌭 OPEN WIENER FARM',url:'https://t.me/WienerDogeFarmBot/app'}];
  return{inline_keyboard:b.slice(0,8).map(x=>[{text:String(x.text||'OPEN').slice(0,64),url:String(x.url||'https://t.me/WienerDogeFarmBot/app')}])};
}
async function bc78CreateDraft(admin,{message=null,media_kind=null,source_chat_id=null,source_message_id=null}){
  await adm18(admin);
  const bs=await bc78Session(admin),aud=String(bs?.audience_v78||'all'),filter=bs?.filter_v78||null,targets=await bc78Targets(aud,filter),n=bc78Counts(targets);
  const hash=`v78:${admin}:${Date.now()}:${Math.random()}`;
  const br=(await pool.query(`insert into public.admin_broadcasts(admin_id,message,audience,status,total_targets,sent_count,failed_count,skipped_count,created_at,message_hash,media_kind,source_chat_id,source_message_id,private_targets,group_targets,channel_targets) values($1,$2,$3,'draft',$4,0,0,0,now(),encode(digest($5,'sha256'),'hex'),$6,$7,$8,$9,$10,$11) returning *`,[admin,message,aud,targets.length,hash,media_kind,source_chat_id,source_message_id,n.private,n.groups,n.channels])).rows[0];
  await pool.query(`insert into public.admin_broadcast_jobs_v78(broadcast_id,admin_id,state,audience,filter_key,media_kind,source_chat_id,source_message_id,buttons,created_at,updated_at) values($1,$2,'preparing',$3,$4,$5,$6,$7,'[]'::jsonb,now(),now())`,[br.id,admin,aud,filter,media_kind,source_chat_id,source_message_id]);
  for(const t of targets)await pool.query(`insert into public.admin_broadcast_deliveries_v78(broadcast_id,telegram_id,chat_type,status,attempts,updated_at) values($1,$2,$3,'pending',0,now()) on conflict(broadcast_id,telegram_id) do nothing`,[br.id,t.id,t.kind]);
  await bc78SetSession(admin,{step:'bc78_preview',draft_message:message,source_chat_id,source_message_id,media_kind,broadcast_id_v78:br.id});
  return br;
}
async function bc78Job(id){return (await pool.query(`select j.*,b.message,b.total_targets,b.sent_count,b.failed_count,b.skipped_count,b.private_targets,b.group_targets,b.channel_targets,b.created_at from public.admin_broadcast_jobs_v78 j join public.admin_broadcasts b on b.id=j.broadcast_id where j.broadcast_id=$1`,[id])).rows[0]||null}
async function bc78Latest(admin){return (await pool.query(`select j.*,b.message,b.total_targets,b.sent_count,b.failed_count,b.skipped_count,b.private_targets,b.group_targets,b.channel_targets,b.created_at from public.admin_broadcast_jobs_v78 j join public.admin_broadcasts b on b.id=j.broadcast_id where j.admin_id=$1 order by b.created_at desc limit 1`,[admin])).rows[0]||null}
async function bc78Progress(id){
  const q=(await pool.query(`select count(*)::int total,count(*) filter(where status='sent')::int sent,count(*) filter(where status='failed')::int failed,count(*) filter(where status='pending')::int pending,count(*) filter(where chat_type='private')::int private,count(*) filter(where chat_type in ('group','supergroup'))::int groups,count(*) filter(where chat_type='channel')::int channels from public.admin_broadcast_deliveries_v78 where broadcast_id=$1`,[id])).rows[0]||{};
  return Object.fromEntries(Object.entries(q).map(([k,v])=>[k,Number(v||0)]));
}
function bc78StatusText(job,p){return `📡 BROADCAST #${bc78ShortId(job.broadcast_id)}\n\nState: ${String(job.state||'—').toUpperCase()}\nAudience: ${bc78AudienceLabel(job.audience,job.filter_key)}\n\n👤 Private: ${p.private}\n💬 Groups: ${p.groups}\n📣 Channels: ${p.channels}\n\n🎯 Targets: ${p.total}\n✅ Sent: ${p.sent}\n❌ Failed: ${p.failed}\n⏳ Pending: ${p.pending}\n📊 Progress: ${bc78Pct(p.sent+p.failed,p.total)}%${job.scheduled_at?`\n🕒 Scheduled: ${when18(job.scheduled_at)}`:''}`}
function bc78ControlMarkup(job){
  const rows=[[cb18('🔄 REFRESH',`bc78:status:${job.broadcast_id}`)]];
  if(job.state==='sending')rows.push([cb18('⏸ PAUSE',`bc78:pause:${job.broadcast_id}`),cb18('⛔ STOP',`bc78:stop:${job.broadcast_id}`)]);
  if(job.state==='paused')rows.push([cb18('▶️ RESUME',`bc78:resume:${job.broadcast_id}`),cb18('⛔ STOP',`bc78:stop:${job.broadcast_id}`)]);
  if(job.state==='completed'&&Number(job.failed_count||0)>0)rows.push([cb18('🔁 RETRY FAILED',`bc78:retry:${job.broadcast_id}`)]);
  rows.push([cb18('📜 HISTORY','bc78:history'),cb18('🏠 CENTER','bc78:home')]);return kb18(rows)
}
async function bc78ShowStatus(admin,id=null,q=null){await adm18(admin);const job=id?await bc78Job(id):await bc78Latest(admin);if(!job){const x={text:'📡 No V78 broadcasts yet.',markup:kb18([[cb18('🏠 BROADCAST CENTER','bc78:home')]])};return q?edit18(q,x):safeTg18('sendMessage',{chat_id:admin,text:x.text,reply_markup:x.markup})}const p=await bc78Progress(job.broadcast_id),x={text:bc78StatusText(job,p),markup:bc78ControlMarkup({...job,...p})};return q?edit18(q,x):safeTg18('sendMessage',{chat_id:admin,text:x.text,reply_markup:x.markup})}

async function bc78Home(admin,q=null){
  await adm18(admin);const x=await bc78Stats(),text=`📣 ADVANCED BROADCAST CENTER\n\n👤 Private users: ${x.private}\n💬 Groups: ${x.groups}\n📣 Channels: ${x.channels}\n🎯 Reachable total: ${x.private+x.groups+x.channels}\n⚠️ Failed recipients (30d): ${x.failed30}\n\nChoose an audience:`;
  const markup=kb18([[cb18('🌐 ALL REACHABLE','bc78:aud:all')],[cb18('👤 PRIVATE USERS','bc78:aud:private')],[cb18('💬 GROUPS','bc78:aud:groups'),cb18('📣 CHANNELS','bc78:aud:channels')],[cb18('🎯 CUSTOM','bc78:custom')],[cb18('📡 STATUS','bc78:status:latest'),cb18('📜 HISTORY','bc78:history')],[cb18('🧹 CLEANUP','bc78:cleanup')]]);
  await bc78SetSession(admin,{step:'bc78_audience',audience_v78:'all',filter_v78:null,broadcast_id_v78:null});const card={text,markup};return q?edit18(q,card):safeTg18('sendMessage',{chat_id:admin,text,reply_markup:markup})
}
async function bc78Custom(admin,q){await adm18(admin);return edit18(q,{text:'🎯 CUSTOM AUDIENCE\n\nChoose a private-user filter:',markup:kb18([[cb18('⚡ ACTIVE 24H','bc78:flt:active1'),cb18('🔥 ACTIVE 7D','bc78:flt:active7')],[cb18('📅 ACTIVE 30D','bc78:flt:active30'),cb18('💤 INACTIVE 7D+','bc78:flt:inactive7')],[cb18('📺 WATCHED ADS TODAY','bc78:flt:ads_today')],[cb18('👥 HAS REFERRALS','bc78:flt:referrals')],[cb18('💰 BALANCE ≥ 1,000','bc78:flt:balance1000')],[cb18('🆔 SPECIFIC UID','bc78:flt:uid')],[cb18('◀️ BACK','bc78:home')]])})}
async function bc78AskMessage(admin,a,f,q){await bc78SetSession(admin,{step:'awaiting_message',audience_v78:a,filter_v78:f||null,broadcast_id_v78:null});const t=await bc78Targets(a,f),n=bc78Counts(t);return edit18(q,{text:`✅ Audience selected\n${bc78AudienceLabel(a,f)}\n\n👤 ${n.private} private · 💬 ${n.groups} groups · 📣 ${n.channels} channels\n🎯 ${n.total} total targets\n\nNow send ONE item:\n• Text\n• Photo\n• Video\n• GIF\n• Sticker\n• Document\n\nNothing sends until you confirm.`,markup:kb18([[cb18('❌ CANCEL','bc78:cancel')]])})}

async function bc78ShowPreview(admin,id,q=null){
  const job=await bc78Job(id);if(!job)throw new Error('broadcast_not_found');const p=await bc78Progress(id),buttons=Array.isArray(job.buttons)?job.buttons:[];
  if(job.media_kind&&job.source_chat_id&&job.source_message_id)await tgV10('copyMessage',{chat_id:admin,from_chat_id:Number(job.source_chat_id),message_id:Number(job.source_message_id),reply_markup:bc78Buttons(job)}).catch(()=>null);
  else if(job.message)await safeTg18('sendMessage',{chat_id:admin,text:`📝 MESSAGE PREVIEW\n\n${job.message}`,reply_markup:bc78Buttons(job),disable_web_page_preview:true});
  const text=`📣 BROADCAST PREVIEW #${bc78ShortId(id)}\n\nAudience: ${bc78AudienceLabel(job.audience,job.filter_key)}\n👤 Private: ${p.private}\n💬 Groups: ${p.groups}\n📣 Channels: ${p.channels}\n🎯 Total: ${p.total}\n🔘 Custom buttons: ${buttons.length}\n\nNothing has been sent yet.`;
  const markup=kb18([[cb18('✅ SEND NOW',`bc78:send:${id}`)],[cb18('➕ ADD URL BUTTON',`bc78:addbtn:${id}`)],[cb18('🕒 SCHEDULE',`bc78:schedule:${id}`)],[cb18('🧪 TEST TO ME',`bc78:test:${id}`)],[cb18('❌ CANCEL',`bc78:cancelid:${id}`)]]);const card={text,markup};return q?edit18(q,card):safeTg18('sendMessage',{chat_id:admin,text,reply_markup:markup})
}
async function broadcastText78(admin,text){const br=await bc78CreateDraft(admin,{message:text});await bc78ShowPreview(admin,br.id)}
function bc78MediaKind(m){if(Array.isArray(m?.photo)&&m.photo.length)return'photo';if(m?.video)return'video';if(m?.animation)return'animation';if(m?.sticker)return'sticker';if(m?.document)return'document';return null}
async function broadcastMedia78(admin,m){await adm18(admin);const kind=bc78MediaKind(m);if(!kind)return false;if(m.media_group_id){await safeTg18('sendMessage',{chat_id:admin,text:'⚠️ Send one media item at a time.'});return true}const br=await bc78CreateDraft(admin,{message:m.caption||null,media_kind:kind,source_chat_id:Number(m.chat.id),source_message_id:Number(m.message_id)});await bc78ShowPreview(admin,br.id);return true}

async function bc78MirrorDelivery(id,row,status,error=null,messageId=null){
  const u=await pool.query(`update public.admin_broadcast_deliveries set status=$3,error=$4,telegram_message_id=$5,updated_at=now(),chat_type=$6,attempts=coalesce(attempts,0)+1,last_attempt_at=now() where broadcast_id=$1 and telegram_id=$2`,[id,row.telegram_id,status,error,messageId,row.chat_type]);
  if(!u.rowCount)await pool.query(`insert into public.admin_broadcast_deliveries(broadcast_id,telegram_id,status,error,telegram_message_id,updated_at,chat_type,attempts,last_attempt_at) values($1,$2,$3,$4,$5,now(),$6,1,now())`,[id,row.telegram_id,status,error,messageId,row.chat_type]);
}
async function bc78SyncCounts(id){const p=await bc78Progress(id);await pool.query(`update public.admin_broadcasts set sent_count=$2,failed_count=$3,skipped_count=0 where id=$1`,[id,p.sent,p.failed]);return p}
async function bc78Worker(id){
  if(bc78Workers.has(String(id)))return;bc78Workers.add(String(id));
  try{
    let job=await bc78Job(id);if(!job)return;
    await pool.query(`update public.admin_broadcast_jobs_v78 set state='sending',started_at=coalesce(started_at,now()),updated_at=now() where broadcast_id=$1 and state in ('preparing','scheduled','paused','sending','completed')`,[id]);
    await pool.query(`update public.admin_broadcasts set started_at=coalesce(started_at,now()),completed_at=null where id=$1`,[id]);
    while(true){
      job=await bc78Job(id);if(!job||job.state==='cancelled'||job.state==='failed')break;
      if(job.state==='paused'){await bc78Sleep(1000);continue}
      const row=(await pool.query(`select * from public.admin_broadcast_deliveries_v78 where broadcast_id=$1 and status='pending' order by telegram_id limit 1`,[id])).rows[0];
      if(!row)break;
      try{
        let r;if(job.media_kind)r=await tgV10('copyMessage',{chat_id:Number(row.telegram_id),from_chat_id:Number(job.source_chat_id),message_id:Number(job.source_message_id),reply_markup:bc78Buttons(job)});
        else r=await tgV10('sendMessage',{chat_id:Number(row.telegram_id),text:job.message,disable_web_page_preview:true,reply_markup:bc78Buttons(job)});
        const mid=Number(r?.message_id||0)||null;await pool.query(`update public.admin_broadcast_deliveries_v78 set status='sent',attempts=attempts+1,error=null,telegram_message_id=$3,last_attempt_at=now(),updated_at=now() where broadcast_id=$1 and telegram_id=$2`,[id,row.telegram_id,mid]);await bc78MirrorDelivery(id,row,'sent',null,mid);
      }catch(e){const er=String(e?.message||e).slice(0,900);await pool.query(`update public.admin_broadcast_deliveries_v78 set status='failed',attempts=attempts+1,error=$3,last_attempt_at=now(),updated_at=now() where broadcast_id=$1 and telegram_id=$2`,[id,row.telegram_id,er]);await bc78MirrorDelivery(id,row,'failed',er,null).catch(()=>null)}
      await bc78SyncCounts(id);await sleepV10(45);
    }
    job=await bc78Job(id);if(job&&job.state==='sending'){
      const p=await bc78SyncCounts(id);await pool.query(`update public.admin_broadcast_jobs_v78 set state='completed',completed_at=now(),updated_at=now() where broadcast_id=$1`,[id]);await pool.query(`update public.admin_broadcasts set status='completed',completed_at=now(),sent_count=$2,failed_count=$3 where id=$1`,[id,p.sent,p.failed]);await safeTg18('sendMessage',{chat_id:Number(job.admin_id),text:`✅ Broadcast #${bc78ShortId(id)} completed\n\n🎯 ${p.total} targets\n✅ ${p.sent} sent\n❌ ${p.failed} failed\n📊 ${bc78Pct(p.sent+p.failed,p.total)}% processed`,reply_markup:kb18([[cb18('📡 VIEW STATUS',`bc78:status:${id}`)],[cb18('🔁 RETRY FAILED',`bc78:retry:${id}`)]])}).catch(()=>null)
    }
  }catch(e){console.error('v78_broadcast_worker',String(e?.message||e));await pool.query(`update public.admin_broadcast_jobs_v78 set state='failed',updated_at=now() where broadcast_id=$1`,[id]).catch(()=>null)}finally{bc78Workers.delete(String(id))}
}
async function bc78Start(id){await pool.query(`update public.admin_broadcast_jobs_v78 set state='sending',scheduled_at=null,updated_at=now() where broadcast_id=$1`,[id]);void bc78Worker(id)}
async function bc78Pause(id){await pool.query(`update public.admin_broadcast_jobs_v78 set state='paused',paused_at=now(),updated_at=now() where broadcast_id=$1 and state='sending'`,[id])}
async function bc78Resume(id){await pool.query(`update public.admin_broadcast_jobs_v78 set state='sending',paused_at=null,updated_at=now() where broadcast_id=$1 and state='paused'`,[id]);void bc78Worker(id)}
async function bc78Stop(id){await pool.query(`update public.admin_broadcast_jobs_v78 set state='cancelled',completed_at=now(),updated_at=now() where broadcast_id=$1`,[id]);await pool.query(`update public.admin_broadcasts set status='cancelled',completed_at=now() where id=$1`,[id])}
async function bc78Retry(id){await pool.query(`update public.admin_broadcast_deliveries_v78 set status='pending',error=null,updated_at=now() where broadcast_id=$1 and status='failed'`,[id]);await pool.query(`update public.admin_broadcast_jobs_v78 set state='sending',completed_at=null,updated_at=now() where broadcast_id=$1`,[id]);await pool.query(`update public.admin_broadcasts set status='draft',completed_at=null,failed_count=0 where id=$1`,[id]);void bc78Worker(id)}
async function bc78Schedule(id,minutes){const at=new Date(Date.now()+minutes*60000);await pool.query(`update public.admin_broadcast_jobs_v78 set state='scheduled',scheduled_at=$2,updated_at=now() where broadcast_id=$1`,[id,at]);return at}

async function bc78Test(admin,id){const job=await bc78Job(id);if(!job)throw new Error('broadcast_not_found');if(job.media_kind)return tgV10('copyMessage',{chat_id:admin,from_chat_id:Number(job.source_chat_id),message_id:Number(job.source_message_id),reply_markup:bc78Buttons(job)});return tgV10('sendMessage',{chat_id:admin,text:job.message,disable_web_page_preview:true,reply_markup:bc78Buttons(job)})}
async function bc78History(admin,q=null){await adm18(admin);const rows=(await pool.query(`select j.*,b.total_targets,b.sent_count,b.failed_count,b.created_at from public.admin_broadcast_jobs_v78 j join public.admin_broadcasts b on b.id=j.broadcast_id where j.admin_id=$1 order by b.created_at desc limit 10`,[admin])).rows;const text=`📜 BROADCAST HISTORY\n\n${rows.map((x,i)=>`${i+1}. #${bc78ShortId(x.broadcast_id)} · ${String(x.state).toUpperCase()}\n   🎯 ${x.total_targets} · ✅ ${x.sent_count} · ❌ ${x.failed_count}\n   ${when18(x.created_at)}`).join('\n\n')||'No V78 broadcasts yet.'}`;const markup=kb18(rows.slice(0,6).map(x=>[cb18(`#${bc78ShortId(x.broadcast_id)} STATUS`,`bc78:status:${x.broadcast_id}`)]).concat([[cb18('🏠 CENTER','bc78:home')]]));return q?edit18(q,{text,markup}):safeTg18('sendMessage',{chat_id:admin,text,reply_markup:markup})}
async function bc78CleanupPreview(admin,q=null){await adm18(admin);const x=(await pool.query(`select count(distinct telegram_id)::int c from public.admin_broadcast_deliveries where status='failed' and telegram_id<0 and updated_at>=now()-interval '30 days' and (lower(coalesce(error,'')) like '%forbidden%' or lower(coalesce(error,'')) like '%kicked%' or lower(coalesce(error,'')) like '%chat not found%' or lower(coalesce(error,'')) like '%bot was blocked%')`)).rows[0]?.c||0;const card={text:`🧹 SAFE BROADCAST CLEANUP\n\n${x} group/channel chat(s) have a recent permanent Telegram failure signature.\n\nCleanup only disables those bot_chats targets. It does NOT delete users, balances, transactions or broadcast history.`,markup:kb18([[cb18(`✅ DISABLE ${x} DEAD CHATS`,'bc78:cleanupgo')],[cb18('❌ CANCEL','bc78:home')]])};return q?edit18(q,card):safeTg18('sendMessage',{chat_id:admin,text:card.text,reply_markup:card.markup})}
async function bc78CleanupGo(admin){await adm18(admin);const r=await pool.query(`update public.bot_chats b set active=false,can_post=false,last_seen_at=now() where exists(select 1 from public.admin_broadcast_deliveries d where d.telegram_id=b.chat_id and d.status='failed' and d.updated_at>=now()-interval '30 days' and (lower(coalesce(d.error,'')) like '%forbidden%' or lower(coalesce(d.error,'')) like '%kicked%' or lower(coalesce(d.error,'')) like '%chat not found%' or lower(coalesce(d.error,'')) like '%bot was blocked%'))`);return Number(r.rowCount||0)}

async function bc78Input(admin,text){
  const bs=await bc78Session(admin);if(!bs)return false;
  if(bs.step==='awaiting_message'){await broadcastText78(admin,text);return true}
  if(bs.step==='bc78_button_text'){await bc78SetSession(admin,{step:'bc78_button_url',button_text_v78:text.slice(0,64)});await safeTg18('sendMessage',{chat_id:admin,text:'🔗 Now send the button URL (https://… or t.me/…).'});return true}
  if(bs.step==='bc78_button_url'){
    let url=String(text).trim();if(/^t\.me\//i.test(url))url='https://'+url;if(!/^https:\/\//i.test(url)){await safeTg18('sendMessage',{chat_id:admin,text:'❌ Invalid URL. Send an https:// URL.'});return true}
    const id=bs.broadcast_id_v78,job=await bc78Job(id);if(!job)return false;let buttons=[];try{buttons=Array.isArray(job.buttons)?job.buttons:JSON.parse(job.buttons||'[]')}catch{};buttons.push({text:String(bs.button_text_v78||'OPEN'),url});buttons=buttons.slice(0,8);await pool.query(`update public.admin_broadcast_jobs_v78 set buttons=$2::jsonb,updated_at=now() where broadcast_id=$1`,[id,JSON.stringify(buttons)]);if(buttons.length===1)await pool.query(`update public.admin_broadcasts set button_text=$2,button_url=$3 where id=$1`,[id,buttons[0].text,buttons[0].url]);await bc78SetSession(admin,{step:'bc78_preview',button_text_v78:null});await bc78ShowPreview(admin,id);return true
  }
  if(bs.step==='bc78_uid'){
    const uid=Number(String(text).trim());if(!uid){await safeTg18('sendMessage',{chat_id:admin,text:'❌ Send a numeric Telegram UID.'});return true}await bc78SetSession(admin,{step:'awaiting_message',audience_v78:'custom',filter_v78:`uid:${uid}`});const n=(await bc78Targets('custom',`uid:${uid}`)).length;await safeTg18('sendMessage',{chat_id:admin,text:n?'✅ UID found. Now send the broadcast message/media.':'❌ That UID is not an eligible Wiener user.'});return true
  }
  return false;
}

async function bc78Callback(admin,q){
  const d=String(q?.data||'');if(!d.startsWith('bc78:'))return false;await adm18(admin);const z=d.split(':'),act=z[1],arg=z.slice(2).join(':');await tgV10('answerCallbackQuery',{callback_query_id:q.id}).catch(()=>null);
  if(act==='home')return !!(await bc78Home(admin,q));if(act==='custom')return !!(await bc78Custom(admin,q));
  if(act==='aud')return !!(await bc78AskMessage(admin,arg,null,q));
  if(act==='flt'){if(arg==='uid'){await bc78SetSession(admin,{step:'bc78_uid',audience_v78:'custom',filter_v78:null});await edit18(q,{text:'🆔 SPECIFIC USER\n\nSend the Telegram UID to target.',markup:kb18([[cb18('❌ CANCEL','bc78:home')]])});return true}return !!(await bc78AskMessage(admin,'custom',arg,q))}
  if(act==='status'){return !!(await bc78ShowStatus(admin,arg==='latest'?null:arg,q))}
  if(act==='history')return !!(await bc78History(admin,q));if(act==='cleanup')return !!(await bc78CleanupPreview(admin,q));
  if(act==='cleanupgo'){const n=await bc78CleanupGo(admin);await edit18(q,{text:`✅ Cleanup complete\n\nDisabled ${n} dead group/channel target(s).`,markup:kb18([[cb18('🏠 CENTER','bc78:home')]])});return true}
  if(act==='send'){await bc78Start(arg);await bc78ShowStatus(admin,arg,q);return true}
  if(act==='pause'){await bc78Pause(arg);await bc78ShowStatus(admin,arg,q);return true}
  if(act==='resume'){await bc78Resume(arg);await bc78ShowStatus(admin,arg,q);return true}
  if(act==='stop'){await bc78Stop(arg);await bc78ShowStatus(admin,arg,q);return true}
  if(act==='retry'){await bc78Retry(arg);await bc78ShowStatus(admin,arg,q);return true}
  if(act==='test'){await bc78Test(admin,arg);await safeTg18('sendMessage',{chat_id:admin,text:'🧪 Test delivered only to you.'});return true}
  if(act==='cancel'){await bc78ClearSession(admin);await edit18(q,{text:'❌ Broadcast setup cancelled. Nothing was sent.',markup:kb18([[cb18('🏠 BROADCAST CENTER','bc78:home')]])});return true}
  if(act==='cancelid'){await bc78Stop(arg);await bc78ClearSession(admin);await edit18(q,{text:`❌ Broadcast #${bc78ShortId(arg)} cancelled. Nothing pending will be sent.`,markup:kb18([[cb18('🏠 BROADCAST CENTER','bc78:home')]])});return true}
  if(act==='addbtn'){await bc78SetSession(admin,{step:'bc78_button_text',broadcast_id_v78:arg});await edit18(q,{text:'🔘 ADD BUTTON\n\nSend the button text (example: 🚀 OPEN NOW).',markup:kb18([[cb18('❌ CANCEL','bc78:home')]])});return true}
  if(act==='schedule'){return !!(await edit18(q,{text:`🕒 SCHEDULE #${bc78ShortId(arg)}\n\nChoose when to start:`,markup:kb18([[cb18('+15 MIN',`bc78:sch15:${arg}`),cb18('+1 HOUR',`bc78:sch60:${arg}`)],[cb18('+3 HOURS',`bc78:sch180:${arg}`),cb18('+24 HOURS',`bc78:sch1440:${arg}`)],[cb18('◀️ PREVIEW',`bc78:preview:${arg}`)]])}))}
  if(act.startsWith('sch')){const mins=Number(act.slice(3));const at=await bc78Schedule(arg,mins);await edit18(q,{text:`✅ Broadcast #${bc78ShortId(arg)} scheduled\n\nStart: ${when18(at)}`,markup:kb18([[cb18('📡 STATUS',`bc78:status:${arg}`)],[cb18('⛔ CANCEL',`bc78:stop:${arg}`)]])});return true}
  if(act==='preview'){await bc78ShowPreview(admin,arg,q);return true}
  return false;
}

async function broadcastStart78(admin){return bc78Home(admin)}
async function bc78Command(admin,cmd){
  await adm18(admin);
  if(cmd==='broadcast_status'){await bc78ShowStatus(admin);return true}
  if(cmd==='broadcast_history'){await bc78History(admin);return true}
  if(cmd==='broadcast_retry'){const j=await bc78Latest(admin);if(!j){await safeTg18('sendMessage',{chat_id:admin,text:'No V78 broadcast found.'});return true}await bc78Retry(j.broadcast_id);await bc78ShowStatus(admin,j.broadcast_id);return true}
  if(cmd==='broadcast_cancel'){const j=await bc78Latest(admin);if(j&&!['completed','cancelled'].includes(j.state))await bc78Stop(j.broadcast_id);await safeTg18('sendMessage',{chat_id:admin,text:j?'⛔ Latest active broadcast stopped.':'No V78 broadcast found.'});return true}
  if(cmd==='broadcast_test'){const bs=await bc78Session(admin);const id=bs?.broadcast_id_v78;if(!id){await safeTg18('sendMessage',{chat_id:admin,text:'Open /broadcast and create a preview first.'});return true}await bc78Test(admin,id);await safeTg18('sendMessage',{chat_id:admin,text:'🧪 Test delivered only to you.'});return true}
  if(cmd==='broadcast_cleanup'){await bc78CleanupPreview(admin);return true}
  return false;
}

setInterval(async()=>{try{const rows=(await pool.query(`select broadcast_id from public.admin_broadcast_jobs_v78 where (state='scheduled' and scheduled_at<=now()) or state='sending' order by updated_at asc limit 5`)).rows;for(const x of rows)void bc78Worker(x.broadcast_id)}catch(e){if(!String(e?.message||e).includes('does not exist'))console.error('v78_scheduler',String(e?.message||e))}},30000).unref();
'''

s=s.replace(insert_anchor,code+'\n'+insert_anchor,1)

# Route V78 callbacks before legacy V57 callbacks.
legacy_cb="if(q&&String(q.data||'').startsWith('bcm:')){if(await broadcastMediaCallbackV57(uid,q))return true;}"
if legacy_cb not in s:
    raise SystemExit('ERROR: V57 callback hook missing')
s=s.replace(legacy_cb,"if(q&&String(q.data||'').startsWith('bc78:')){if(await bc78Callback(uid,q))return true;}\n  "+legacy_cb,1)

# Route all V78 interactive text states before legacy text broadcast creation.
legacy_text="if(bs?.step==='awaiting_message'){await broadcastText18(uid,text);return true}"
if legacy_text not in s:
    raise SystemExit('ERROR: V18 text broadcast session hook missing')
s=s.replace(legacy_text,"if(bs&&await bc78Input(uid,text))return true;\n    "+legacy_text,1)

# Route V78 media, including stickers, through the tracked sender.
old_media_guard="if(m?.chat?.type==='private'&&broadcastMediaKindV57(m)){"
if old_media_guard not in s:
    raise SystemExit('ERROR: V57 media guard missing')
s=s.replace(old_media_guard,"if(m?.chat?.type==='private'&&(broadcastMediaKindV57(m)||m?.sticker)){",1)
old_media_call="if(bs57?.step==='awaiting_message'){await broadcastMedia18(uid,m);return true;}"
if old_media_call not in s:
    raise SystemExit('ERROR: V57 media session hook missing')
s=s.replace(old_media_call,"if(bs57?.step==='awaiting_message'){await broadcastMedia78(uid,m);return true;}",1)

# Upgrade /broadcast and add advanced command aliases while leaving all other admin commands untouched.
old_cmd="if(cmd==='broadcast'){try{await broadcastStart18(uid)}catch{await safeTg18('sendMessage',{chat_id:uid,text:'⛔ Admin permission required.'})}return true}"
if old_cmd not in s:
    raise SystemExit('ERROR: V18 /broadcast command anchor missing')
new_cmd="if(['broadcast_status','broadcast_history','broadcast_retry','broadcast_cancel','broadcast_test','broadcast_cleanup'].includes(cmd)){try{await bc78Command(uid,cmd)}catch(e){await safeTg18('sendMessage',{chat_id:uid,text:`⚠️ Broadcast: ${String(e?.message||e)}`})}return true}\n    if(cmd==='broadcast'){try{await broadcastStart78(uid)}catch{await safeTg18('sendMessage',{chat_id:uid,text:'⛔ Admin permission required.'})}return true}"
s=s.replace(old_cmd,new_cmd,1)

p.write_text(s)
print('V78 advanced broadcast center patch installed')
