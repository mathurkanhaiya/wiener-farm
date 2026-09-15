#!/usr/bin/env bash
set -euo pipefail

cd /opt/wiener-code
DB=wiener_farm_final
BACKEND=/opt/wiener-backend/server.mjs
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${BACKEND}.bak-v60-${STAMP}"

echo '=== V60 CLEAN GIVEAWAY PARTICIPATION SAFE INSTALL ==='
[[ -f "$BACKEND" ]] || { echo 'ERROR: backend server.mjs not found' >&2; exit 1; }

# V57 media broadcast is intentionally in-memory. Never restart while one is sending.
ACTIVE_BC="$(runuser -u postgres -- psql -d "$DB" -Atqc "select count(*) from public.admin_broadcast_sessions where step='media_sending'" 2>/dev/null || echo 0)"
if [[ "${ACTIVE_BC:-0}" != "0" ]]; then
  echo 'ERROR: active V57 media broadcast detected; wait for it to finish before installing V60.' >&2
  exit 1
fi

# Ensure the V59 advanced admin center exists first. This is idempotent.
if ! grep -q 'WIENER ADVANCED GIVEAWAY V59' "$BACKEND"; then
  echo '=== INSTALL V59 FOUNDATION ==='
  bash scripts/install-vps-v59b-giveaway-hook-fix.sh
fi

node --check "$BACKEND"
cp -a "$BACKEND" "$BACKUP"
rollback(){
  echo 'ERROR: V60 install failed; restoring backend backup.' >&2
  cp -a "$BACKUP" "$BACKEND"
  node --check "$BACKEND" >/dev/null 2>&1 && pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
}
trap rollback ERR

echo '=== DATABASE ==='
runuser -u postgres -- psql -d "$DB" -v ON_ERROR_STOP=1 <<'SQL'
create table if not exists public.wiener_giveaway_user_sessions(
  telegram_id bigint primary key,
  giveaway_id bigint references public.wiener_giveaways(id) on delete cascade,
  step text not null default 'idle',
  pending_wallet text,
  prompt_chat_id bigint,
  prompt_message_id bigint,
  updated_at timestamptz not null default now()
);
create index if not exists wiener_giveaway_user_sessions_gid_idx
  on public.wiener_giveaway_user_sessions(giveaway_id,updated_at);
revoke all on table public.wiener_giveaway_user_sessions from public;
SQL

echo '=== BACKEND PATCH ==='
cat >/tmp/patch-v60-giveaway-clean.py <<'PY'
from pathlib import Path
p=Path('/opt/wiener-backend/server.mjs')
s=p.read_text()
marker='// === WIENER GIVEAWAY PARTICIPATION UX V60 ==='
if marker in s:
    print('V60 already installed')
    raise SystemExit(0)
if '// === WIENER ADVANCED GIVEAWAY V59 ===' not in s:
    raise SystemExit('ERROR: V59 giveaway foundation missing')

route="\napp.use((_req,res)=>\n  res.status(404).json({ok:false,error:'route_not_enabled_yet'})\n);\n"
if route not in s:
    raise SystemExit('ERROR: final route marker not found')

