from pathlib import Path

p = Path("/opt/wiener-backend/server.mjs")
s = p.read_text()
TAG = "WIENER SPONSORED MINI APP V37"

if TAG in s:
    print("V37 sponsored Mini App already installed")
    raise SystemExit(0)

for need in ["WIENER SPONSORED TON PAYMENT FIX V29","WIENER SPONSORED TASK MANAGER V30","WIENER ADDTASK V35B","async function verifySponsoredTargetV10B","async function showAddtask18"]:
    if need not in s:
        raise SystemExit("ERROR: required backend feature missing: " + need)

mini_code = r"""function sponsoredMiniTargetV37(raw){
  const input=String(raw||'').trim();
  let u;try{u=new URL(input)}catch{throw new Error('invalid_mini_app_link')}
  if(u.protocol!=='https:'||String(u.hostname||'').toLowerCase()!=='t.me')throw new Error('telegram_mini_app_link_required');
  const parts=u.pathname.split('/').filter(Boolean);
  if(parts.length<1||parts.length>2)throw new Error('invalid_mini_app_link');
  const bot=String(parts[0]||''),shortName=String(parts[1]||'');
  if(!/^[A-Za-z0-9_]{5,32}$/.test(bot))throw new Error('invalid_bot_username');
  if(shortName&&!/^[A-Za-z0-9_]{1,64}$/.test(shortName))throw new Error('invalid_mini_app_short_name');
  const hasStart=u.searchParams.has('startapp');
  if(!shortName&&!hasStart)throw new Error('mini_app_deep_link_required');
  for(const key of u.searchParams.keys())if(key!=='startapp')throw new Error('unsupported_mini_app_parameter');
  const payload=u.searchParams.get('startapp')||'';
  if(payload&&!/^[A-Za-z0-9._~-]{1,512}$/.test(payload))throw new Error('invalid_startapp_payload');
  const canonical='https://t.me/'+bot+(shortName?'/'+shortName:'')+(hasStart?'?startapp='+encodeURIComponent(payload):'');
  return{ref:canonical,chat:null,title:'@'+bot+(shortName?' / '+shortName:''),url:canonical,bot_username:bot,short_name:shortName||null,startapp:payload||null};
}
// === WIENER SPONSORED MINI APP V37 ===
"""
needle = "async function verifySponsoredTargetV10B(kind,raw){"
if needle not in s:
    raise SystemExit("ERROR: target validator not found")
s = s.replace(needle, mini_code + "\nasync function verifySponsoredTargetV10B(kind,raw){if(String(kind||'').toLowerCase()==='mini_app')return sponsoredMiniTargetV37(raw);", 1)

old_task = """else task=(await db.query(`insert into public.tasks(title,description,category,task_type,reward,url,telegram_chat_id,verification,is_daily,enabled,sponsored_order_id,max_completions,completed_count,user_created) values($1,$2,'official','telegram',$3,$4,$5,'telegram_member',false,true,$6,$7,0,true) returning id`,[o.title,`Sponsored task · ${o.target_completions} verified members`,o.reward_per_completion,o.target_url,o.target_ref,o.id,o.target_completions])).rows[0].id;"""
new_task = """else{
        const mini=String(o.task_kind||'')==='mini_app';
        task=(await db.query(`insert into public.tasks(title,description,category,task_type,reward,url,telegram_chat_id,verification,is_daily,enabled,sponsored_order_id,max_completions,completed_count,user_created) values($1,$2,'official',$3,$4,$5,$6,$7,false,true,$8,$9,0,true) returning id`,[
          o.title,
          mini?'Sponsored Mini App · Launch Tracked · stay at least 15 seconds, then return and tap CHECK':`Sponsored task · ${o.target_completions} verified members`,
          mini?'mini_app':'telegram',
          o.reward_per_completion,
          o.target_url,
          mini?null:o.target_ref,
          mini?'external_visit':'telegram_member',
          o.id,
          o.target_completions
        ])).rows[0].id;
      }"""
if old_task not in s:
    raise SystemExit("ERROR: V29 sponsored task activation line not found")
s = s.replace(old_task, new_task, 1)

