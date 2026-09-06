#!/usr/bin/env bash
set -euo pipefail

cd /opt/wiener-code
DB=wiener_farm_final
BACKEND=/opt/wiener-backend/server.mjs
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${BACKEND}.bak-v59-${STAMP}"

echo '=== V59 ADVANCED GIVEAWAY ADMIN SAFE INSTALL ==='
[[ -f "$BACKEND" ]] || { echo 'ERROR: backend server.mjs not found' >&2; exit 1; }
node --check "$BACKEND"
cp -a "$BACKEND" "$BACKUP"
rollback(){
  echo 'ERROR: V59 install failed; restoring backend backup.' >&2
  cp -a "$BACKUP" "$BACKEND"
  node --check "$BACKEND" >/dev/null 2>&1 && pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
}
trap rollback ERR

echo '=== DATABASE ==='
runuser -u postgres -- psql -d "$DB" -v ON_ERROR_STOP=1 <<'SQL'
create table if not exists public.wiener_giveaways(
  id bigserial primary key,
  public_id text unique,
  creator_admin_id bigint not null,
  template_key text not null default 'custom',
  title text not null default 'WIENER Giveaway',
  description text,
  media_kind text,
  media_chat_id bigint,
  media_message_id bigint,
  prize_type text not null default 'wiener',
  prize_mode text not null default 'equal',
  prize_amount numeric(30,9) not null default 0,
  total_prize numeric(30,9) not null default 0,
  prize_distribution jsonb not null default '[]'::jsonb,
  winner_count integer not null default 1,
  reserve_count integer not null default 2,
  winner_method text not null default 'random',
  starts_at timestamptz,
  ends_at timestamptz,
  draw_mode text not null default 'manual',
  claim_hours integer not null default 24,
  status text not null default 'draft',
  requirement_logic text not null default 'all',
  requirement_min integer,
  activity_scope text not null default 'lifetime',
  gram_wallet_required boolean not null default false,
  publish_chat_id text not null default '@WienerFarm',
  published_message_id bigint,
  published_at timestamptz,
  drawn_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists wiener_giveaways_status_end_idx on public.wiener_giveaways(status,ends_at);

create table if not exists public.wiener_giveaway_requirements(
  id bigserial primary key,
  giveaway_id bigint not null references public.wiener_giveaways(id) on delete cascade,
  requirement_type text not null,
  label text,
  target_value numeric(30,9),
  target_text text,
  target_chat text,
  mandatory boolean not null default true,
  verification_mode text not null default 'automatic',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists wiener_giveaway_requirements_gid_idx on public.wiener_giveaway_requirements(giveaway_id,sort_order,id);

create table if not exists public.wiener_giveaway_entries(
  id bigserial primary key,
  giveaway_id bigint not null references public.wiener_giveaways(id) on delete cascade,
  telegram_id bigint not null,
  username text,
  first_name text,
  entry_code text,
  status text not null default 'pending',
  eligible boolean not null default false,
  eligibility_reason text,
  progress jsonb not null default '{}'::jsonb,
  eligibility_snapshot jsonb not null default '{}'::jsonb,
  risk_snapshot jsonb not null default '{}'::jsonb,
  wallet_address text,
  wallet_key text,
  wallet_network text,
  wallet_linked_at timestamptz,
  wallet_changed_after_win boolean not null default false,
  entered_at timestamptz not null default now(),
  checked_at timestamptz,
  unique(giveaway_id,telegram_id)
);
create index if not exists wiener_giveaway_entries_gid_status_idx on public.wiener_giveaway_entries(giveaway_id,status,eligible);

create table if not exists public.wiener_giveaway_entry_progress(
  id bigserial primary key,
  giveaway_id bigint not null references public.wiener_giveaways(id) on delete cascade,
  entry_id bigint not null references public.wiener_giveaway_entries(id) on delete cascade,
  requirement_id bigint references public.wiener_giveaway_requirements(id) on delete cascade,
  current_value numeric(30,9),
  target_value numeric(30,9),
  completed boolean not null default false,
  details jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now(),
  unique(entry_id,requirement_id)
);

create table if not exists public.wiener_giveaway_winners(
  id bigserial primary key,
  giveaway_id bigint not null references public.wiener_giveaways(id) on delete cascade,
  entry_id bigint references public.wiener_giveaway_entries(id),
  telegram_id bigint not null,
  username text,
  winner_rank integer,
  reserve_rank integer,
  kind text not null default 'winner',
  prize_type text not null,
  prize_amount numeric(30,9) not null default 0,
  wallet_address text,
  wallet_key text,
  claim_status text not null default 'not_required',
  claim_deadline timestamptz,
  payout_status text not null default 'pending',
  selected_at timestamptz not null default now(),
  eligibility_snapshot jsonb not null default '{}'::jsonb,
  unique(giveaway_id,telegram_id)
);

create table if not exists public.wiener_giveaway_payouts(
  id bigserial primary key,
  giveaway_id bigint not null references public.wiener_giveaways(id) on delete cascade,
  winner_id bigint not null references public.wiener_giveaway_winners(id) on delete cascade,
  telegram_id bigint not null,
  prize_type text not null,
  amount numeric(30,9) not null,
  wallet_address text,
  network text,
  status text not null default 'pending',
  tx_hash text,
  explorer_url text,
  paid_by bigint,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique(winner_id)
);

create table if not exists public.wiener_giveaway_wallets(
  id bigserial primary key,
  giveaway_id bigint not null references public.wiener_giveaways(id) on delete cascade,
  telegram_id bigint not null,
  wallet_address text not null,
  wallet_key text,
  network text not null default 'TON',
  source text not null default 'manual',
  linked_at timestamptz not null default now(),
  changed_after_win boolean not null default false,
  unique(giveaway_id,telegram_id)
);

create table if not exists public.wiener_giveaway_admin_sessions(
  admin_id bigint primary key,
  step text not null default 'home',
  draft jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.wiener_giveaway_admin_logs(
  id bigserial primary key,
  giveaway_id bigint references public.wiener_giveaways(id) on delete set null,
  admin_id bigint not null,
  action text not null,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.wiener_giveaway_templates(
  id bigserial primary key,
  template_key text not null unique,
  title text not null,
  config jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wiener_giveaway_notifications(
  id bigserial primary key,
  giveaway_id bigint references public.wiener_giveaways(id) on delete cascade,
  telegram_id bigint,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  attempts integer not null default 0,
  created_at timestamptz not null default now()
);

insert into public.wiener_giveaway_templates(template_key,title,config) values
('simple','🎁 Simple Giveaway','{"requirements":[]}'::jsonb),
('ads','📺 Ad Booster','{"requirements":[{"type":"ads","value":10}]}'::jsonb),
('referrals','👥 Referral Booster','{"requirements":[{"type":"referrals","value":2}]}'::jsonb),
('tasks','✅ Task Booster','{"requirements":[{"type":"tasks","value":3}]}'::jsonb),
('community','🌐 Community Growth','{"requirements":[{"type":"join_channel","chat":"@WienerFarm"}]}'::jsonb),
('spin','🎡 Spin Event','{"requirements":[{"type":"spins","value":5}]}'::jsonb),
('custom','⚙️ Custom','{"requirements":[]}'::jsonb)
on conflict(template_key) do update set title=excluded.title,config=excluded.config,updated_at=now();

revoke all on table public.wiener_giveaways from public;
revoke all on table public.wiener_giveaway_requirements from public;
revoke all on table public.wiener_giveaway_entries from public;
revoke all on table public.wiener_giveaway_entry_progress from public;
revoke all on table public.wiener_giveaway_winners from public;
revoke all on table public.wiener_giveaway_payouts from public;
revoke all on table public.wiener_giveaway_wallets from public;
revoke all on table public.wiener_giveaway_admin_sessions from public;
revoke all on table public.wiener_giveaway_admin_logs from public;
revoke all on table public.wiener_giveaway_templates from public;
revoke all on table public.wiener_giveaway_notifications from public;
SQL

echo '=== BACKEND PATCH ==='
cat >/tmp/patch-v59-giveaway.py <<'PY'
from pathlib import Path
p=Path('/opt/wiener-backend/server.mjs')
s=p.read_text()
marker='// === WIENER ADVANCED GIVEAWAY V59 ==='
if marker in s:
    print('V59 already installed')
    raise SystemExit(0)

hook="    try{if(await handleBotParityV18(up,uid,text,m,q)) return done();}catch(e){console.error('v18_bot_parity',String(e?.message||e));}"
if hook not in s:
    raise SystemExit('ERROR: V18 bot parity hook not found')
s=s.replace(hook,"    try{if(await handleGiveawayV59(up,uid,text,m,q)) return done();}catch(e){console.error('v59_giveaway',String(e?.message||e));}\n"+hook,1)

route="\napp.use((_req,res)=>\n  res.status(404).json({ok:false,error:'route_not_enabled_yet'})\n);\n"
if route not in s:
    raise SystemExit('ERROR: final route marker not found')

code=r'''

// === WIENER ADVANCED GIVEAWAY V59 ===
const G59_APP='https://wiener-farm.vercel.app';
const g59num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
const g59fmt=(v,d=4)=>g59num(v).toLocaleString(undefined,{maximumFractionDigits:d});
const g59kb=rows=>({inline_keyboard:rows});
const g59cb=(text,data)=>({text,callback_data:data});
const g59url=(text,url)=>({text,url});
async function g59admin(id){return !!(await isAdmin(Number(id||0)))}
async function g59send(chat,text,reply_markup){return tgV10('sendMessage',{chat_id:chat,text,reply_markup,disable_web_page_preview:true})}
async function g59edit(q,text,reply_markup){try{return await tgV10('editMessageText',{chat_id:q.message.chat.id,message_id:q.message.message_id,text,reply_markup,disable_web_page_preview:true})}catch{return g59send(q.from.id,text,reply_markup)}}
async function g59answer(q,text='Updated',alert=false){return tgV10('answerCallbackQuery',{callback_query_id:q.id,text,show_alert:alert}).catch(()=>null)}
async function g59sess(admin){return (await pool.query(`select * from public.wiener_giveaway_admin_sessions where admin_id=$1`,[admin])).rows[0]||null}
async function g59set(admin,step,draft){await pool.query(`insert into public.wiener_giveaway_admin_sessions(admin_id,step,draft,updated_at) values($1,$2,$3::jsonb,now()) on conflict(admin_id) do update set step=excluded.step,draft=excluded.draft,updated_at=now()`,[admin,step,JSON.stringify(draft||{})])}
async function g59clear(admin){await pool.query(`delete from public.wiener_giveaway_admin_sessions where admin_id=$1`,[admin])}
async function g59log(admin,gid,action,oldv=null,newv=null){await pool.query(`insert into public.wiener_giveaway_admin_logs(giveaway_id,admin_id,action,old_value,new_value) values($1,$2,$3,$4::jsonb,$5::jsonb)`,[gid||null,admin,action,oldv?JSON.stringify(oldv):null,newv?JSON.stringify(newv):null]).catch(()=>null)}
function g59homeMarkup(){return g59kb([
 [g59cb('➕ CREATE','g59:new'),g59cb('⚡ QUICK CREATE','g59:quick')],
 [g59cb('📢 ACTIVE','g59:list:active'),g59cb('🕒 SCHEDULED','g59:list:scheduled')],
 [g59cb('🏆 WINNERS','g59:winners'),g59cb('📊 ANALYTICS','g59:analytics')],
 [g59cb('📁 TEMPLATES','g59:templates'),g59cb('⚙️ SETTINGS','g59:settings')]
])}
async function g59home(){const q=await pool.query(`select count(*) filter(where status='open')::int active,count(*) filter(where status='scheduled')::int scheduled,count(*) filter(where status in('drawn','completed'))::int done from public.wiener_giveaways`);const x=q.rows[0]||{};return {text:`🎁 WIENER GIVEAWAY CENTER\n\n📢 Active: ${x.active||0}\n🕒 Scheduled: ${x.scheduled||0}\n🏆 Completed/Drawn: ${x.done||0}\n\nCreate and manage giveaways with prizes, requirements, winners and timing.`,markup:g59homeMarkup()}}
function g59templateMarkup(){return g59kb([
 [g59cb('🎁 SIMPLE','g59:tpl:simple'),g59cb('📺 AD BOOSTER','g59:tpl:ads')],
 [g59cb('👥 REFERRAL BOOSTER','g59:tpl:referrals'),g59cb('✅ TASK BOOSTER','g59:tpl:tasks')],
 [g59cb('🌐 COMMUNITY','g59:tpl:community'),g59cb('🎡 SPIN EVENT','g59:tpl:spin')],
 [g59cb('⚙️ CUSTOM','g59:tpl:custom')],[g59cb('◀️ BACK','g59:home')]
])}
function g59prizeMarkup(){return g59kb([
 [g59cb('🌭 WIENER','g59:prize:wiener'),g59cb('💎 GRAM','g59:prize:gram')],
 [g59cb('💠 TON','g59:prize:ton'),g59cb('💵 USDT','g59:prize:usdt')],
 [g59cb('🎟 PROMO CODE','g59:prize:promo'),g59cb('🎁 CUSTOM','g59:prize:custom')],
 [g59cb('◀️ BACK','g59:home'),g59cb('❌ CANCEL','g59:cancel')]
])}
function g59winnerMarkup(){return g59kb([[1,3,5].map(x=>g59cb(String(x),`g59:wcount:${x}`)),[10,20].map(x=>g59cb(String(x),`g59:wcount:${x}`)),[g59cb('✍️ CUSTOM','g59:wcount:custom')],[g59cb('◀️ BACK','g59:home'),g59cb('❌ CANCEL','g59:cancel')]])}
function g59durationMarkup(){return g59kb([
 [g59cb('1 HOUR','g59:dur:1h'),g59cb('6 HOURS','g59:dur:6h')],
 [g59cb('12 HOURS','g59:dur:12h'),g59cb('24 HOURS','g59:dur:24h')],
 [g59cb('3 DAYS','g59:dur:3d'),g59cb('7 DAYS','g59:dur:7d')],
 [g59cb('✍️ CUSTOM HOURS','g59:dur:custom')],[g59cb('◀️ BACK','g59:home')]
])}
function g59reqText(d){const r=d.requirements||[];return r.length?r.map((x,i)=>`${i+1}. ${x.label||x.type}${x.value!=null?` · ${x.value}`:''}${x.chat?` · ${x.chat}`:''}`).join('\n'):'No requirements — open participation.'}
function g59reqMarkup(){return g59kb([
 [g59cb('📢 JOIN CHANNEL','g59:req:join_channel'),g59cb('💬 JOIN GROUP','g59:req:join_group')],
 [g59cb('📺 ADS','g59:req:ads'),g59cb('✅ TASKS','g59:req:tasks')],
 [g59cb('👥 REFERRALS','g59:req:referrals'),g59cb('🎡 SPINS','g59:req:spins')],
 [g59cb('👤 USERNAME','g59:req:username'),g59cb('🕒 ACCOUNT AGE','g59:req:account_age')],
 [g59cb('📝 NAME TEXT','g59:req:name_text'),g59cb('📄 BIO TEXT','g59:req:bio_text')],
 [g59cb('🗑 CLEAR','g59:req:clear'),g59cb('✅ DONE','g59:req:done')],
 [g59cb('❌ CANCEL','g59:cancel')]
])}
function g59previewText(d){return `🎁 GIVEAWAY PREVIEW\n\n${d.title||'WIENER Giveaway'}\n${d.description?d.description+'\n\n':''}🎁 Prize: ${g59fmt(d.prize_amount||0,9)} ${String(d.prize_type||'WIENER').toUpperCase()} each\n🏆 Winners: ${d.winner_count||1}\n🛟 Reserves: ${d.reserve_count??2}\n⏰ Duration: ${d.duration_hours||24}h\n🎲 Winner method: RANDOM ELIGIBLE\n\n📋 REQUIREMENTS\n${g59reqText(d)}${d.prize_type==='gram'?'\n\n👛 TON-compatible wallet required for GRAM payout.':''}`}
function g59previewMarkup(){return g59kb([[g59cb('✅ CREATE & PUBLISH','g59:publish')],[g59cb('📋 EDIT REQUIREMENTS','g59:reqmenu'),g59cb('✏️ EDIT TITLE','g59:edittitle')],[g59cb('💰 EDIT PRIZE','g59:editprize'),g59cb('🏆 EDIT WINNERS','g59:editwinners')],[g59cb('⏰ EDIT TIME','g59:edittime')],[g59cb('💾 SAVE DRAFT','g59:savedraft'),g59cb('❌ CANCEL','g59:cancel')]])}
async function g59list(status){let where=status==='active'?`status='open'`:`status='scheduled'`;const q=await pool.query(`select id,public_id,title,prize_type,prize_amount,winner_count,ends_at,status from public.wiener_giveaways where ${where} order by ends_at asc nulls last limit 10`);let t=`${status==='active'?'📢 ACTIVE':'🕒 SCHEDULED'} GIVEAWAYS\n\n`;t+=q.rows.length?q.rows.map(x=>`${x.status==='open'?'🟢':'🕒'} ${x.public_id} · ${String(x.title).slice(0,28)}\n   ${g59fmt(x.prize_amount,9)} ${String(x.prize_type).toUpperCase()} × ${x.winner_count}`).join('\n\n'):'None.';const rows=q.rows.slice(0,6).map(x=>[g59cb(`🎁 ${x.public_id}`,`g59:view:${x.id}`)]);rows.push([g59cb('◀️ BACK','g59:home')]);return {text:t,markup:g59kb(rows)}}
async function g59card(id){const g=(await pool.query(`select * from public.wiener_giveaways where id=$1`,[id])).rows[0];if(!g)return {text:'Giveaway not found.',markup:g59homeMarkup()};const [e,w]=await Promise.all([pool.query(`select count(*)::int c,count(*) filter(where eligible)::int ok from public.wiener_giveaway_entries where giveaway_id=$1`,[id]),pool.query(`select count(*)::int c from public.wiener_giveaway_winners where giveaway_id=$1 and kind='winner'`,[id])]);return {text:`🎁 ${g.public_id}\n\n${g.title}\n\n🎁 ${g59fmt(g.prize_amount,9)} ${String(g.prize_type).toUpperCase()} × ${g.winner_count}\n👥 Entries: ${e.rows[0]?.c||0}\n✅ Eligible: ${e.rows[0]?.ok||0}\n🏆 Winners selected: ${w.rows[0]?.c||0}\n📌 Status: ${String(g.status).toUpperCase()}\n⏰ Ends: ${g.ends_at?new Date(g.ends_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'}):'—'}`,markup:g59kb([[g59cb('📊 REFRESH',`g59:view:${id}`),g59cb('👥 PARTICIPANTS',`g59:people:${id}`)],[g59cb('⏰ +24H EXTEND',`g59:extend:${id}`),g59cb(g.status==='open'?'⏸ PAUSE':'▶️ RESUME',`g59:toggle:${id}`)],[g59cb('🎲 DRAW WINNERS',`g59:draw:${id}`)],[g59cb('◀️ BACK','g59:home')]])}}
async function g59create(admin,d,publish=true){const c=await pool.connect();try{await c.query('begin');const pub='GW-'+Date.now().toString(36).toUpperCase();const hours=Math.max(1,Math.min(24*60,Number(d.duration_hours||24)));const status=publish?'open':'draft';const g=(await c.query(`insert into public.wiener_giveaways(public_id,creator_admin_id,template_key,title,description,prize_type,prize_amount,total_prize,winner_count,reserve_count,winner_method,starts_at,ends_at,status,activity_scope,gram_wallet_required,publish_chat_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'random',now(),now()+($11||' hours')::interval,$12,$13,$14,$15) returning *`,[pub,admin,d.template_key||'custom',d.title||'WIENER Giveaway',d.description||null,d.prize_type||'wiener',Number(d.prize_amount||0),Number(d.prize_amount||0)*Number(d.winner_count||1),Number(d.winner_count||1),Number(d.reserve_count??2),hours,status,d.activity_scope||'lifetime',d.prize_type==='gram',d.publish_chat||'@WienerFarm'])).rows[0];for(const [i,r] of (d.requirements||[]).entries()){await c.query(`insert into public.wiener_giveaway_requirements(giveaway_id,requirement_type,label,target_value,target_text,target_chat,mandatory,verification_mode,sort_order) values($1,$2,$3,$4,$5,$6,true,$7,$8)`,[g.id,r.type,r.label||r.type,r.value??null,r.text??null,r.chat??null,r.verification||'automatic',i])}await c.query('commit');await g59log(admin,g.id,'created',null,d);if(publish){const req=(d.requirements||[]).length?'\n\n📋 Requirements\n'+g59reqText(d):'';const txt=`🎁 ${g.title}\n\n🎁 Prize: ${g59fmt(g.prize_amount,9)} ${String(g.prize_type).toUpperCase()} each\n🏆 Winners: ${g.winner_count}\n⏰ Ends: ${new Date(g.ends_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})}${req}${g.prize_type==='gram'?'\n👛 Link a TON wallet to enter.':''}`;try{const m=await tgV10('sendMessage',{chat_id:g.publish_chat_id,text:txt,reply_markup:g59kb([[g59cb('🎁 PARTICIPATE',`g59j:${g.id}`)],[g59url('🌭 OPEN WIENER FARM',G59_APP)]]),disable_web_page_preview:true});await pool.query(`update public.wiener_giveaways set published_message_id=$2,published_at=now() where id=$1`,[g.id,m?.message_id||null])}catch(e){await pool.query(`update public.wiener_giveaways set status='draft' where id=$1`,[g.id]);throw new Error('created_but_publish_failed: '+String(e?.message||e))}}return g}catch(e){await c.query('rollback').catch(()=>null);throw e}finally{c.release()}}
async function g59wallet(raw){const mod=await import('@ton/core'),a=mod.Address.parse(String(raw||'').trim());return {key:a.toRawString().toLowerCase(),friendly:a.toString({bounceable:false,testOnly:false,urlSafe:true})}}
async function g59join(q,id){const uid=Number(q.from.id),g=(await pool.query(`select * from public.wiener_giveaways where id=$1`,[id])).rows[0];if(!g)return g59answer(q,'Giveaway not found.',true);if(g.status!=='open'||(g.ends_at&&new Date(g.ends_at)<=new Date()))return g59answer(q,'This giveaway is closed.',true);const u=(await pool.query(`select * from public.users where telegram_id=$1 limit 1`,[uid])).rows[0];if(!u||u.is_banned)return g59answer(q,'Your WIENER Farm account is not eligible.',true);let e=(await pool.query(`insert into public.wiener_giveaway_entries(giveaway_id,telegram_id,username,first_name,entry_code,status,eligible) values($1,$2,$3,$4,$5,'pending',false) on conflict(giveaway_id,telegram_id) do update set username=excluded.username,first_name=excluded.first_name returning *`,[g.id,uid,q.from.username||null,q.from.first_name||null,`${g.public_id}-${String(uid).slice(-6)}`])).rows[0];if(g.gram_wallet_required&&!e.wallet_address){await g59set(uid,`user_wallet:${g.id}`,{});await g59answer(q,'Link your TON-compatible wallet first.',true);await g59send(uid,`👛 LINK WALLET\n\n${g.title} pays rewards in GRAM.\n\nSend your TON-compatible wallet address here.`,g59kb([[g59cb('❌ CANCEL','g59u:cancel')]]));return true}
 const req=(await pool.query(`select * from public.wiener_giveaway_requirements where giveaway_id=$1 order by sort_order,id`,[g.id])).rows;let pass=true,lines=[];for(const r of req){let ok=true,detail='';if(r.requirement_type==='username'){ok=!!q.from.username}else if(r.requirement_type==='account_age'){const days=(Date.now()-new Date(u.created_at).getTime())/86400000;ok=days>=Number(r.target_value||0);detail=`${Math.floor(days)}/${Number(r.target_value||0)} days`}else if(r.requirement_type==='ads'){ok=Number(u.total_ads||0)>=Number(r.target_value||0);detail=`${Number(u.total_ads||0)}/${Number(r.target_value||0)}`}else if(r.requirement_type==='referrals'){ok=Number(u.active_referrals_count||0)>=Number(r.target_value||0);detail=`${Number(u.active_referrals_count||0)}/${Number(r.target_value||0)}`}else if(r.requirement_type==='tasks'){const n=Number((await pool.query(`select count(*)::int c from public.task_completions where telegram_id=$1`,[uid])).rows[0]?.c||0);ok=n>=Number(r.target_value||0);detail=`${n}/${Number(r.target_value||0)}`}else if(r.requirement_type==='spins'){const n=Number((await pool.query(`select count(*)::int c from public.wiener_spin_events where telegram_id=$1`,[uid]).catch(()=>({rows:[{c:0}]}))).rows[0]?.c||0);ok=n>=Number(r.target_value||0);detail=`${n}/${Number(r.target_value||0)}`}else if(['join_channel','join_group'].includes(r.requirement_type)&&r.target_chat){const cm=await tgV10('getChatMember',{chat_id:r.target_chat,user_id:uid}).catch(()=>null);ok=!!cm&&['member','administrator','creator','restricted'].includes(String(cm.status))}else if(r.verification_mode==='manual'){ok=true;detail='manual review'};if(!ok)pass=false;lines.push(`${ok?'✅':'❌'} ${r.label||r.requirement_type}${detail?' · '+detail:''}`)}await pool.query(`update public.wiener_giveaway_entries set status=$3,eligible=$4,eligibility_reason=$5,progress=$6::jsonb,checked_at=now() where giveaway_id=$1 and telegram_id=$2`,[g.id,uid,pass?'eligible':'pending',pass,pass?null:'requirements_incomplete',JSON.stringify({checks:lines})]);await g59answer(q,pass?'You are participating!':'Complete the missing requirements.',true);await g59send(uid,`${pass?'✅ YOU’RE PARTICIPATING!':'🎁 GIVEAWAY PROGRESS'}\n\n${g.title}\n🎟 ${e.entry_code}\n\n${lines.join('\n')||'✅ Open participation'}${pass?'\n\nYour eligibility will be checked again before winner selection.':'\n\nComplete the missing items and tap CHECK AGAIN.'}`,g59kb([[g59cb('🔄 CHECK AGAIN',`g59j:${g.id}`)],[g59url('🌭 OPEN WIENER FARM',G59_APP)]]));return true}
async function g59draw(admin,id){const c=await pool.connect();try{await c.query('begin');const g=(await c.query(`select * from public.wiener_giveaways where id=$1 for update`,[id])).rows[0];if(!g)throw new Error('giveaway_not_found');if(!['open','paused'].includes(g.status))throw new Error('giveaway_not_drawable');const rows=(await c.query(`select e.* from public.wiener_giveaway_entries e left join public.users u on u.telegram_id=e.telegram_id where e.giveaway_id=$1 and e.eligible=true and coalesce(u.is_banned,false)=false order by e.id`,[id])).rows;if(rows.length<Number(g.winner_count||1))throw new Error('not_enough_eligible_entries');const seed=crypto.randomBytes(32).toString('hex');const rank=rows.map(x=>({x,k:crypto.createHash('sha256').update(`${seed}:${id}:${x.telegram_id}:${x.id}`).digest('hex')})).sort((a,b)=>a.k.localeCompare(b.k));const take=Math.min(rank.length,Number(g.winner_count||1)+Number(g.reserve_count||0));for(let i=0;i<take;i++){const x=rank[i].x,win=i<Number(g.winner_count||1),amount=Number(g.prize_amount||0);await c.query(`insert into public.wiener_giveaway_winners(giveaway_id,entry_id,telegram_id,username,winner_rank,reserve_rank,kind,prize_type,prize_amount,wallet_address,wallet_key,claim_status,claim_deadline,payout_status,eligibility_snapshot) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now()+($13||' hours')::interval,$14,$15::jsonb) on conflict(giveaway_id,telegram_id) do nothing`,[id,x.id,x.telegram_id,x.username,win?i+1:null,win?null:i-Number(g.winner_count||1)+1,win?'winner':'reserve',g.prize_type,amount,x.wallet_address,x.wallet_key,win?'pending':'not_required',Number(g.claim_hours||24),win?'pending':'reserve',JSON.stringify(x.eligibility_snapshot||{})]);if(win&&g.prize_type==='wiener'){await c.query(`update public.users set balance=balance+$2,total_earned=coalesce(total_earned,0)+$2 where telegram_id=$1`,[x.telegram_id,amount]);await c.query(`insert into public.transactions(telegram_id,amount,description,kind) values($1,$2,$3,'giveaway')`,[x.telegram_id,amount,`Giveaway ${g.public_id} winner reward`]).catch(()=>null);await c.query(`update public.wiener_giveaway_winners set claim_status='claimed',payout_status='paid' where giveaway_id=$1 and telegram_id=$2`,[id,x.telegram_id])}}
 await c.query(`update public.wiener_giveaways set status='drawn',drawn_at=now(),updated_at=now() where id=$1`,[id]);await c.query('commit');await g59log(admin,id,'draw_winners',null,{seed,count:g.winner_count,reserves:g.reserve_count});for(let i=0;i<Math.min(rank.length,Number(g.winner_count||1));i++){const x=rank[i].x;await g59send(x.telegram_id,`🎉 CONGRATULATIONS!\n\nYou won ${g.title}\n🏆 Rank: #${i+1}\n🎁 Prize: ${g59fmt(g.prize_amount,9)} ${String(g.prize_type).toUpperCase()}${g.prize_type==='wiener'?'\n✅ Reward credited to your WIENER balance.':'\n💸 Prize payment is pending admin processing.'}`,g59kb([[g59url('🌭 OPEN WIENER FARM',G59_APP)]] )).catch(()=>null)}return true}catch(e){await c.query('rollback').catch(()=>null);throw e}finally{c.release()}}
async function handleGiveawayV59(up,uid,text,m,q){
 const admin=await g59admin(uid);
 if(q?.data?.startsWith('g59j:')){await g59join(q,Number(q.data.split(':')[1]));return true}
 if(q?.data==='g59u:cancel'){await g59clear(uid);await g59answer(q,'Cancelled');return true}
 const us=await g59sess(uid);
 if(!admin&&us?.step?.startsWith('user_wallet:')&&m?.text){const gid=Number(us.step.split(':')[1]);try{const w=await g59wallet(m.text);const win=(await pool.query(`select 1 from public.wiener_giveaway_winners where giveaway_id=$1 and telegram_id=$2 and kind='winner'`,[gid,uid])).rowCount>0;await pool.query(`update public.wiener_giveaway_entries set wallet_address=$3,wallet_key=$4,wallet_network='TON',wallet_linked_at=now(),wallet_changed_after_win=$5 where giveaway_id=$1 and telegram_id=$2`,[gid,uid,w.friendly,w.key,win]);await pool.query(`insert into public.wiener_giveaway_wallets(giveaway_id,telegram_id,wallet_address,wallet_key,network,changed_after_win) values($1,$2,$3,$4,'TON',$5) on conflict(giveaway_id,telegram_id) do update set wallet_address=excluded.wallet_address,wallet_key=excluded.wallet_key,linked_at=now(),changed_after_win=excluded.changed_after_win`,[gid,uid,w.friendly,w.key,win]);await g59clear(uid);await g59send(uid,`✅ Wallet linked\n\n${w.friendly}\n\nReturn to the giveaway and tap PARTICIPATE / CHECK AGAIN.`);return true}catch{await g59send(uid,'❌ Invalid TON address. Send a valid TON-compatible wallet address.');return true}}
 if(!admin)return false;
 if(/^\/giveaway(?:@\w+)?(?:\s|$)/i.test(text||'')){await g59clear(uid);const h=await g59home();await g59send(uid,h.text,h.markup);return true}
 if(!q?.data?.startsWith('g59:')&&us&&m?.text&&!String(text||'').startsWith('/')){const d=us.draft||{};if(us.step==='title'){d.title=String(text).slice(0,120);await g59set(uid,'description',d);await g59send(uid,'📝 Send giveaway description.\n\nSend - to skip.');return true}if(us.step==='description'){d.description=String(text)==='-'?'':String(text).slice(0,1000);await g59set(uid,'prize_type',d);await g59send(uid,'💰 Select prize type:',g59prizeMarkup());return true}if(us.step==='prize_amount'){const n=Number(String(text).replace(',','.'));if(!(n>0))return g59send(uid,'❌ Send a valid prize amount greater than 0.');d.prize_amount=n;await g59set(uid,'winner_count',d);await g59send(uid,'🏆 Number of winners:',g59winnerMarkup());return true}if(us.step==='winner_custom'){const n=Math.floor(Number(text));if(!(n>=1&&n<=100))return g59send(uid,'❌ Winners must be 1–100.');d.winner_count=n;await g59set(uid,'duration',d);await g59send(uid,'⏰ Select giveaway duration:',g59durationMarkup());return true}if(us.step==='duration_custom'){const n=Number(text);if(!(n>=1&&n<=1440))return g59send(uid,'❌ Duration must be 1–1440 hours.');d.duration_hours=n;await g59set(uid,'requirements',d);await g59send(uid,`📋 REQUIREMENTS\n\n${g59reqText(d)}\n\nAdd requirements or tap DONE.`,g59reqMarkup());return true}if(us.step?.startsWith('req_value:')){const type=us.step.split(':')[1],n=Number(text);if(!(n>=0))return g59send(uid,'❌ Send a valid number.');const labels={ads:'📺 Watch Ads',tasks:'✅ Complete Tasks',referrals:'👥 Valid Referrals',spins:'🎡 Spins',account_age:'🕒 Account Age (days)'};d.requirements=d.requirements||[];d.requirements.push({type,label:labels[type]||type,value:n});await g59set(uid,'requirements',d);await g59send(uid,`✅ Added.\n\n${g59reqText(d)}`,g59reqMarkup());return true}if(us.step?.startsWith('req_chat:')){const type=us.step.split(':')[1],chat=String(text).trim();if(!chat)return g59send(uid,'❌ Send @channel / @group username.');d.requirements=d.requirements||[];d.requirements.push({type,label:type==='join_channel'?'📢 Join Channel':'💬 Join Group',chat});await g59set(uid,'requirements',d);await g59send(uid,`✅ Added ${chat}.\n\n${g59reqText(d)}`,g59reqMarkup());return true}if(us.step?.startsWith('req_text:')){const type=us.step.split(':')[1];d.requirements=d.requirements||[];d.requirements.push({type,label:type==='name_text'?'📝 Name contains text':'📄 Bio contains text',text:String(text).slice(0,80),verification:type==='bio_text'?'manual':'automatic'});await g59set(uid,'requirements',d);await g59send(uid,`✅ Added.\n\n${g59reqText(d)}`,g59reqMarkup());return true}}
 if(!q?.data?.startsWith('g59:'))return false;
 const a=q.data.split(':'),act=a[1];
 if(act==='home'){await g59clear(uid);const h=await g59home();await g59edit(q,h.text,h.markup);return true}
 if(act==='cancel'){await g59clear(uid);await g59answer(q,'Cancelled');const h=await g59home();await g59edit(q,h.text,h.markup);return true}
 if(act==='new'||act==='quick'){await g59set(uid,'template',{quick:act==='quick',requirements:[],reserve_count:2,activity_scope:'lifetime'});await g59edit(q,act==='quick'?'⚡ QUICK CREATE\n\nChoose a giveaway objective/template:':'➕ CREATE GIVEAWAY\n\nChoose a giveaway objective/template:',g59templateMarkup());return true}
 if(act==='tpl'){const d=(await g59sess(uid))?.draft||{};d.template_key=a[2];const preset={ads:[{type:'ads',label:'📺 Watch Ads',value:10}],referrals:[{type:'referrals',label:'👥 Valid Referrals',value:2}],tasks:[{type:'tasks',label:'✅ Complete Tasks',value:3}],community:[{type:'join_channel',label:'📢 Join Channel',chat:'@WienerFarm'}],spin:[{type:'spins',label:'🎡 Spins',value:5}]};d.requirements=preset[a[2]]||[];await g59set(uid,'title',d);await g59edit(q,'📝 Send giveaway title.\n\nExample: WIENER Weekend Giveaway',g59kb([[g59cb('❌ CANCEL','g59:cancel')]]));return true}
 if(act==='prize'){const s0=await g59sess(uid),d=s0?.draft||{};d.prize_type=a[2];await g59set(uid,'prize_amount',d);await g59edit(q,`💰 Prize: ${a[2].toUpperCase()}\n\nSend prize amount PER WINNER.`,g59kb([[g59cb('❌ CANCEL','g59:cancel')]]));return true}
 if(act==='wcount'){const s0=await g59sess(uid),d=s0?.draft||{};if(a[2]==='custom'){await g59set(uid,'winner_custom',d);await g59edit(q,'🏆 Send number of winners (1–100).',g59kb([[g59cb('❌ CANCEL','g59:cancel')]]));return true}d.winner_count=Number(a[2]);await g59set(uid,'duration',d);await g59edit(q,'⏰ Select giveaway duration:',g59durationMarkup());return true}
 if(act==='dur'){const s0=await g59sess(uid),d=s0?.draft||{};if(a[2]==='custom'){await g59set(uid,'duration_custom',d);await g59edit(q,'⏰ Send duration in HOURS (1–1440).',g59kb([[g59cb('❌ CANCEL','g59:cancel')]]));return true}d.duration_hours=a[2].endsWith('d')?Number(a[2].slice(0,-1))*24:Number(a[2].slice(0,-1));await g59set(uid,'requirements',d);await g59edit(q,`📋 REQUIREMENTS\n\n${g59reqText(d)}\n\nAdd requirements or tap DONE.`,g59reqMarkup());return true}
 if(act==='reqmenu'){const d=(await g59sess(uid))?.draft||{};await g59set(uid,'requirements',d);await g59edit(q,`📋 REQUIREMENTS\n\n${g59reqText(d)}`,g59reqMarkup());return true}
 if(act==='req'){const type=a[2],s0=await g59sess(uid),d=s0?.draft||{};if(type==='done'){await g59set(uid,'preview',d);await g59edit(q,g59previewText(d),g59previewMarkup());return true}if(type==='clear'){d.requirements=[];await g59set(uid,'requirements',d);await g59edit(q,'📋 Requirements cleared.\n\nOpen participation.',g59reqMarkup());return true}if(type==='username'){d.requirements=d.requirements||[];d.requirements.push({type:'username',label:'👤 Username required'});await g59set(uid,'requirements',d);await g59edit(q,`✅ Added.\n\n${g59reqText(d)}`,g59reqMarkup());return true}if(['join_channel','join_group'].includes(type)){await g59set(uid,`req_chat:${type}`,d);await g59edit(q,`Send ${type==='join_channel'?'channel':'group'} username, e.g. @WienerFarm`,g59kb([[g59cb('❌ CANCEL','g59:cancel')]]));return true}if(['name_text','bio_text'].includes(type)){await g59set(uid,`req_text:${type}`,d);await g59edit(q,`Send required ${type==='name_text'?'name':'bio'} text.`,g59kb([[g59cb('❌ CANCEL','g59:cancel')]]));return true}await g59set(uid,`req_value:${type}`,d);await g59edit(q,'Send required number.',g59kb([[g59cb('❌ CANCEL','g59:cancel')]]));return true}
 if(act==='publish'){const s0=await g59sess(uid),d=s0?.draft||{};try{const g=await g59create(uid,d,true);await g59clear(uid);await g59answer(q,'Giveaway created!');await g59edit(q,`✅ GIVEAWAY CREATED & PUBLISHED\n\nID: ${g.public_id}\n${g.title}\n🎁 ${g59fmt(g.prize_amount,9)} ${String(g.prize_type).toUpperCase()} × ${g.winner_count}\n\nPublished to ${g.publish_chat_id}.`,g59kb([[g59cb('🎁 MANAGE',`g59:view:${g.id}`)],[g59cb('◀️ GIVEAWAY CENTER','g59:home')]]));return true}catch(e){await g59answer(q,String(e?.message||e).slice(0,180),true);return true}}
 if(act==='savedraft'){const s0=await g59sess(uid),d=s0?.draft||{};const g=await g59create(uid,d,false);await g59clear(uid);await g59answer(q,'Draft saved');await g59edit(q,`💾 Draft saved\n\n${g.public_id} · ${g.title}`,g59kb([[g59cb('◀️ GIVEAWAY CENTER','g59:home')]]));return true}
 if(act==='list'){const x=await g59list(a[2]);await g59edit(q,x.text,x.markup);return true}
 if(act==='view'){const x=await g59card(Number(a[2]));await g59edit(q,x.text,x.markup);return true}
 if(act==='people'){const id=Number(a[2]),z=await pool.query(`select telegram_id,username,eligible,status from public.wiener_giveaway_entries where giveaway_id=$1 order by entered_at desc limit 15`,[id]);await g59edit(q,`👥 PARTICIPANTS\n\n${z.rows.map(x=>`${x.eligible?'✅':'⏳'} ${x.username?'@'+x.username:'UID '+x.telegram_id} · ${x.status}`).join('\n')||'No participants yet.'}`,g59kb([[g59cb('◀️ BACK',`g59:view:${id}`)]]));return true}
 if(act==='extend'){const id=Number(a[2]);await pool.query(`update public.wiener_giveaways set ends_at=coalesce(ends_at,now())+interval '24 hours',updated_at=now() where id=$1`,[id]);await g59log(uid,id,'extend_24h');await g59answer(q,'Extended 24 hours');const x=await g59card(id);await g59edit(q,x.text,x.markup);return true}
 if(act==='toggle'){const id=Number(a[2]);const g=(await pool.query(`update public.wiener_giveaways set status=case when status='open' then 'paused' when status='paused' then 'open' else status end,updated_at=now() where id=$1 returning *`,[id])).rows[0];await g59log(uid,id,'toggle_status',null,{status:g?.status});await g59answer(q,g?.status||'Updated');const x=await g59card(id);await g59edit(q,x.text,x.markup);return true}
 if(act==='draw'){const id=Number(a[2]);try{await g59draw(uid,id);await g59answer(q,'Winners selected');const x=await g59card(id);await g59edit(q,x.text,x.markup)}catch(e){await g59answer(q,String(e?.message||e).slice(0,180),true)}return true}
 if(act==='winners'){const z=await pool.query(`select g.public_id,g.title,w.telegram_id,w.username,w.winner_rank,w.prize_type,w.prize_amount,w.payout_status from public.wiener_giveaway_winners w join public.wiener_giveaways g on g.id=w.giveaway_id where w.kind='winner' order by w.selected_at desc limit 15`);await g59edit(q,`🏆 RECENT WINNERS\n\n${z.rows.map(x=>`#${x.winner_rank} ${x.username?'@'+x.username:'UID '+x.telegram_id}\n${x.public_id} · ${g59fmt(x.prize_amount,9)} ${String(x.prize_type).toUpperCase()} · ${x.payout_status}`).join('\n\n')||'No winners yet.'}`,g59kb([[g59cb('◀️ BACK','g59:home')]]));return true}
 if(act==='analytics'){const z=await pool.query(`select count(*)::int giveaways,(select count(*)::int from public.wiener_giveaway_entries) entries,(select count(*)::int from public.wiener_giveaway_entries where eligible) eligible,(select count(*)::int from public.wiener_giveaway_winners where kind='winner') winners from public.wiener_giveaways`);const x=z.rows[0]||{};await g59edit(q,`📊 GIVEAWAY ANALYTICS\n\n🎁 Giveaways: ${x.giveaways||0}\n👥 Entries: ${x.entries||0}\n✅ Eligible: ${x.eligible||0}\n🏆 Winners: ${x.winners||0}\n\nPer-giveaway engagement analytics are stored in the giveaway tables and entry progress snapshots.`,g59kb([[g59cb('◀️ BACK','g59:home')]]));return true}
 if(act==='templates'){const z=await pool.query(`select template_key,title from public.wiener_giveaway_templates where enabled=true order by id`);await g59edit(q,`📁 GIVEAWAY TEMPLATES\n\n${z.rows.map(x=>`• ${x.title} · ${x.template_key}`).join('\n')}`,g59kb([[g59cb('➕ CREATE FROM TEMPLATE','g59:new')],[g59cb('◀️ BACK','g59:home')]]));return true}
 if(act==='settings'){await g59edit(q,'⚙️ GIVEAWAY SETTINGS\n\n✅ Random eligible winner is default\n✅ 2 reserve winners by default\n✅ GRAM requires TON-compatible wallet\n✅ Critical eligibility is rechecked at participation\n✅ Admin actions are audit logged\n✅ Crypto payouts remain explicit/admin-controlled\n\nAdvanced options stay hidden from normal creation so setup remains simple.',g59kb([[g59cb('◀️ BACK','g59:home')]]));return true}
 if(['edittitle','editprize','editwinners','edittime'].includes(act)){const s0=await g59sess(uid),d=s0?.draft||{};if(act==='edittitle'){await g59set(uid,'title',d);await g59edit(q,'📝 Send new title.',g59kb([[g59cb('❌ CANCEL','g59:cancel')]]))}if(act==='editprize'){await g59set(uid,'prize_type',d);await g59edit(q,'💰 Select prize type:',g59prizeMarkup())}if(act==='editwinners'){await g59set(uid,'winner_count',d);await g59edit(q,'🏆 Select winners:',g59winnerMarkup())}if(act==='edittime'){await g59set(uid,'duration',d);await g59edit(q,'⏰ Select duration:',g59durationMarkup())}return true}
 return false
}
// === END WIENER ADVANCED GIVEAWAY V59 ===
'''
s=s.replace(route,code+route,1)
p.write_text(s)
print('V59 advanced giveaway admin center installed')
PY

python3 /tmp/patch-v59-giveaway.py
node --check "$BACKEND"
grep -q 'WIENER ADVANCED GIVEAWAY V59' "$BACKEND"

echo '=== RESTART ==='
pm2 restart wiener-api --update-env
sleep 2
curl -fsS http://127.0.0.1:3000/health
echo
pm2 save

echo '=== VERIFY V59 ==='
runuser -u postgres -- psql -d "$DB" -Atqc "select count(*)||' giveaway_tables' from information_schema.tables where table_schema='public' and table_name in ('wiener_giveaways','wiener_giveaway_requirements','wiener_giveaway_entries','wiener_giveaway_entry_progress','wiener_giveaway_winners','wiener_giveaway_payouts','wiener_giveaway_wallets','wiener_giveaway_admin_sessions','wiener_giveaway_admin_logs','wiener_giveaway_templates','wiener_giveaway_notifications')"
runuser -u postgres -- psql -d "$DB" -Atqc "select count(*)||' giveaway_templates' from public.wiener_giveaway_templates where enabled=true"
node --check "$BACKEND"
echo '=== V59 READY ==='
echo '/giveaway now opens the advanced admin Giveaway Center.'
echo 'Includes creation wizard, templates, prizes, requirements, GRAM wallet linking, participants, random draw, reserves, WIENER auto-credit, analytics and audit structure.'
echo 'Crypto giveaway payouts are intentionally explicit/admin-controlled; this installer does not auto-send treasury funds.'
trap - ERR
