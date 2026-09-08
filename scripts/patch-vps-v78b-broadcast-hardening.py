from pathlib import Path

p=Path('/opt/wiener-backend/server.mjs')
s=p.read_text()
TAG='WIENER ADVANCED BROADCAST CENTER V78B HARDENING'
if TAG in s:
    print('V78B broadcast hardening already installed')
    raise SystemExit(0)
if 'WIENER ADVANCED BROADCAST CENTER V78' not in s:
    raise SystemExit('ERROR: V78 broadcast center not installed')

old="""  const hash=`v78:${admin}:${Date.now()}:${Math.random()}`;
  const br=(await pool.query(`insert into public.admin_broadcasts(admin_id,message,audience,status,total_targets,sent_count,failed_count,skipped_count,created_at,message_hash,media_kind,source_chat_id,source_message_id,private_targets,group_targets,channel_targets) values($1,$2,$3,'draft',$4,0,0,0,now(),encode(digest($5,'sha256'),'hex'),$6,$7,$8,$9,$10,$11) returning *`,[admin,message,aud,targets.length,hash,media_kind,source_chat_id,source_message_id,n.private,n.groups,n.channels])).rows[0];
  await pool.query(`insert into public.admin_broadcast_jobs_v78(broadcast_id,admin_id,state,audience,filter_key,media_kind,source_chat_id,source_message_id,buttons,created_at,updated_at) values($1,$2,'preparing',$3,$4,$5,$6,$7,'[]'::jsonb,now(),now())`,[br.id,admin,aud,filter,media_kind,source_chat_id,source_message_id]);
  for(const t of targets)await pool.query(`insert into public.admin_broadcast_deliveries_v78(broadcast_id,telegram_id,chat_type,status,attempts,updated_at) values($1,$2,$3,'pending',0,now()) on conflict(broadcast_id,telegram_id) do nothing`,[br.id,t.id,t.kind]);
"""
new="""  const hash=`v78:${admin}:${Date.now()}:${Math.random()}`;
  const storedMessage=String(message||'').trim()||(media_kind?`[MEDIA:${media_kind}]`:'[EMPTY BROADCAST]');
  const br=(await pool.query(`insert into public.admin_broadcasts(admin_id,message,audience,status,total_targets,sent_count,failed_count,skipped_count,created_at,message_hash,media_kind,source_chat_id,source_message_id,private_targets,group_targets,channel_targets) values($1,$2,$3,'draft',$4,0,0,0,now(),encode(digest($5,'sha256'),'hex'),$6,$7,$8,$9,$10,$11) returning *`,[admin,storedMessage,aud,targets.length,hash,media_kind,source_chat_id,source_message_id,n.private,n.groups,n.channels])).rows[0];
  await pool.query(`insert into public.admin_broadcast_jobs_v78(broadcast_id,admin_id,state,audience,filter_key,media_kind,source_chat_id,source_message_id,buttons,created_at,updated_at) values($1,$2,'preparing',$3,$4,$5,$6,$7,'[]'::jsonb,now(),now())`,[br.id,admin,aud,filter,media_kind,source_chat_id,source_message_id]);
  if(targets.length)await pool.query(`
    insert into public.admin_broadcast_deliveries_v78(broadcast_id,telegram_id,chat_type,status,attempts,updated_at)
    select $1,x.telegram_id,x.chat_type,'pending',0,now()
    from unnest($2::bigint[],$3::text[]) as x(telegram_id,chat_type)
    on conflict(broadcast_id,telegram_id) do nothing
  `,[br.id,targets.map(t=>t.id),targets.map(t=>t.kind)]);
"""
if old not in s:
    raise SystemExit('ERROR: V78 draft/target block anchor missing')
s=s.replace(old,new,1)

# Add 3-day and new-user audience filters using fields already used by Wiener bot code.
s=s.replace(
"if(f==='active1')return 'Private · active 24h';if(f==='active7')return 'Private · active 7d';if(f==='active30')return 'Private · active 30d';",
"if(f==='active1')return 'Private · active 24h';if(f==='active3')return 'Private · active 3d';if(f==='active7')return 'Private · active 7d';if(f==='active30')return 'Private · active 30d';if(f==='new1')return 'Private · joined 24h';if(f==='new7')return 'Private · joined 7d';",
1)
s=s.replace(
"if(f==='active1')where+=` and last_active>=now()-interval '1 day'`;\n    else if(f==='active7')where+=` and last_active>=now()-interval '7 days'`;",
"if(f==='active1')where+=` and last_active>=now()-interval '1 day'`;\n    else if(f==='active3')where+=` and last_active>=now()-interval '3 days'`;\n    else if(f==='active7')where+=` and last_active>=now()-interval '7 days'`;\n    else if(f==='new1')where+=` and created_at>=now()-interval '1 day'`;\n    else if(f==='new7')where+=` and created_at>=now()-interval '7 days'`;",
1)
s=s.replace(
"[cb18('⚡ ACTIVE 24H','bc78:flt:active1'),cb18('🔥 ACTIVE 7D','bc78:flt:active7')],[cb18('📅 ACTIVE 30D','bc78:flt:active30'),cb18('💤 INACTIVE 7D+','bc78:flt:inactive7')]",
"[cb18('⚡ ACTIVE 24H','bc78:flt:active1'),cb18('⚡ ACTIVE 3D','bc78:flt:active3')],[cb18('🔥 ACTIVE 7D','bc78:flt:active7'),cb18('📅 ACTIVE 30D','bc78:flt:active30')],[cb18('🆕 JOINED 24H','bc78:flt:new1'),cb18('🆕 JOINED 7D','bc78:flt:new7')],[cb18('💤 INACTIVE 7D+','bc78:flt:inactive7')]",
1)

# Opening Broadcast Center should also discard any stale local media pointer from an unfinished setup.
s=s.replace(
"await bc78SetSession(admin,{step:'bc78_audience',audience_v78:'all',filter_v78:null,broadcast_id_v78:null});",
"await bc78SetSession(admin,{step:'bc78_audience',audience_v78:'all',filter_v78:null,broadcast_id_v78:null,source_chat_id:null,source_message_id:null,media_kind:null});",
1)

# Hard-enforce admin access even if the shared helper ever returns false instead of throwing.
s=s.replace(
"async function broadcastStart78(admin){return bc78Home(admin)}",
"async function broadcastStart78(admin){if(!(await adm18(admin)))throw new Error('admin_required');return bc78Home(admin)}",
1)
s=s.replace(
"const d=String(q?.data||'');if(!d.startsWith('bc78:'))return false;await adm18(admin);const z=d.split(':')",
"const d=String(q?.data||'');if(!d.startsWith('bc78:'))return false;if(!(await adm18(admin)))return false;const z=d.split(':')",
1)
s=s.replace(
"async function bc78Command(admin,cmd){\n  await adm18(admin);",
"async function bc78Command(admin,cmd){\n  if(!(await adm18(admin)))throw new Error('admin_required');",
1)

# Marker for installer verification.
s=s.replace('// === WIENER ADVANCED BROADCAST CENTER V78 ===', '// === WIENER ADVANCED BROADCAST CENTER V78 ===\n// === WIENER ADVANCED BROADCAST CENTER V78B HARDENING ===',1)
p.write_text(s)
print('V78B broadcast hardening installed')