old_order = "[uid,`Join ${target.title}`,b.kind,target.chat,target.url,expected,count,reward,t.address,memo,gross,count*reward,worker,profit,usd,exp]"
new_order = "[uid,String(b.kind||'')==='mini_app'?`Open ${target.title} Mini App`:`Join ${target.title}`,b.kind,target.ref||target.chat,target.url,expected,count,reward,t.address,memo,gross,count*reward,worker,profit,usd,exp]"
if old_order not in s:
    raise SystemExit("ERROR: sponsored order creation values not found")
s = s.replace(old_order, new_order, 1)

old_type = "if(s.step==='type')return edit('📣 Create Sponsored Task\\n\\nYour task appears in Official Tasks after TON payment.\\n💵 Fixed price: $0.30 / 100 completions',kb18([[cb18('📢 Channel','at:t:channel'),cb18('👥 Group','at:t:group')],[cb18('❌ Cancel','at:x')]]));"
new_type = "if(s.step==='type')return edit('📣 CREATE SPONSORED TASK\\n\\nChoose what you want to promote.\\n\\n💵 100 completions = $0.30\\n💎 Payment: TON',kb18([[cb18('📢 CHANNEL','at:t:channel'),cb18('👥 GROUP','at:t:group')],[cb18('🚀 MINI APP','at:t:mini_app')],[cb18('❌ CANCEL','at:x')]]));"
if old_type not in s:
    raise SystemExit("ERROR: addtask type screen not found")
s = s.replace(old_type, new_type, 1)

old_target = "if(s.step==='target')return edit('🔗 Send the public @username or t.me link.\\n\\nThe WIENER bot must be admin so joins can be verified.',kb18([[cb18('❌ Cancel','at:x')]]));"
new_target = """if(s.step==='target')return s.task_kind==='mini_app'
    ?edit('🚀 MINI APP LINK\\n\\nSend a Telegram Mini App deep link.\\n\\nExamples:\\nhttps://t.me/BotName/app\\nhttps://t.me/BotName?startapp=campaign\\n\\n✅ Launch Tracked · 15 second visit\\nNo bot-admin permission required.',kb18([[cb18('◀️ BACK','at:b:type'),cb18('❌ CANCEL','at:x')]]))
    :edit('🔗 Send the public @username or t.me link.\\n\\n@WienerDogeFarmBot must be admin so joins can be verified.',kb18([[cb18('◀️ BACK','at:b:type'),cb18('❌ CANCEL','at:x')]]));"""
if old_target not in s:
    raise SystemExit("ERROR: addtask target screen not found")
s = s.replace(old_target, new_target, 1)

handler = r"""async function handleSponsoredMiniTargetV37(up,uid,text,m,q){
  uid=Number(q?.from?.id||m?.from?.id||uid||0);
  text=String(m?.text||text||'').trim();
  if(!uid||!m||m.chat?.type!=='private'||!text||text.startsWith('/'))return false;
  const a=await addtaskSession18(uid).catch(()=>null);
  if(!a||a.step!=='target'||a.task_kind!=='mini_app')return false;
  try{
    const v=await verifySponsoredTargetV10B('mini_app',text);
    await safeTg18('deleteMessage',{chat_id:uid,message_id:m.message_id});
    const z=await setAddtask18(uid,{target_ref:v.ref,target_chat_id:null,target_url:v.url,title:'Open '+v.title+' Mini App',step:'count'});
    await showAddtask18(z);
  }catch(e){
    await safeTg18('sendMessage',{chat_id:uid,text:'⚠️ '+String(e?.message||e).replace(/_/g,' ')+'\\n\\nSend a valid Mini App link, for example:\\nhttps://t.me/BotName/app'});
  }
  return true;
}
"""
marker = "\napp.use((_req,res)=>\n  res.status(404).json({ok:false,error:'route_not_enabled_yet'})\n);\n"
if marker not in s:
    raise SystemExit("ERROR: fallback marker missing")
s = s.replace(marker, "\n" + handler + marker, 1)

hook = "    try{if(await handleSponsoredTaskManagerV30(up,uid,text,m,q)) return done();}catch(e){console.error('v30_sponsored_manager',String(e?.message||e));}\n"
if hook not in s:
    raise SystemExit("ERROR: V30 webhook hook not found")
s = s.replace(hook, "    try{if(await handleSponsoredMiniTargetV37(up,uid,text,m,q)) return done();}catch(e){console.error('v37_sponsored_mini',String(e?.message||e));}\n" + hook, 1)

p.write_text(s)
print("V37 installed: Channel + Group + Mini App sponsored tasks")
