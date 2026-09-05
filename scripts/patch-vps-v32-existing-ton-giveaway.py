from pathlib import Path
import os,re

p=Path(os.environ.get("WIENER_BACKEND_FILE","/opt/wiener-backend/server.mjs"))
if not p.exists():
    p=Path("/opt/wiener-backend/server.js")
s=p.read_text()
if "WIENER EXISTING TON GIVEAWAY V32" in s:
    print("V32 already installed")
    raise SystemExit(0)
if "async function handleBotFullV18" not in s:
    raise SystemExit("ERROR: V18 bot handler missing")
marker="\napp.use((_req,res)=>\n  res.status(404).json({ok:false,error:'route_not_enabled_yet'})\n);\n"
if marker not in s:
    raise SystemExit("ERROR: insertion marker missing")

code=r'''
// === WIENER EXISTING TON GIVEAWAY V32 ===
function gvN32(v){const n=Number(v);return Number.isFinite(n)?n:0}
function gvH32(v){return crypto.createHash("sha256").update(String(v)).digest("hex")}
function gvS32(v,n=22){v=String(v||"");return v.length<=n?v:v.slice(0,n-7)+"…"+v.slice(-6)}
async function gvWallet32(raw){
  const mod=await import("@ton/core"),a=mod.Address.parse(String(raw||"").trim());
  return {key:a.toRawString().toLowerCase(),friendly:a.toString({bounceable:false,testOnly:false,urlSafe:true})}
}
async function gvWalletText32(text){
  const a=String(text||"").match(/[A-Za-z0-9_:\-]{40,90}/g)||[];
  for(const x of a){try{return await gvWallet32(x)}catch{}}
  return null
}
function gvLink32(raw){
  const x=String(raw||"").trim();
  let m=x.match(/(?:https?:\/\/)?t\.me\/c\/(\d+)\/(\d+)/i);
  if(m)return {chat:Number("-100"+m[1]),msg:Number(m[2]),url:"https://t.me/c/"+m[1]+"/"+m[2]};
  m=x.match(/(?:https?:\/\/)?t\.me\/([A-Za-z0-9_]{4,})\/(\d+)/i);
  if(!m)throw new Error("invalid_post_link");
  return {chat:"@"+m[1],msg:Number(m[2]),url:"https://t.me/"+m[1]+"/"+m[2]}
}
async function gvGet32(id){
  const q=id
    ? await pool.query("select * from public.wiener_external_giveaways where id=$1 or public_id=$1 limit 1",[String(id)])
    : await pool.query("select * from public.wiener_external_giveaways order by imported_at desc limit 1");
  return q.rows[0]||null
}
async function gvAdd32(g,uid,username,w,chat,msg,source){
  uid=Number(uid||0);if(!uid||!w)return false;
  if((await pool.query("select 1 from public.admins where telegram_id=$1 and enabled=true limit 1",[uid])).rows.length)return false;
  if((await pool.query("select is_banned from public.users where telegram_id=$1 limit 1",[uid])).rows[0]?.is_banned)return false;
  const q=await pool.query(
    "insert into public.wiener_external_giveaway_entries(giveaway_id,telegram_id,username,wallet,wallet_key,source_chat_id,source_message_id,source,eligible) values($1,$2,$3,$4,$5,$6,$7,$8,true) on conflict do nothing returning id",
    [g.id,uid,username||null,w.friendly,w.key,chat||null,msg||null,source||"comment"]
  );
  return q.rowCount>0
}
function gvOrigin32(m){
  const r=m?.reply_to_message,o=r?.forward_origin;
  if(o?.type==="channel"&&o?.chat?.id&&o?.message_id)return {chat:Number(o.chat.id),msg:Number(o.message_id)};
  if(r?.forward_from_chat?.id&&r?.forward_from_message_id)return {chat:Number(r.forward_from_chat.id),msg:Number(r.forward_from_message_id)};
  return null
}
async function gvPassive32(up,m){
  const rc=up?.message_reaction_count;
  if(rc?.chat?.id&&rc.message_id){
    const n=(rc.reactions||[]).reduce((z,x)=>z+gvN32(x.total_count),0);
    await pool.query("update public.wiener_external_giveaways set reaction_count=$3,updated_at=now() where source_chat_id=$1 and source_message_id=$2",[Number(rc.chat.id),Number(rc.message_id),n]).catch(()=>null)
  }
  if(!m||m.chat?.type==="private"||m.from?.is_bot)return;
  const o=gvOrigin32(m);if(!o)return;
  const g=(await pool.query("select * from public.wiener_external_giveaways where source_chat_id=$1 and source_message_id=$2 and discussion_chat_id=$3 and status='collecting' limit 1",[o.chat,o.msg,Number(m.chat.id)])).rows[0];
  if(!g)return;
  const w=await gvWalletText32(m.text||m.caption||"");
  if(w)await gvAdd32(g,m.from.id,m.from.username,w,m.chat.id,m.message_id,"comment")
}
async function gvImport32(admin,link){
  await adm18(admin);
  const z=gvLink32(link),chat=await tgV10("getChat",{chat_id:z.chat}),discussion=Number(chat.linked_chat_id||0);
  if(!discussion)throw new Error("channel_has_no_linked_discussion");
  const me=await tgV10("getMe",{}),bm=await tgV10("getChatMember",{chat_id:discussion,user_id:me.id}).catch(()=>null);
  if(!bm||!["member","administrator","creator"].includes(String(bm.status)))throw new Error("add_wiener_bot_to_discussion_group");
  const old=(await pool.query("select * from public.wiener_external_giveaways where source_chat_id=$1 and source_message_id=$2 limit 1",[Number(chat.id),z.msg])).rows[0];
  if(old)return old;
  const id=crypto.randomUUID(),pub="GW"+Date.now().toString(36).toUpperCase(),lockId=crypto.randomUUID();
  return (await pool.query(
    "insert into public.wiener_external_giveaways(id,public_id,admin_id,source_chat_id,source_chat_username,source_message_id,source_post_url,discussion_chat_id,winner_count,prize_ton,reaction_target,status,payout_state,signer_lock_id) values($1,$2,$3,$4,$5,$6,$7,$8,3,0.05,50,'collecting','not_started',$9) returning *",
    [id,pub,admin,Number(chat.id),chat.username?"@"+chat.username:null,z.msg,z.url,discussion,lockId]
  )).rows[0]
}
async function gvRows32(g){
  const e=await pool.query("select count(*)::int c from public.wiener_external_giveaway_entries e left join public.users u on u.telegram_id=e.telegram_id where e.giveaway_id=$1 and e.eligible=true and coalesce(u.is_banned,false)=false and not exists(select 1 from public.admins a where a.telegram_id=e.telegram_id and a.enabled=true)",[g.id]);
  const w=await pool.query("select * from public.wiener_external_giveaway_winners where giveaway_id=$1 order by draw_rank",[g.id]);
  return {entries:Number(e.rows[0]?.c||0),w:w.rows}
}
async function gvCard32(id){
  const g=await gvGet32(id);if(!g)return {text:"🎁 No imported giveaway.\nUse /giveaway_import <post link>",markup:kb18([])};
  const r=await gvRows32(g),wins=r.w.filter(x=>x.kind==="winner"),res=r.w.filter(x=>x.kind==="reserve");
  let t="🎁 0.05 GRAM GIVEAWAY\n\nID: "+g.public_id+"\n🏆 3 Winners\n💎 0.05 GRAM each\n❤️ Reactions: "+Number(g.reaction_count||0)+"/50"+(g.target_confirmed_at?" · confirmed":"")+"\n👥 Unique eligible: "+r.entries+"\n📌 "+String(g.status).toUpperCase()+"\n💳 "+String(g.payout_state).toUpperCase();
  if(wins.length)t+="\n\n🏆 WINNERS\n"+wins.map(x=>x.winner_slot+". "+(x.username?"@"+x.username:"UID "+x.telegram_id)+" · "+gvS32(x.wallet)+" · "+x.payout_status).join("\n");
  if(res.length)t+="\n\n🛟 RESERVES\n"+res.map(x=>(x.username?"@"+x.username:"UID "+x.telegram_id)+" · "+gvS32(x.wallet)).join("\n");
  const b=[];
  if(g.status==="collecting"){
    if(!g.target_confirmed_at&&Number(g.reaction_count||0)<50)b.push([cb18("✅ CONFIRM 50 REACTIONS","gv32:target:"+g.id)]);
    b.push([cb18("🎲 DRAW 3 UNIQUE WINNERS","gv32:draw:"+g.id)]);
    b.push([cb18("🔄 REFRESH","gv32:show:"+g.id)])
  }else if(g.status==="drawn"&&!["paid","broadcasting","submitted","reconcile_required"].includes(String(g.payout_state))){
    b.push([cb18("💎 REVIEW PAY 0.15 GRAM","gv32:prepay:"+g.id)]);
    b.push([cb18("🔐 DRAW AUDIT","gv32:audit:"+g.id)])
  }
  if(["broadcasting","submitted","reconcile_required"].includes(String(g.payout_state)))b.push([cb18("🔄 RECONCILE TON","gv32:recon:"+g.id)]);
  return {text:t,markup:kb18(b)}
}
async function gvDraw32(admin,id){
  await adm18(admin);const c=await pool.connect();
  try{
    await c.query("begin");
    const g=(await c.query("select * from public.wiener_external_giveaways where id=$1 for update",[id])).rows[0];
    if(!g)throw new Error("giveaway_not_found");
    if(g.status!=="collecting"){await c.query("rollback");return}
    if(!g.target_confirmed_at&&Number(g.reaction_count||0)<50)throw new Error("reaction_target_not_confirmed");
    const a=(await c.query("select e.* from public.wiener_external_giveaway_entries e left join public.users u on u.telegram_id=e.telegram_id where e.giveaway_id=$1 and e.eligible=true and coalesce(u.is_banned,false)=false and not exists(select 1 from public.admins x where x.telegram_id=e.telegram_id and x.enabled=true) order by e.telegram_id,e.wallet_key",[id])).rows;
    if(a.length<3)throw new Error("need_at_least_3_unique_entries");
    const snap=a.map(x=>x.id+"|"+x.telegram_id+"|"+x.wallet_key).join("\n"),sh=gvH32(snap),seed=crypto.randomBytes(32).toString("hex");
    const ranked=a.map(x=>({x,k:gvH32(seed+":"+sh+":"+x.id+":"+x.wallet_key)})).sort((x,y)=>x.k.localeCompare(y.k)).slice(0,Math.min(5,a.length));
    for(let i=0;i<ranked.length;i++){
      const x=ranked[i].x,win=i<3;
      await c.query("insert into public.wiener_external_giveaway_winners(giveaway_id,entry_id,draw_rank,winner_slot,kind,telegram_id,username,wallet,wallet_key,prize_ton,payout_status) values($1,$2,$3,$4,$5,$6,$7,$8,$9,0.05,$10)",[id,x.id,i+1,win?i+1:null,win?"winner":"reserve",x.telegram_id,x.username,x.wallet,x.wallet_key,win?"pending":"reserve"])
    }
    await c.query("update public.wiener_external_giveaways set status='drawn',draw_seed=$2,snapshot_hash=$3,entry_count=$4,drawn_at=now(),updated_at=now() where id=$1",[id,seed,sh,a.length]);
    await c.query("commit")
  }catch(e){await c.query("rollback").catch(()=>null);throw e}finally{c.release()}
}
async function gvTon32(){
  const mn=String(process.env.WIENER_TON_PAYOUT_MNEMONIC||"").trim();if(mn.split(/\s+/).length<12)throw new Error("ton_treasury_not_configured");
  const endpoint=String(process.env.WIENER_TON_RPC_URL||"https://toncenter.com/api/v2/jsonRPC"),apiKey=String(process.env.WIENER_TON_API_KEY||"");
  const a=await Promise.all([import("@ton/ton"),import("@ton/crypto")]),Ton=a[0],Crypto=a[1],kp=await Crypto.mnemonicToPrivateKey(mn.split(/\s+/)),wc=Ton.WalletContractV4.create({workchain:0,publicKey:kp.publicKey}),client=new Ton.TonClient({endpoint,apiKey:apiKey||undefined}),contract=client.open(wc),balance=await contract.getBalance();
  return {kp,wc,client,contract,balance,address:wc.address.toString({bounceable:false,urlSafe:true,testOnly:false})}
}
async function gvPre32(admin,id){
  await adm18(admin);const g=await gvGet32(id);if(!g||g.status!=="drawn")throw new Error("giveaway_not_drawn");
  if(g.payout_state==="paid")throw new Error("already_paid");
  if(["broadcasting","submitted","reconcile_required"].includes(String(g.payout_state)))throw new Error("reconcile_existing_submission_first");
  const w=(await pool.query("select * from public.wiener_external_giveaway_winners where giveaway_id=$1 and kind='winner' order by winner_slot",[id])).rows;
  if(w.length!==3)throw new Error("winner_set_incomplete");
  for(const x of w)await gvWallet32(x.wallet);
  const tw=await gvTon32(),bal=Number(tw.balance)/1e9;if(bal<0.20)throw new Error("treasury_balance_below_0_20_ton");
  return {g,w,tw,balance:bal}
}
async function gvFinish32(g,w,tx){
  const hash=tx.hash().toString("hex"),url="https://tonviewer.com/transaction/"+hash;
  await pool.query("update public.wiener_external_giveaways set status='paid',payout_state='paid',payout_tx_hash=$2,payout_explorer_url=$3,paid_at=now(),payout_error=null,updated_at=now() where id=$1",[g.id,hash,url]);
  await pool.query("update public.wiener_external_giveaway_winners set payout_status='paid',tx_hash=$2,explorer_url=$3,confirmed_at=now(),error=null where giveaway_id=$1 and kind='winner'",[g.id,hash,url]);
  const fresh=await gvGet32(g.id);
  if(!fresh.announced_at){
    const list=w.map(x=>"✅ "+(x.username?"@"+x.username:"UID "+x.telegram_id)).join("\n"),txt="🎉 GIVEAWAY WINNERS!\n\n🏆 3 winners received 0.05 GRAM each\n\n"+list+"\n\n💎 Total Paid: 0.15 GRAM\n🔗 "+url+"\n\n🌭 WIENER Farm";
    try{const m=await safeTg18("sendMessage",{chat_id:Number(g.source_chat_id),text:txt,disable_web_page_preview:true});await pool.query("update public.wiener_external_giveaways set announced_at=now(),announcement_message_id=$2 where id=$1",[g.id,m?.message_id||null])}catch{}
    await Promise.allSettled(w.map(x=>safeTg18("sendMessage",{chat_id:Number(x.telegram_id),text:"🏆 You won 0.05 GRAM (TON)!\n\n👛 "+x.wallet+"\n🔗 "+url+"\n✅ Paid"})))
  }
  return {hash,url}
}
async function gvPay32(admin,id){
  const pre=await gvPre32(admin,id),g=pre.g,w=pre.w,tw=pre.tw;let token="",started=false;
  try{
    const sl=firstV10(await rpc("acquire_wiener_ton_signer_lock",[String(g.signer_lock_id),admin]));if(!sl?.ok)throw new Error("ton_signer_busy");
    token=String(sl.token||"");if(!token)throw new Error("ton_signer_lock_failed");
    const seq=await tw.contract.getSeqno(),Core=await import("@ton/core"),messages=w.map(x=>Core.internal({to:Core.Address.parse(x.wallet),value:Core.toNano("0.05"),bounce:false,body:"WIENER Giveaway "+g.public_id+" #"+x.winner_slot}));
    await pool.query("update public.wiener_external_giveaways set payout_state='broadcasting',payout_seqno=$2,payout_submitted_at=now() where id=$1",[id,seq]);
    await pool.query("update public.wiener_external_giveaway_winners set payout_status='broadcasting',seqno=$2,submitted_at=now() where giveaway_id=$1 and kind='winner'",[id,seq]);
    started=true;
    await tw.contract.sendTransfer({seqno:seq,secretKey:tw.kp.secretKey,sendMode:Core.SendMode.PAY_GAS_SEPARATELY,messages});
    await pool.query("update public.wiener_external_giveaways set payout_state='submitted' where id=$1",[id]);
    let ok=false;for(let i=0;i<12;i++){await sleepV10(1500);if(await tw.contract.getSeqno()>seq){ok=true;break}}
    if(!ok)throw new Error("submitted_reconcile_required");
    const txs=await tw.client.getTransactions(tw.wc.address,{limit:8});if(!txs[0])throw new Error("hash_unavailable_reconcile_required");
    return await gvFinish32(g,w,txs[0])
  }catch(e){
    if(started){await pool.query("update public.wiener_external_giveaways set payout_state='reconcile_required',payout_error=$2 where id=$1 and payout_state<>'paid'",[id,String(e.message||e)]);throw new Error("TON may be submitted. Use RECONCILE; never pay again.")}
    throw e
  }finally{if(token)await rpc("release_wiener_ton_signer_lock",[token]).catch(()=>null)}
}
async function gvRecon32(admin,id){
  await adm18(admin);const g=await gvGet32(id);if(!g||!["broadcasting","submitted","reconcile_required"].includes(String(g.payout_state)))throw new Error("nothing_to_reconcile");
  const tw=await gvTon32(),seq=Number(g.payout_seqno);if(await tw.contract.getSeqno()<=seq)throw new Error("not_confirmed_yet_do_not_retry");
  const at=new Date(g.payout_submitted_at||0).getTime(),txs=await tw.client.getTransactions(tw.wc.address,{limit:20}),tx=txs.map(t=>({t,d:Math.abs(Number(t.now)*1000-at)})).sort((a,b)=>a.d-b.d)[0]?.t;if(!tx)throw new Error("hash_not_found");
  const w=(await pool.query("select * from public.wiener_external_giveaway_winners where giveaway_id=$1 and kind='winner' order by winner_slot",[id])).rows;
  return gvFinish32(g,w,tx)
}
async function gvHandle32(up,uid,text,m,q){
  uid=Number(q?.from?.id||m?.from?.id||uid||0);text=String(m?.text||text||"").trim();await gvPassive32(up,m);
  if(m?.chat?.type==="private"&&/^\/giveaway_import(?:@\w+)?\s+/i.test(text)){try{const g=await gvImport32(uid,text.split(/\s+/)[1]),x=await gvCard32(g.id);await safeTg18("sendMessage",{chat_id:uid,text:x.text,reply_markup:x.markup,disable_web_page_preview:true})}catch(e){await safeTg18("sendMessage",{chat_id:uid,text:"❌ "+String(e.message||e).replace(/_/g," ")})}return true}
  if(m?.chat?.type==="private"&&/^\/giveaway_status/i.test(text)){try{await adm18(uid);const x=await gvCard32(text.split(/\s+/)[1]);await safeTg18("sendMessage",{chat_id:uid,text:x.text,reply_markup:x.markup,disable_web_page_preview:true})}catch(e){await safeTg18("sendMessage",{chat_id:uid,text:"❌ "+String(e.message||e)})}return true}
  if(m&&/^\/giveaway_add/i.test(text)){try{await adm18(uid);if(!m.reply_to_message)throw new Error("reply_to_old_wallet_comment_with_this_command");const g=(await pool.query("select * from public.wiener_external_giveaways where discussion_chat_id=$1 and status='collecting' order by imported_at desc limit 1",[Number(m.chat.id)])).rows[0],w=await gvWalletText32(m.reply_to_message.text||m.reply_to_message.caption||"");if(!g||!w||!m.reply_to_message.from?.id)throw new Error("cannot_import_that_comment");const ok=await gvAdd32(g,m.reply_to_message.from.id,m.reply_to_message.from.username,w,m.chat.id,m.reply_to_message.message_id,"manual_reply");await safeTg18("sendMessage",{chat_id:m.chat.id,text:ok?"✅ Giveaway entry added":"ℹ️ Duplicate/excluded entry"})}catch(e){await safeTg18("sendMessage",{chat_id:m.chat.id,text:"❌ "+String(e.message||e).replace(/_/g," ")})}return true}
  if(!q||!String(q.data||"").startsWith("gv32:"))return false;
  try{await adm18(uid)}catch{await safeTg18("answerCallbackQuery",{callback_query_id:q.id,text:"Admin required",show_alert:true});return true}
  const z=String(q.data).split(":"),act=z[1],id=z[2];
  try{
    if(act==="show")await edit18(q,await gvCard32(id));
    else if(act==="target"){await pool.query("update public.wiener_external_giveaways set target_confirmed_at=now() where id=$1 and status='collecting'",[id]);await edit18(q,await gvCard32(id))}
    else if(act==="draw"){await gvDraw32(uid,id);await edit18(q,await gvCard32(id))}
    else if(act==="audit"){const g=await gvGet32(id);await edit18(q,{text:"🔐 DRAW AUDIT\n\nID: "+g.public_id+"\nEntries: "+(g.entry_count||0)+"\nSnapshot:\n"+(g.snapshot_hash||"-")+"\n\nSeed:\n"+(g.draw_seed||"-"),markup:kb18([[cb18("◀️ BACK","gv32:show:"+id)]])})}
    else if(act==="prepay"){const x=await gvPre32(uid,id);await edit18(q,{text:"⚠️ CONFIRM TON TREASURY PAYOUT\n\n3 winners × 0.05 GRAM\nTotal: 0.15 GRAM\nTreasury: "+gvS32(x.tw.address,30)+"\nBalance: "+x.balance.toFixed(6)+" GRAM\n\nOne TON transaction will contain 3 unique transfers.",markup:kb18([[cb18("✅ CONFIRM & PAY 0.15 GRAM","gv32:pay:"+id)],[cb18("❌ CANCEL","gv32:show:"+id)]])})}
    else if(act==="pay"){await safeTg18("answerCallbackQuery",{callback_query_id:q.id,text:"Submitting TON payout…"});await edit18(q,{text:"⏳ Submitting giveaway payout.\nDo not press Pay again.",markup:kb18([])});try{await gvPay32(uid,id);const x=await gvCard32(id);await safeTg18("sendMessage",{chat_id:uid,text:x.text,reply_markup:x.markup})}catch(e){await safeTg18("sendMessage",{chat_id:uid,text:"⚠️ "+String(e.message||e)+"\nUse /giveaway_status and RECONCILE."})}return true}
    else if(act==="recon"){await gvRecon32(uid,id);await edit18(q,await gvCard32(id))}
    else return false;
    await safeTg18("answerCallbackQuery",{callback_query_id:q.id,text:"Updated"});return true
  }catch(e){await safeTg18("answerCallbackQuery",{callback_query_id:q.id,text:String(e.message||e).replace(/_/g," ").slice(0,190),show_alert:true});return true}
}
app.post("/functions/v1/wiener-giveaway-sync-v32",async(req,res)=>{try{await internalV18(req);const x=await syncTelegramV18();return res.json({ok:true,data:x})}catch(e){return res.status(500).json({ok:false,error:String(e.message||e)})}});
// === END WIENER EXISTING TON GIVEAWAY V32 ===
'''