code=r'''

// === WIENER GIVEAWAY PARTICIPATION UX V60 ===
const G60_BOT='WienerDogeFarmBot';
const g60esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const g60n=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
const g60kb=rows=>({inline_keyboard:rows});
const g60cb=(text,data)=>({text,callback_data:data});
const g60url=(text,url)=>({text,url});
async function g60send(chat,text,markup){return tgV10('sendMessage',{chat_id:chat,text,parse_mode:'HTML',reply_markup:markup,disable_web_page_preview:true})}
async function g60edit(q,text,markup){try{return await tgV10('editMessageText',{chat_id:q.message.chat.id,message_id:q.message.message_id,text,parse_mode:'HTML',reply_markup:markup,disable_web_page_preview:true})}catch{return g60send(q.from.id,text,markup)}}
async function g60ans(q,text='Updated',alert=false){return tgV10('answerCallbackQuery',{callback_query_id:q.id,text,show_alert:alert}).catch(()=>null)}
async function g60get(token){return (await pool.query(`select * from public.wiener_giveaways where upper(public_id)=upper($1) limit 1`,[String(token||'').trim()])).rows[0]||null}
async function g60reqs(id){return (await pool.query(`select * from public.wiener_giveaway_requirements where giveaway_id=$1 order by sort_order,id`,[id])).rows}
async function g60entry(gid,uid){return (await pool.query(`select * from public.wiener_giveaway_entries where giveaway_id=$1 and telegram_id=$2 limit 1`,[gid,uid])).rows[0]||null}
async function g60session(uid){return (await pool.query(`select * from public.wiener_giveaway_user_sessions where telegram_id=$1`,[uid])).rows[0]||null}
async function g60setSession(uid,gid,step,extra={}){await pool.query(`insert into public.wiener_giveaway_user_sessions(telegram_id,giveaway_id,step,pending_wallet,prompt_chat_id,prompt_message_id,updated_at) values($1,$2,$3,$4,$5,$6,now()) on conflict(telegram_id) do update set giveaway_id=excluded.giveaway_id,step=excluded.step,pending_wallet=excluded.pending_wallet,prompt_chat_id=excluded.prompt_chat_id,prompt_message_id=excluded.prompt_message_id,updated_at=now()`,[uid,gid,step,extra.pending_wallet||null,extra.prompt_chat_id||null,extra.prompt_message_id||null])}
async function g60clearSession(uid){await pool.query(`delete from public.wiener_giveaway_user_sessions where telegram_id=$1`,[uid])}
function g60alive(g){const now=Date.now(),start=g.starts_at?new Date(g.starts_at).getTime():0,end=g.ends_at?new Date(g.ends_at).getTime():0;if(g.status==='cancelled'||g.status==='completed'||g.status==='drawn')return false;if(start&&now<start)return false;if(end&&now>=end)return false;return ['open','scheduled','draft'].includes(String(g.status||''))}
function g60end(g){if(!g.ends_at)return 'No end time';try{return new Date(g.ends_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',day:'numeric',month:'short',hour:'numeric',minute:'2-digit'})}catch{return String(g.ends_at)}}
function g60prize(g){const t=String(g.prize_type||'wiener').toUpperCase(),a=g60n(g.prize_amount||g.total_prize);return `${a.toLocaleString(undefined,{maximumFractionDigits:9})} ${t}`}
function g60reqLabel(r){const t=String(r.requirement_type||'');const v=r.target_value!=null?g60n(r.target_value):null;const x=String(r.target_text||r.target_chat||'').trim();if(t==='join_channel'||t==='join_group')return `Join ${g60esc(r.target_chat||x)}`;if(t==='ads')return `Watch ${v||0} ads`;if(t==='tasks')return `Complete ${v||0} tasks`;if(t==='referrals')return `Invite ${v||0} valid friends`;if(t==='spins')return `Make ${v||0} spins`;if(t==='account_age')return `Account age ${v||0}+ days`;if(t==='name_contains')return `Name contains <code>${g60esc(x)}</code>`;if(t==='bio_contains')return `Bio contains <code>${g60esc(x)}</code>`;if(t==='username')return 'Telegram username required';if(t==='profile_photo')return 'Profile photo required';if(t==='daily')return 'Claim daily reward';if(t==='farm')return `Farm claims ${v||1}`;if(t==='wiener_earned')return `Earn ${v||0} WIENER`;return g60esc(r.label||t.replaceAll('_',' '))}
async function g60user(uid){return (await pool.query(`select * from public.users where telegram_id=$1 limit 1`,[uid])).rows[0]||null}
async function g60chat(uid){return tgV10('getChat',{chat_id:uid}).catch(()=>({}))}
async function g60photos(uid){return tgV10('getUserProfilePhotos',{user_id:uid,limit:1}).catch(()=>({total_count:0}))}
async function g60count(uid,r,g,u,full){
  const t=String(r.requirement_type||''),target=g60n(r.target_value),txt=String(r.target_text||'').trim();
  if(t==='join_channel'||t==='join_group'){
    const chat=r.target_chat||txt;if(!chat)return {ok:false,current:0,target:1};
    const m=await tgV10('getChatMember',{chat_id:chat,user_id:uid}).catch(()=>null),ok=!!m&&['member','administrator','creator'].includes(String(m.status));return {ok,current:ok?1:0,target:1};
  }
  if(t==='username'){const ok=!!String(full?.username||u?.username||'').trim();return {ok,current:ok?1:0,target:1}}
  if(t==='name_contains'){const name=[full?.first_name||u?.first_name||'',full?.last_name||''].join(' ').trim();const ok=!!txt&&name.toLocaleLowerCase().includes(txt.toLocaleLowerCase());return {ok,current:ok?1:0,target:1}}
  if(t==='bio_contains'){const bio=String(full?.bio||'');const ok=!!txt&&bio.toLocaleLowerCase().includes(txt.toLocaleLowerCase());return {ok,current:ok?1:0,target:1}}
  if(t==='profile_photo'){const ph=await g60photos(uid);const ok=g60n(ph.total_count)>0;return {ok,current:ok?1:0,target:1}}
  if(t==='ads'){const cur=g60n(u?.total_ads);return {ok:cur>=target,current:cur,target}}
  if(t==='referrals'){const cur=g60n(u?.active_referrals_count);return {ok:cur>=target,current:cur,target}}
  if(t==='tasks'){const q=await pool.query(`select count(*)::int c from public.task_completions where telegram_id=$1`,[uid]);const cur=g60n(q.rows[0]?.c);return {ok:cur>=target,current:cur,target}}
  if(t==='spins'){const q=await pool.query(`select count(*)::int c from public.wiener_spin_events where telegram_id=$1 and event_type in ('wiener','ton','spin')`,[uid]).catch(()=>({rows:[{c:0}]}));const cur=g60n(q.rows[0]?.c);return {ok:cur>=target,current:cur,target}}
  if(t==='account_age'){const days=u?.created_at?Math.floor((Date.now()-new Date(u.created_at).getTime())/86400000):0;return {ok:days>=target,current:days,target}}
  if(t==='wiener_earned'){const cur=g60n(u?.total_earned);return {ok:cur>=target,current:cur,target}}
  if(t==='farm'){const cur=g60n(u?.farm_sessions||u?.farm_claims_today);return {ok:cur>=Math.max(1,target),current:cur,target:Math.max(1,target)}}
  if(t==='daily'){const ok=g60n(u?.daily_streak)>0;return {ok,current:ok?1:0,target:1}}
  return {ok:true,current:1,target:1};
}
async function g60check(g,uid){
  const [reqs,u,full]=await Promise.all([g60reqs(g.id),g60user(uid),g60chat(uid)]),checks=[];
  if(!u)return {ok:false,checks:[{r:{requirement_type:'app_account',label:'Open WIENER Farm once'},ok:false,current:0,target:1}],u,full};
  if(u.is_banned)return {ok:false,blocked:true,checks:[{r:{requirement_type:'account',label:'Account eligible'},ok:false,current:0,target:1}],u,full};
  for(const r of reqs){const z=await g60count(uid,r,g,u,full);checks.push({r,...z})}
  const mandatory=checks.filter(x=>x.r.mandatory!==false),optional=checks.filter(x=>x.r.mandatory===false);
  const mandOK=mandatory.every(x=>x.ok),logic=String(g.requirement_logic||'all');let optOK=true;
  if(optional.length){optOK=logic==='any'?optional.filter(x=>x.ok).length>=Math.max(1,g60n(g.requirement_min)||1):optional.every(x=>x.ok)}
  return {ok:mandOK&&optOK,checks,u,full};
}
function g60progressLine(x){const ico=x.ok?'✅':'❌',label=g60reqLabel(x.r);if(['ads','tasks','referrals','spins','account_age','farm','wiener_earned'].includes(String(x.r.requirement_type)))return `${ico} ${label} · <b>${g60n(x.current)}/${g60n(x.target)}</b>`;return `${ico} ${label}`}
async function g60walletCandidate(uid,gid){
  const q=await pool.query(`select wallet_address from public.wiener_giveaway_wallets where telegram_id=$1 order by (giveaway_id=$2) desc,linked_at desc limit 1`,[uid,gid]);if(q.rows[0]?.wallet_address)return q.rows[0].wallet_address;
  const u=await pool.query(`select coalesce(to_jsonb(x)->>'ton_wallet',to_jsonb(x)->>'wallet_address',to_jsonb(x)->>'wallet') w from public.users x where telegram_id=$1 limit 1`,[uid]).catch(()=>({rows:[]}));
  return String(u.rows[0]?.w||'').trim()||null;
}
async function g60parseWallet(raw){try{const mod=await import('@ton/core'),a=mod.Address.parse(String(raw||'').trim());return {key:a.toRawString().toLowerCase(),friendly:a.toString({bounceable:false,testOnly:false,urlSafe:true})}}catch{return null}}
function g60shortWallet(a){a=String(a||'');return a.length<18?a:`${a.slice(0,8)}…${a.slice(-8)}`}
async function g60card(g,uid){
  const reqs=await g60reqs(g.id),e=await g60entry(g.id,uid),lines=reqs.map(r=>`• ${g60reqLabel(r)}`);
  if(g.gram_wallet_required||String(g.prize_type).toLowerCase()==='gram')lines.push('• GRAM wallet required');
  const status=e?.status==='entered'||e?.eligible?'\n\n✅ <b>You are participating.</b>':'';
  const text=`🎁 <b>${g60esc(g.title||'WIENER Giveaway')}</b>\n\n💰 Prize: <b>${g60esc(g60prize(g))}</b>\n🏆 Winners: <b>${g60n(g.winner_count)||1}</b>\n⏰ Ends: <b>${g60esc(g60end(g))}</b>\n\n<b>Requirements</b>\n${lines.length?lines.join('\n'):'• No extra requirements'}${status}`;
  const rows=[];if(g60alive(g))rows.push([g60cb(e?'🔄 CHECK STATUS':'🎁 PARTICIPATE',`g60:join:${g.id}`)]);rows.push([g60url('🌭 OPEN WIENER FARM',G59_APP)]);return {text,markup:g60kb(rows)};
}
async function g60showCheck(q,g,uid){
  const z=await g60check(g,uid),bad=z.checks.filter(x=>!x.ok);
  if(!z.ok){
    const text=`❌ <b>Complete requirements first</b>\n\n${z.checks.map(g60progressLine).join('\n')}\n\nFinish the missing items, then tap <b>CHECK AGAIN</b>.`;
    const rows=[];
    if(bad.some(x=>x.r.requirement_type==='ads'))rows.push([g60url('📺 WATCH ADS',`${G59_APP}?page=ads`)]);
    if(bad.some(x=>x.r.requirement_type==='tasks'))rows.push([g60url('✅ OPEN TASKS',`${G59_APP}?page=tasks`)]);
    if(bad.some(x=>x.r.requirement_type==='referrals'))rows.push([g60url('👥 INVITE FRIENDS',`${G59_APP}?page=invite`)]);
    if(bad.some(x=>['name_contains','bio_contains','username','profile_photo'].includes(x.r.requirement_type)))rows.push([g60url('👤 OPEN TELEGRAM PROFILE','tg://settings')]);
    rows.push([g60cb('🔄 CHECK AGAIN',`g60:join:${g.id}`),g60cb('◀️ GIVEAWAY',`g60:view:${g.id}`)]);
    await g60edit(q,text,g60kb(rows));return;
  }
  const needsWallet=g.gram_wallet_required||String(g.prize_type).toLowerCase()==='gram';
  if(needsWallet){
    const cand=await g60walletCandidate(uid,g.id),valid=cand?await g60parseWallet(cand):null;
    if(valid){
      const text=`👛 <b>Your GRAM Address</b>\n\n<code>${g60esc(valid.friendly)}</code>\n\nThis address will be saved for this giveaway if you win.`;
      await g60edit(q,text,g60kb([[g60cb('✅ USE THIS ADDRESS',`g60:walletuse:${g.id}`)],[g60cb('✏️ CHANGE ADDRESS',`g60:walletchange:${g.id}`)],[g60cb('◀️ BACK',`g60:view:${g.id}`)]]));return;
    }
    await g60setSession(uid,g.id,'await_wallet');
    await g60edit(q,`👛 <b>Add GRAM Address</b>\n\nSend your TON-compatible GRAM wallet address here.\n\nIt will only be stored after you confirm it.`,g60kb([[g60cb('❌ CANCEL',`g60:view:${g.id}`)]]));return;
  }
  await g60finishEntry(g,uid,z,null);await g60edit(q,`✅ <b>You're Participating!</b> 🎉\n\n🎁 ${g60esc(g.title)}\n✅ All requirements completed.\n\nYour giveaway entry is registered.`,g60kb([[g60cb('📊 VIEW STATUS',`g60:join:${g.id}`)],[g60cb('◀️ GIVEAWAY',`g60:view:${g.id}`)]]));
}
async function g60finishEntry(g,uid,z,wallet){
  const code=`${g.public_id}-${String(uid).slice(-5)}`;
  const progress={};for(const x of z.checks)progress[String(x.r.id||x.r.requirement_type)]={ok:x.ok,current:x.current,target:x.target};
  const q=await pool.query(`insert into public.wiener_giveaway_entries(giveaway_id,telegram_id,username,first_name,entry_code,status,eligible,eligibility_reason,progress,eligibility_snapshot,wallet_address,wallet_key,wallet_network,wallet_linked_at,checked_at) values($1,$2,$3,$4,$5,'entered',true,null,$6::jsonb,$7::jsonb,$8,$9,$10,case when $8 is null then null else now() end,now()) on conflict(giveaway_id,telegram_id) do update set username=excluded.username,first_name=excluded.first_name,status='entered',eligible=true,eligibility_reason=null,progress=excluded.progress,eligibility_snapshot=excluded.eligibility_snapshot,wallet_address=coalesce(excluded.wallet_address,public.wiener_giveaway_entries.wallet_address),wallet_key=coalesce(excluded.wallet_key,public.wiener_giveaway_entries.wallet_key),wallet_network=coalesce(excluded.wallet_network,public.wiener_giveaway_entries.wallet_network),wallet_linked_at=coalesce(excluded.wallet_linked_at,public.wiener_giveaway_entries.wallet_linked_at),checked_at=now() returning *`,[g.id,uid,z.full?.username||z.u?.username||null,z.full?.first_name||z.u?.first_name||null,code,JSON.stringify(progress),JSON.stringify({checked_at:new Date().toISOString(),requirements:z.checks.map(x=>({id:x.r.id,type:x.r.requirement_type,ok:x.ok,current:x.current,target:x.target}))}),wallet?.friendly||null,wallet?.key||null,wallet?'TON':null]);
  if(wallet)await pool.query(`insert into public.wiener_giveaway_wallets(giveaway_id,telegram_id,wallet_address,wallet_key,network,source,linked_at) values($1,$2,$3,$4,'TON','participation',now()) on conflict(giveaway_id,telegram_id) do update set wallet_address=excluded.wallet_address,wallet_key=excluded.wallet_key,network='TON',source='participation',linked_at=now()`,[g.id,uid,wallet.friendly,wallet.key]);
  await g60clearSession(uid);return q.rows[0];
}
async function g60confirmWallet(q,g,uid,raw){
  const w=await g60parseWallet(raw);if(!w){await g60ans(q,'Invalid TON/GRAM address',true);return}
  await g60setSession(uid,g.id,'confirm_wallet',{pending_wallet:w.friendly});
  await g60edit(q,`👛 <b>Confirm GRAM Address</b>\n\n<code>${g60esc(w.friendly)}</code>\n\nMake sure this address is correct.`,g60kb([[g60cb('✅ SAVE & PARTICIPATE',`g60:walletsave:${g.id}`)],[g60cb('✏️ ENTER AGAIN',`g60:walletchange:${g.id}`)],[g60cb('❌ CANCEL',`g60:view:${g.id}`)]]));
}
async function g60incomingWallet(uid,m){
  const ss=await g60session(uid);if(!ss||ss.step!=='await_wallet'||!ss.giveaway_id||!m?.text)return false;
  const g=(await pool.query(`select * from public.wiener_giveaways where id=$1`,[ss.giveaway_id])).rows[0];if(!g)return false;
  const w=await g60parseWallet(m.text);if(!w){await g60send(uid,'❌ <b>Invalid address</b>\n\nSend a valid TON-compatible GRAM wallet address.',g60kb([[g60cb('❌ CANCEL',`g60:view:${g.id}`)]]));return true}
  await tgV10('deleteMessage',{chat_id:m.chat.id,message_id:m.message_id}).catch(()=>null);
  await g60setSession(uid,g.id,'confirm_wallet',{pending_wallet:w.friendly});
  await g60send(uid,`👛 <b>Confirm GRAM Address</b>\n\n<code>${g60esc(w.friendly)}</code>\n\nMake sure this address is correct.`,g60kb([[g60cb('✅ SAVE & PARTICIPATE',`g60:walletsave:${g.id}`)],[g60cb('✏️ ENTER AGAIN',`g60:walletchange:${g.id}`)],[g60cb('❌ CANCEL',`g60:view:${g.id}`)]]));return true;
}
async function handleGiveawayUXV60(up,uid,text,m,q){
  uid=Number(q?.from?.id||m?.from?.id||uid||0);if(!uid)return false;
  if(m&&await g60incomingWallet(uid,m))return true;
  const start=String(text||'').match(/^\/start(?:@\w+)?\s+(GW[A-Za-z0-9_-]+)$/i);
  if(start){const g=await g60get(start[1]);if(!g)return false;const c=await g60card(g,uid);await g60send(uid,c.text,c.markup);return true}
  if(!q||!String(q.data||'').startsWith('g60:'))return false;
  const [_,act,id]=String(q.data).split(':'),g=(await pool.query(`select * from public.wiener_giveaways where id=$1`,[Number(id||0)])).rows[0];if(!g){await g60ans(q,'Giveaway not found',true);return true}
  if(act==='view'){await g60clearSession(uid);const c=await g60card(g,uid);await g60edit(q,c.text,c.markup);await g60ans(q);return true}
  if(!g60alive(g)){await g60ans(q,'This giveaway is closed',true);return true}
  if(act==='join'){await g60ans(q,'Checking…');await g60showCheck(q,g,uid);return true}
  if(act==='walletchange'){await g60setSession(uid,g.id,'await_wallet');await g60edit(q,'👛 <b>Send GRAM Address</b>\n\nSend your TON-compatible wallet address in this chat.',g60kb([[g60cb('❌ CANCEL',`g60:view:${g.id}`)]]));await g60ans(q);return true}
  if(act==='walletuse'){
    const raw=await g60walletCandidate(uid,g.id),w=raw?await g60parseWallet(raw):null;if(!w){await g60ans(q,'Saved address is no longer valid',true);return true}
    const z=await g60check(g,uid);if(!z.ok){await g60showCheck(q,g,uid);return true}await g60finishEntry(g,uid,z,w);await g60edit(q,`✅ <b>You're Participating!</b> 🎉\n\n🎁 ${g60esc(g.title)}\n👛 <code>${g60esc(g60shortWallet(w.friendly))}</code>\n✅ All requirements completed.`,g60kb([[g60cb('📊 VIEW STATUS',`g60:join:${g.id}`)],[g60cb('◀️ GIVEAWAY',`g60:view:${g.id}`)]]));await g60ans(q,'Entry confirmed');return true
  }
  if(act==='walletsave'){
    const ss=await g60session(uid),w=ss?.pending_wallet?await g60parseWallet(ss.pending_wallet):null;if(!w){await g60ans(q,'Enter your wallet again',true);return true}
    const z=await g60check(g,uid);if(!z.ok){await g60showCheck(q,g,uid);return true}await g60finishEntry(g,uid,z,w);await g60edit(q,`✅ <b>You're Participating!</b> 🎉\n\n🎁 ${g60esc(g.title)}\n👛 <code>${g60esc(g60shortWallet(w.friendly))}</code>\n✅ All requirements completed.`,g60kb([[g60cb('📊 VIEW STATUS',`g60:join:${g.id}`)],[g60cb('◀️ GIVEAWAY',`g60:view:${g.id}`)]]));await g60ans(q,'Wallet saved');return true
  }
  return false;
}
'''
s=s.replace(route,code+route,1)

handler="uid=Number(q?.from?.id||m?.from?.id||uid||0);text=String(m?.text||text||'').trim();\n  if(!uid&&!q)return false;"
if handler not in s:
    raise SystemExit('ERROR: current bot handler insertion point not found')
replacement=handler+"\n  try{if(await handleGiveawayUXV60(up,uid,text,m,q))return true;}catch(e){console.error('v60_giveaway_ux',String(e?.message||e));}"
s=s.replace(handler,replacement,1)
p.write_text(s)
print('V60 clean giveaway participation patch installed')
PY

python3 /tmp/patch-v60-giveaway-clean.py
node --check "$BACKEND"

echo '=== RESTART ==='
pm2 restart wiener-api --update-env
sleep 3
curl -fsS http://127.0.0.1:3000/health || curl -fsS http://127.0.0.1:3000/
echo
pm2 save >/dev/null

echo '=== VERIFY ==='
grep -q 'WIENER GIVEAWAY PARTICIPATION UX V60' "$BACKEND"
runuser -u postgres -- psql -d "$DB" -Atqc "select count(*)||' user_session_table' from information_schema.tables where table_schema='public' and table_name='wiener_giveaway_user_sessions';"
echo '=== V60 READY ==='
trap - ERR
