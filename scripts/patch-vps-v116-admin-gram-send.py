#!/usr/bin/env python3
from pathlib import Path
import os

p=Path(os.environ.get('WIENER_BACKEND_FILE','/opt/wiener-backend/server.mjs'))
s=p.read_text()
TAG='WIENER ADMIN GRAM SEND V116'
if TAG in s:
    print('V116 already installed')
    raise SystemExit(0)

anchor='// === END WIENER VPS FINAL ROUTES V4 ==='
if anchor not in s:
    raise SystemExit('ERROR: backend anchor not found')

code=r"""
// === WIENER ADMIN GRAM SEND V116 ===
// Admin command UX + confirmation state. Actual GRAM broadcast is delegated to
// WIENER_GRAM_SEND_URL so treasury signing stays outside the Telegram webhook.
const gramSendAdminV116=async(id)=>{
  const q=await pool.query(`select role,permissions,enabled from public.admins where telegram_id=$1 limit 1`,[Number(id)]);
  const a=q.rows[0];
  return !!a?.enabled && ['owner','admin'].includes(String(a.role||''));
};
const gramSendEscV116=v=>String(v??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const gramSendAmountV116=v=>{
  const x=Number(v);
  if(!Number.isFinite(x)||x<=0||x>1000000)throw Error('invalid_gram_amount');
  return Number(x.toFixed(9));
};
const gramSendAddressFromTextV116=async text=>{
  const parts=String(text||'').match(/(?:-?\d+:[0-9a-fA-F]{64}|[A-Za-z0-9_-]{48}|[0-9a-fA-F]{64})/g)||[];
  const valid=[];
  for(const x of [...new Set(parts)]){
    try{valid.push((await normalizeTonV4(x)).friendly)}catch{}
  }
  if(valid.length!==1)throw Error(valid.length?'multiple_ton_wallets_found':'ton_wallet_required');
  return valid[0];
};
async function gramSendTgV116(method,payload){
  return telegramApi(method,payload);
}
async function gramSendEditV116(chatId,messageId,text,reply_markup){
  return gramSendTgV116('editMessageText',{
    chat_id:chatId,message_id:messageId,text,parse_mode:'HTML',
    disable_web_page_preview:true,...(reply_markup?{reply_markup}:{})
  });
}
async function gramSendCreateV116({adminId,chatId,sourceMessageId,amount,address}){
  const q=await pool.query(`
    insert into public.admin_gram_sends(admin_telegram_id,chat_id,source_message_id,amount_gram,wallet_address,status,expires_at)
    values($1,$2,$3,$4,$5,'pending',now()+interval '2 minutes')
    returning *
  `,[adminId,chatId,sourceMessageId,amount,address]);
  return q.rows[0];
}
async function gramSendBroadcastV116(row){
  const url=String(process.env.WIENER_GRAM_SEND_URL||'').trim();
  const secret=String(process.env.WIENER_GRAM_SEND_SECRET||'').trim();
  if(!url)throw Error('gram_sender_not_configured');
  const ctl=new AbortController(),tm=setTimeout(()=>ctl.abort(),45000);
  try{
    const r=await fetch(url,{
      method:'POST',signal:ctl.signal,
      headers:{'Content-Type':'application/json',...(secret?{'Authorization':`Bearer ${secret}`}:{})},
      body:JSON.stringify({
        payment_id:String(row.id),
        asset:'GRAM',network:'TON',
        amount:Number(row.amount_gram),
        address:String(row.wallet_address)
      })
    });
    const j=await r.json().catch(()=>({}));
    if(!r.ok||j?.ok===false)throw Error(String(j?.error||j?.message||`gram_sender_http_${r.status}`));
    const tx=String(j?.tx_hash||j?.transaction_hash||j?.hash||'').trim();
    if(!tx)throw Error('gram_sender_missing_tx_hash');
    return {tx_hash:tx,explorer_url:String(j?.explorer_url||withdrawalExplorer('TON',tx))};
  }finally{clearTimeout(tm)}
}
async function gramSendHandleMessageV116(msg){
  const text=String(msg?.text||'').trim();
  const m=text.match(/^\/send(?:@\w+)?\s+([0-9]+(?:\.[0-9]+)?)\s+(?:gram)(?:\s+(.+))?$/i);
  if(!m)return false;
  const adminId=Number(msg?.from?.id||0),chatId=Number(msg?.chat?.id||0);
  if(!adminId||!chatId||!await gramSendAdminV116(adminId)){
    if(chatId)await gramSendTgV116('sendMessage',{chat_id:chatId,text:'❌ Admin only.',reply_to_message_id:msg?.message_id,disable_web_page_preview:true}).catch(()=>{});
    return true;
  }
  try{
    const amount=gramSendAmountV116(m[1]);
    const explicit=String(m[2]||'').trim();
    const source=explicit||String(msg?.reply_to_message?.text||msg?.reply_to_message?.caption||'');
    const address=await gramSendAddressFromTextV116(source);
    const row=await gramSendCreateV116({adminId,chatId,sourceMessageId:Number(msg.message_id),amount,address});
    const body=`💸 <b>Confirm GRAM Transfer</b>\n\n💰 Amount: <b>${amount} GRAM</b>\n👛 To: <code>${gramSendEscV116(address)}</code>\n🌐 Network: TON\n\n⚠️ Blockchain transactions cannot be reversed.\n⏳ Confirmation expires in 2 minutes.`;
    await gramSendTgV116('sendMessage',{
      chat_id:chatId,text:body,parse_mode:'HTML',disable_web_page_preview:true,reply_to_message_id:msg.message_id,
      reply_markup:{inline_keyboard:[[
        {text:'✅ CONFIRM SEND',callback_data:`gramsend:yes:${row.id}`},
        {text:'❌ CANCEL',callback_data:`gramsend:no:${row.id}`}
      ]]}
    });
  }catch(e){
    const em=String(e?.message||e);
    const nice=em==='ton_wallet_required'?'Reply to one message containing a TON/GRAM wallet, or add the address after GRAM.':em==='multiple_ton_wallets_found'?'I found multiple TON addresses. Send exactly one.':em==='invalid_gram_amount'?'Invalid GRAM amount.':em;
    await gramSendTgV116('sendMessage',{chat_id:chatId,text:`❌ ${nice}`,reply_to_message_id:msg.message_id,disable_web_page_preview:true}).catch(()=>{});
  }
  return true;
}
async function gramSendHandleCallbackV116(cq){
  const m=String(cq?.data||'').match(/^gramsend:(yes|no):([0-9a-f-]{8,})$/i);
  if(!m)return false;
  const adminId=Number(cq?.from?.id||0),chatId=Number(cq?.message?.chat?.id||0),messageId=Number(cq?.message?.message_id||0);
  const answer=async t=>gramSendTgV116('answerCallbackQuery',{callback_query_id:cq.id,text:t,show_alert:false}).catch(()=>{});
  if(!adminId||!await gramSendAdminV116(adminId)){await answer('Admin only');return true}
  const client=await pool.connect();
  let row;
  try{
    await client.query('begin');
    const q=await client.query(`select * from public.admin_gram_sends where id=$1 for update`,[m[2]]);
    row=q.rows[0];
    if(!row)throw Error('send_not_found');
    if(Number(row.admin_telegram_id)!==adminId)throw Error('only_initiating_admin_can_confirm');
    if(String(row.status)!=='pending')throw Error(`already_${row.status}`);
    if(new Date(row.expires_at).getTime()<=Date.now()){
      await client.query(`update public.admin_gram_sends set status='expired',updated_at=now() where id=$1`,[row.id]);
      await client.query('commit'); await answer('Confirmation expired');
      await gramSendEditV116(chatId,messageId,'⌛ <b>GRAM transfer expired</b>');
      return true;
    }
    if(m[1].toLowerCase()==='no'){
      await client.query(`update public.admin_gram_sends set status='cancelled',updated_at=now() where id=$1`,[row.id]);
      await client.query('commit'); await answer('Cancelled');
      await gramSendEditV116(chatId,messageId,`❌ <b>GRAM transfer cancelled</b>\n\n💰 ${Number(row.amount_gram)} GRAM\n👛 <code>${gramSendEscV116(row.wallet_address)}</code>`);
      return true;
    }
    await client.query(`update public.admin_gram_sends set status='sending',confirmed_at=now(),updated_at=now() where id=$1`,[row.id]);
    await client.query('commit');
  }catch(e){await client.query('rollback').catch(()=>{});await answer(String(e?.message||e).slice(0,180));return true}
  finally{client.release()}
  await answer('Sending GRAM…');
  await gramSendEditV116(chatId,messageId,`⏳ <b>Sending GRAM…</b>\n\n💰 ${Number(row.amount_gram)} GRAM\n👛 <code>${gramSendEscV116(row.wallet_address)}</code>\n\nDo not tap again.`);
  try{
    const sent=await gramSendBroadcastV116(row);
    const uq=await pool.query(`update public.admin_gram_sends set status='sent',tx_hash=$2,explorer_url=$3,sent_at=now(),updated_at=now() where id=$1 and status='sending' returning *`,[row.id,sent.tx_hash,sent.explorer_url]);
    if(!uq.rowCount)throw Error('send_state_conflict');
    const done=uq.rows[0];
    await pool.query(`insert into public.audit_logs(actor_telegram_id,action,target_type,target_id,details) values($1,'admin_gram_send','gram_transfer',$2,$3::jsonb)`,[adminId,String(done.id),JSON.stringify({amount_gram:Number(done.amount_gram),wallet_address:done.wallet_address,tx_hash:done.tx_hash,chat_id:chatId})]).catch(()=>{});
    const body=`✅ <b>GRAM SENT</b>\n\n💰 Amount: <b>${Number(done.amount_gram)} GRAM</b>\n👛 To: <code>${gramSendEscV116(done.wallet_address)}</code>\n🧾 TX: <code>${gramSendEscV116(done.tx_hash)}</code>\n🟢 Status: Sent\n\n🌭 WIENER Farm`;
    const kb={inline_keyboard:[[{text:'🔎 VIEW TRANSACTION',url:done.explorer_url}]]};
    await gramSendEditV116(chatId,messageId,body,kb);
    const st=(await pool.query(`select payout_channel from public.app_settings where id=true limit 1`)).rows[0]||{};
    await gramSendTgV116('sendMessage',{chat_id:st.payout_channel||'@WienerPay',text:body,parse_mode:'HTML',disable_web_page_preview:true,reply_markup:kb}).catch(()=>{});
  }catch(e){
    const err=String(e?.message||e).slice(0,500);
    // Unknown sender/network result must never be auto-retried. Keep it for manual review.
    await pool.query(`update public.admin_gram_sends set status='review',error=$2,updated_at=now() where id=$1 and status='sending'`,[row.id,err]).catch(()=>{});
    await gramSendEditV116(chatId,messageId,`⚠️ <b>GRAM transfer needs review</b>\n\n💰 ${Number(row.amount_gram)} GRAM\n👛 <code>${gramSendEscV116(row.wallet_address)}</code>\n\nNo automatic retry was made.\n<code>${gramSendEscV116(err)}</code>`).catch(()=>{});
  }
  return true;
}

app.post('/functions/v1/wiener-telegram-admin-webhook-v116',async(req,res)=>{
  try{
    const secret=String(process.env.WIENER_ADMIN_WEBHOOK_SECRET||'');
    if(secret&&String(req.headers['x-telegram-bot-api-secret-token']||'')!==secret)return res.sendStatus(403);
    const u=req.body||{};
    if(u.callback_query)await gramSendHandleCallbackV116(u.callback_query);
    else if(u.message)await gramSendHandleMessageV116(u.message);
    return res.json({ok:true});
  }catch(e){console.error('v116_admin_webhook',String(e?.message||e));return res.json({ok:true})}
});
// === END WIENER ADMIN GRAM SEND V116 ===
"""
s=s.replace(anchor,code+'\n'+anchor,1)
p.write_text(s)
print('V116 installed: admin /send GRAM confirmation command')