s=s.replace(marker,"\n"+code+marker,1)

old="allowed_updates:['message','callback_query','my_chat_member']"
if old in s:
    s=s.replace(old,"allowed_updates:['message','callback_query','my_chat_member','message_reaction_count']",1)

needles=[
    "try{if(await handleSponsoredTaskManagerV30(up,uid,text,m,q)) return done();}",
    "try{if(await handleBotFullV18(up,uid,text,m,q)) return done();}"
]
for needle in needles:
    pos=s.find(needle)
    if pos>=0:
        line=s.rfind("\n",0,pos)+1
        indent=re.match(r"[ \t]*",s[line:pos]).group(0)
        s=s[:line]+indent+"try{if(await gvHandle32(up,uid,text,m,q)) return done();}catch(e){console.error('gv32',String(e?.message||e));}\n"+s[line:]
        break
else:
    raise SystemExit("ERROR: webhook hook missing")

for oldcmd in [
    "{command:'addtask',description:'Create & manage sponsored tasks'}",
    "{command:'addtask',description:'Create sponsored task'}"
]:
    if oldcmd in s:
        s=s.replace(oldcmd,oldcmd+",{command:'giveaway_import',description:'Import existing TON giveaway'}",1)
        break

p.write_text(s)
print("V32 installed: existing-post giveaway + unique draw + TON treasury payout")
