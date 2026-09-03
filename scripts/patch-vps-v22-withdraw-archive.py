from pathlib import Path

p=Path('/opt/wiener-backend/server.mjs')
s=p.read_text()
TAG='WIENER VPS SILENT WITHDRAW ARCHIVE V22'
marker="\napp.use((_req,res)=>\n  res.status(404).json({ok:false,error:'route_not_enabled_yet'})\n);\n"
if TAG in s:
    print('V22 silent withdrawal archive already installed')
    raise SystemExit(0)
if 'WIENER VPS SUPABASE ADMIN PARITY V19' not in s:
    raise SystemExit('ERROR: V19 admin parity must be installed first')
if marker not in s:
    raise SystemExit('ERROR: final fallback marker missing')

# Handle the hidden admin command before the normal V19 bot handler.
hook="    try{if(await handleAdminParityV19(up,uid,text,m,q)) return done();}catch(e){console.error('v19_admin_parity',String(e?.message||e));}\n"
if hook not in s:
    raise SystemExit('ERROR: V19 bot handler hook missing')
s=s.replace(hook,"    try{if(await handleWithdrawArchiveV22(up,uid,text,m,q)) return done();}catch(e){console.error('v22_withdraw_archive',String(e?.message||e));}\n"+hook,1)

code=r'''

// === WIENER VPS SILENT WITHDRAW ARCHIVE V22 ===
async function findPendingWithdrawal22(ref){
  const x=String(ref||'').trim();
  if(!x)throw new Error('withdrawal_id_required');
  let rows=[];
  if(x.length>=6){
    rows=(await pool.query(`select * from public.withdrawals where status='pending' and (id::text=$1 or id::text like $2) order by created_at asc limit 3`,[x,x+'%'])).rows;
  }
  if(!rows.length)throw new Error('pending_withdrawal_not_found');
  if(rows.length>1)throw new Error('withdrawal_id_prefix_ambiguous');
  return rows[0];
}

async function archiveWithdrawal22(admin,ref,reason='Archived by admin'){
  await adm18(admin,'withdrawals');
  const w=await findPendingWithdrawal22(ref),wid=String(w.id);

  // Never archive something whose payout may already be in flight or confirmed.
  try{
    const a=(await pool.query(`select state,tx_hash from public.wiener_payout_attempts where withdrawal_id=$1 order by created_at desc limit 1`,[wid])).rows[0];
    if(a&&!['failed','cancelled','canceled','abandoned'].includes(String(a.state||'').toLowerCase()))throw new Error('withdrawal_payout_already_started');
  }catch(e){if(String(e?.message||e)==='withdrawal_payout_already_started')throw e}
  try{
    const g=(await pool.query(`select status from public.ton_treasury_autopay_guard where withdrawal_id=$1 limit 1`,[wid])).rows[0];
    if(g&&['processing','paid'].includes(String(g.status||'').toLowerCase()))throw new Error('withdrawal_payout_already_started');
  }catch(e){if(String(e?.message||e)==='withdrawal_payout_already_started')throw e}

  // Reuse the authoritative rejection path so the user's reserved/deducted WIENER is restored correctly.
  await rpc('reject_withdrawal_v2',[Number(admin),wid,String(reason||'Archived by admin').slice(0,240)]);
  const q=await pool.query(`update public.withdrawals set admin_archived=true,admin_archived_at=now(),admin_archived_by=$2,admin_archive_reason=$3 where id=$1 and status<>'pending' returning *`,[wid,Number(admin),String(reason||'Archived by admin').slice(0,240)]);
  const out=q.rows[0];
  if(!out)throw new Error('withdrawal_archive_state_failed');
  await audit18(Number(admin),'withdrawal_archived_silently',Number(out.telegram_id),{withdrawal_id:wid,network:out.network,gross_usdt:Number(out.gross_usdt||0),reason:String(reason||'Archived by admin').slice(0,240)}).catch(()=>null);
  return out;
}

async function handleWithdrawArchiveV22(up,uid,text,m,q){
  if(!uid)return false;
  if(m?.chat?.type==='private'&&/^\/(?:archivewithdraw|removewithdraw)(?:@\w+)?(?:\s|$)/i.test(text)){
    try{await adm18(uid,'withdrawals')}catch{await safeTg18('sendMessage',{chat_id:uid,text:'⛔ Admin withdrawal permission required.'});return true}
    const ref=text.replace(/^\/(?:archivewithdraw|removewithdraw)(?:@\w+)?\s*/i,'').trim();
    if(!ref){await safeTg18('sendMessage',{chat_id:uid,text:'Usage: /archivewithdraw <withdrawal ID or unique ID prefix>\n\nThis removes it from Pending without sending the user a Telegram rejection message. The financial record and admin audit are preserved.'});return true}
    try{
      const w=await archiveWithdrawal22(uid,ref,'Archived by admin');
      await safeTg18('sendMessage',{chat_id:uid,text:`🗄 Withdrawal removed from Pending\n\nID: ${w.id}\nUID: ${w.telegram_id}\nNetwork: ${w.network}\nAmount: ${fmt18(Number(w.gross_usdt||0),6)} USDT\n\nNo user Telegram notification was sent. Financial/audit history was preserved.`});
    }catch(e){
      const raw=String(e?.message||e),msg=raw.includes('payout_already_started')?'Cannot archive: a payout attempt has already started. Reconcile it in /pay first.':raw.includes('prefix_ambiguous')?'That ID prefix matches more than one withdrawal. Use more characters.':raw.includes('not_found')?'No pending withdrawal matches that ID.':raw.replace(/_/g,' ');
      await safeTg18('sendMessage',{chat_id:uid,text:`⚠️ ${msg}`});
    }
    return true;
  }
  return false;
}

app.post('/functions/v1/wiener-withdraw-archive',async(req,res)=>{
  try{
    const b=req.body||{}, {id}=await edgeUser(b);await adm18(id,'withdrawals');
    const action=String(b.action||'archive');if(action!=='archive')throw new Error('unsupported_action');
    const w=await archiveWithdrawal22(id,b.id||b.withdrawal_id,b.reason||'Archived by admin');
    return res.json({ok:true,data:{archived:true,id:w.id,telegram_id:w.telegram_id,status:w.status}});
  }catch(e){return edgeFail(res,e)}
});
// === END WIENER VPS SILENT WITHDRAW ARCHIVE V22 ===
'''

s=s.replace(marker,'\n'+code+marker,1)
p.write_text(s)
print('V22 silent withdrawal archive installed')
