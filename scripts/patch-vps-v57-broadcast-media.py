from pathlib import Path

p=Path('/opt/wiener-backend/server.mjs')
s=p.read_text()
marker='// === WIENER BROADCAST MEDIA V57 ==='
if marker in s:
    print('V57 already installed')
    raise SystemExit(0)

anchor="async function broadcastText18(id,text){const br=await postLocalV10B('wiener-broadcast-run',{action:'create',admin_id:id,message:text});await pool.query(`update public.admin_broadcast_sessions set step='preview',draft_message=$2,updated_at=now() where admin_id=$1`,[id,text]);await safeTg18('sendMessage',{chat_id:id,text:`📣 BROADCAST PREVIEW\\n\\n${text}\\n\\n👥 Audience: ${n18(br.total_targets)} reachable targets\\n\\nNothing has been sent yet.`,reply_markup:kb18([[cb18('✅ SEND NOW',`bc:send:${br.id}`)],[cb18('❌ CANCEL',`bc:cancel:${br.id}`)]])})}"
if anchor not in s:
    raise SystemExit('ERROR: broadcastText18 anchor not found')

code=r'''

// === WIENER BROADCAST MEDIA V57 ===
const BROADCAST_APP_URL_V57='https://t.me/WienerDogeFarmBot/app';
function broadcastOpenMarkupV57(){return {inline_keyboard:[[{text:'🌭 OPEN WIENER FARM',url:BROADCAST_APP_URL_V57}]]}}
function broadcastMediaKindV57(m){if(Array.isArray(m?.photo)&&m.photo.length)return 'photo';if(m?.video)return 'video';if(m?.animation)return 'animation';if(m?.document)return 'document';return null}
async function broadcastTargetsV57(){
  const [users,chats]=await Promise.all([
    pool.query(`select telegram_id from public.users where is_banned=false`),
    pool.query(`select chat_id,chat_type from public.bot_chats where active=true and can_post=true`)
  ]);
  const out=[],seen=new Set();
  for(const x of users.rows){const id=Number(x.telegram_id);if(id&&!seen.has(id)){seen.add(id);out.push({id,kind:'user'})}}
  for(const x of chats.rows){const id=Number(x.chat_id);if(id&&!seen.has(id)){seen.add(id);out.push({id,kind:String(x.chat_type||'chat')})}}
  return out;
}
async function broadcastMedia18(id,m){
  await adm18(id);
  const kind=broadcastMediaKindV57(m);
  if(!kind)throw new Error('unsupported_broadcast_media');
  if(m.media_group_id){await safeTg18('sendMessage',{chat_id:id,text:'⚠️ Please send one photo/video/GIF/document at a time for broadcast preview.'});return}
  const targets=await broadcastTargetsV57();
  await pool.query(`update public.admin_broadcast_sessions set step='media_preview',draft_message=null,source_chat_id=$2,source_message_id=$3,media_kind=$4,updated_at=now() where admin_id=$1`,[id,Number(m.chat.id),Number(m.message_id),kind]);
  await tgV10('copyMessage',{chat_id:id,from_chat_id:Number(m.chat.id),message_id:Number(m.message_id),reply_markup:broadcastOpenMarkupV57()});
  await safeTg18('sendMessage',{chat_id:id,text:`📣 BROADCAST PREVIEW\\n\\nMedia: ${kind.toUpperCase()}${m.caption?' + caption':''}\\n👥 Audience: ${targets.length} reachable targets\\n\\nNothing has been sent yet.`,reply_markup:kb18([[cb18('✅ SEND NOW','bcm:send')],[cb18('❌ CANCEL','bcm:cancel')]])});
}
async function broadcastMediaSendV57(id){
  await adm18(id);
  const bs=await broadcastSession18(id);
  if(!bs||bs.step!=='media_preview'||!bs.source_chat_id||!bs.source_message_id)throw new Error('broadcast_media_preview_missing');
  await pool.query(`update public.admin_broadcast_sessions set step='media_sending',updated_at=now() where admin_id=$1 and step='media_preview'`,[id]);
  const targets=await broadcastTargetsV57();
  let users=0,chats=0,failed=0;
  for(const t of targets){
    try{
      await tgV10('copyMessage',{chat_id:t.id,from_chat_id:Number(bs.source_chat_id),message_id:Number(bs.source_message_id),reply_markup:broadcastOpenMarkupV57()});
      t.kind==='user'?users++:chats++;
    }catch(e){failed++;console.error('v57_broadcast_copy',t.id,String(e?.message||e))}
    await sleepV10(45);
  }
  await pool.query(`update public.admin_broadcast_sessions set step='idle',source_chat_id=null,source_message_id=null,media_kind=null,updated_at=now() where admin_id=$1`,[id]);
  await safeTg18('sendMessage',{chat_id:id,text:`✅ Broadcast completed\\n\\n👤 Users: ${users}\\n💬 Groups/Channels: ${chats}\\n❌ Failed: ${failed}\\n📨 Total: ${users+chats}`});
  return {users,chats,failed};
}
async function broadcastMediaCallbackV57(id,q){
  const data=String(q?.data||'');
  if(!data.startsWith('bcm:'))return false;
  await adm18(id);
  const act=data.split(':')[1];
  if(act==='cancel'){
    await pool.query(`update public.admin_broadcast_sessions set step='idle',draft_message=null,source_chat_id=null,source_message_id=null,media_kind=null,updated_at=now() where admin_id=$1`,[id]);
    await tgV10('answerCallbackQuery',{callback_query_id:q.id,text:'Broadcast cancelled'}).catch(()=>null);
    await safeTg18('sendMessage',{chat_id:id,text:'❌ Broadcast cancelled. Nothing was sent.'});
    return true;
  }
  if(act==='send'){
    await tgV10('answerCallbackQuery',{callback_query_id:q.id,text:'Broadcast started'}).catch(()=>null);
    await safeTg18('sendMessage',{chat_id:id,text:'📤 Media broadcast started. Delivery will continue from the VPS.'});
    void broadcastMediaSendV57(id).catch(async e=>{console.error('v57_broadcast_send',String(e?.message||e));await safeTg18('sendMessage',{chat_id:id,text:`⚠️ Broadcast stopped: ${String(e?.message||e)}`}).catch(()=>null)});
    return true;
  }
  return false;
}
'''
s=s.replace(anchor,anchor+code,1)

handler="uid=Number(q?.from?.id||m?.from?.id||uid||0);text=String(m?.text||text||'').trim();\n  if(!uid&&!q)return false;"
if handler not in s:
    raise SystemExit('ERROR: handleBotFullV18 insertion point not found')
replacement="""uid=Number(q?.from?.id||m?.from?.id||uid||0);text=String(m?.text||text||'').trim();
  if(!uid&&!q)return false;
  if(q&&String(q.data||'').startsWith('bcm:')){if(await broadcastMediaCallbackV57(uid,q))return true;}
  if(m?.chat?.type==='private'&&broadcastMediaKindV57(m)){
    const bs57=await broadcastSession18(uid).catch(()=>null);
    if(bs57?.step==='awaiting_message'){await broadcastMedia18(uid,m);return true;}
  }"""
s=s.replace(handler,replacement,1)

p.write_text(s)
print('V57 broadcast media patch installed')
