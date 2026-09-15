from pathlib import Path

p=Path('/opt/wiener-backend/server.mjs')
s=p.read_text()
TAG='WIENER VPS BULK SILENT WITHDRAW ARCHIVE V22B'
marker="\napp.use((_req,res)=>\n  res.status(404).json({ok:false,error:'route_not_enabled_yet'})\n);\n"
if TAG in s:
    print('V22B bulk silent withdrawal archive already installed')
    raise SystemExit(0)
if 'WIENER VPS SILENT WITHDRAW ARCHIVE V22' not in s:
    raise SystemExit('ERROR: V22 silent withdrawal archive must be installed first')
if marker not in s:
    raise SystemExit('ERROR: final fallback marker missing')

hook="    try{if(await handleWithdrawArchiveV22(up,uid,text,m,q)) return done();}catch(e){console.error('v22_withdraw_archive',String(e?.message||e));}\n"
if hook not in s:
    raise SystemExit('ERROR: V22 bot handler hook missing')
s=s.replace(hook,"    try{if(await handleBulkWithdrawArchiveV22B(up,uid,text,m,q)) return done();}catch(e){console.error('v22b_bulk_withdraw_archive',String(e?.message||e));}\n"+hook,1)

code=r'''

// === WIENER VPS BULK SILENT WITHDRAW ARCHIVE V22B ===
const withdrawArchiveConfirm22B=new Map();
function archiveToken22B(){return crypto.randomBytes(8).toString('hex')}

async function pendingArchiveRows22B(){
  return (await pool.query(`select id,telegram_id,username,network,gross_usdt,created_at from public.withdrawals where status='pending' order by created_at asc`)).rows;
}

async function runBulkArchive22B(admin){
  const rows=await pendingArchiveRows22B();
  let archived=0,skipped=0,failed=0;
  const skippedIds=[],failedIds=[];
  for(const w of rows){
    try{
      await archiveWithdrawal22(admin,String(w.id),'Bulk archived by admin');
      archived++;
    }catch(e){
      const msg=String(e?.message||e);
      if(/payout_already_started|pending_withdrawal_not_found/i.test(msg)){skipped++;if(skippedIds.length<12)skippedIds.push(String(w.id));}
      else{failed++;if(failedIds.length<12)failedIds.push(`${String(w.id)}: ${msg.slice(0,80)}`);}
    }
  }
  const left=Number((await pool.query(`select count(*)::int c from public.withdrawals where status='pending'`)).rows[0]?.c||0);
  await audit18(Number(admin),'withdrawals_bulk_archived_silently',null,{requested:rows.length,archived,skipped,failed,pending_remaining:left}).catch(()=>null);
  return{requested:rows.length,archived,skipped,failed,pending_remaining:left,skipped_ids:skippedIds,failed_ids:failedIds};
}

async function handleBulkWithdrawArchiveV22B(up,uid,text,m,q){
  if(!uid)return false;
  const data=String(q?.data||'');
  if(data.startsWith('warc22b:')){
    try{await adm18(uid,'withdrawals')}catch{await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:'Admin permission required',show_alert:true});return true}
    const [,act,token]=data.split(':');
    const x=withdrawArchiveConfirm22B.get(token);
    if(!x||Number(x.uid)!==Number(uid)||Number(x.expires||0)<Date.now()){
      withdrawArchiveConfirm22B.delete(token);
      await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:'Confirmation expired. Run /archivewithdraw all again.',show_alert:true});return true;
    }
    if(act==='cancel'){
      withdrawArchiveConfirm22B.delete(token);
      await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:'Cancelled'});
      await edit18(q,{text:'✅ Bulk pending-withdrawal clear cancelled.',markup:kb18([])});return true;
    }
    if(act==='confirm'){
      withdrawArchiveConfirm22B.delete(token);
      await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:'Clearing pending queue…'});
      await edit18(q,{text:`⏳ Clearing ${Number(x.count||0)} pending withdrawal(s)…\n\nNo user Telegram messages will be sent. Payouts already in flight will be skipped.`,markup:kb18([])});
      const r=await runBulkArchive22B(uid);
      await safeTg18('sendMessage',{chat_id:uid,text:`🗄 Pending withdrawal queue cleared\n\nRequested: ${r.requested}\nArchived: ${r.archived}\nSkipped (payout already started / no longer pending): ${r.skipped}\nFailed: ${r.failed}\nPending remaining: ${r.pending_remaining}\n\nNo user Telegram rejection messages were sent. Financial and audit records were preserved.${r.failed_ids.length?`\n\nFailed IDs:\n${r.failed_ids.join('\n')}`:''}`});
      return true;
    }
    return false;
  }

  if(m?.chat?.type==='private'&&/^\/(?:archivewithdraw|removewithdraw)(?:@\w+)?\s+all\s*$/i.test(text)){
    try{await adm18(uid,'withdrawals')}catch{await safeTg18('sendMessage',{chat_id:uid,text:'⛔ Admin withdrawal permission required.'});return true}
    const count=Number((await pool.query(`select count(*)::int c from public.withdrawals where status='pending'`)).rows[0]?.c||0);
    if(!count){await safeTg18('sendMessage',{chat_id:uid,text:'✅ No pending withdrawals to clear.'});return true}
    const token=archiveToken22B();withdrawArchiveConfirm22B.set(token,{uid:Number(uid),count,expires:Date.now()+120000});
    await safeTg18('sendMessage',{chat_id:uid,text:`⚠️ CLEAR ALL PENDING WITHDRAWALS?\n\nPending now: ${count}\n\nThis will silently remove eligible requests from Pending using the normal rejection/refund accounting path. No user Telegram rejection message will be sent. Financial/audit records stay preserved. Any payout already in flight will be skipped.\n\nConfirmation expires in 2 minutes.`,reply_markup:kb18([[cb18(`✅ CLEAR ALL ${count}`,`warc22b:confirm:${token}`)],[cb18('❌ CANCEL',`warc22b:cancel:${token}`)]])});
    return true;
  }
  return false;
}
// === END WIENER VPS BULK SILENT WITHDRAW ARCHIVE V22B ===
'''

s=s.replace(marker,'\n'+code+marker,1)
p.write_text(s)
print('V22B bulk silent withdrawal archive installed')
