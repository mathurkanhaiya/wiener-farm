#!/usr/bin/env python3
from pathlib import Path
import os

p=Path(os.environ.get('WIENER_BACKEND_FILE','/opt/wiener-backend/server.mjs'))
if not p.exists():
    alt=Path('/opt/wiener-backend/server.js')
    if alt.exists(): p=alt

s=p.read_text()
TAG='WIENER COPYABLE SPONSORED PAYMENT V47C'
if TAG in s:
    print('V47C already installed')
    raise SystemExit(0)

for need in ['async function showAddtask18','async function sponsorBotShowV30','payment_memo']:
    if need not in s:
        raise SystemExit('ERROR: sponsored payment feature missing: '+need)

# 1) Allow generic bot cards to request HTML formatting.
old="async function edit18(q,x){try{return await tgV10('editMessageText',{chat_id:q.message.chat.id,message_id:q.message.message_id,text:x.text,reply_markup:x.markup,disable_web_page_preview:true})}catch{return safeTg18('sendMessage',{chat_id:q.from.id,text:x.text,reply_markup:x.markup,disable_web_page_preview:true})}}"
new="async function edit18(q,x){try{return await tgV10('editMessageText',{chat_id:q.message.chat.id,message_id:q.message.message_id,text:x.text,reply_markup:x.markup,parse_mode:x.parse_mode||undefined,disable_web_page_preview:true})}catch{return safeTg18('sendMessage',{chat_id:q.from.id,text:x.text,reply_markup:x.markup,parse_mode:x.parse_mode||undefined,disable_web_page_preview:true})}}"
if old in s:
    s=s.replace(old,new,1)
elif 'parse_mode:x.parse_mode||undefined' not in s:
    raise SystemExit('ERROR: edit18 helper not recognized')

# 2) Allow the /addtask wizard editor to request HTML formatting.
old="edit=async(text,markup)=>{try{return await tgV10('editMessageText',{chat_id:s.wizard_chat_id,message_id:s.wizard_message_id,text,reply_markup:markup,disable_web_page_preview:true})}catch{return safeTg18('sendMessage',{chat_id:s.telegram_id,text,reply_markup:markup})}};"
new="edit=async(text,markup,parse_mode=null)=>{try{return await tgV10('editMessageText',{chat_id:s.wizard_chat_id,message_id:s.wizard_message_id,text,reply_markup:markup,parse_mode:parse_mode||undefined,disable_web_page_preview:true})}catch{return safeTg18('sendMessage',{chat_id:s.telegram_id,text,reply_markup:markup,parse_mode:parse_mode||undefined,disable_web_page_preview:true})}};"
if old in s:
    s=s.replace(old,new,1)
elif 'edit=async(text,markup,parse_mode=null)' not in s:
    raise SystemExit('ERROR: showAddtask18 edit helper not recognized')

# 3) Initial /addtask payment screen.
old="""if(s.step==='payment'){const o=(await pool.query(`select * from public.exclusive_task_orders where id=$1`,[s.order_id])).rows[0];return edit(`💎 TON Payment\n\nSend: ${n18(o?.package_ton).toFixed(6)} TON\nTo: ${o?.payment_address||'—'}\nMemo: ${o?.payment_memo||'—'}\n\n⚠️ Include the memo exactly.\nAfter sending, tap CHECK PAYMENT.`,kb18([[cb18('✅ CHECK PAYMENT','at:checkpay')],[cb18('🔄 REFRESH','at:checkpay')],[cb18('❌ Cancel','at:x')]]))}}"""
new="""if(s.step==='payment'){const o=(await pool.query(`select * from public.exclusive_task_orders where id=$1`,[s.order_id])).rows[0];return edit(`💎 <b>TON Payment</b>\n\nSend: <code>${n18(o?.package_ton).toFixed(6)}</code> TON\nTo: <code>${o?.payment_address||'—'}</code>\nMemo: <code>${o?.payment_memo||'—'}</code>\n\n⚠️ Include the memo exactly.\nAfter sending, tap <b>CHECK PAYMENT</b>.`,kb18([[cb18('✅ CHECK PAYMENT','at:checkpay')],[cb18('🔄 REFRESH','at:checkpay')],[cb18('❌ Cancel','at:x')]]),'HTML')}}"""
if old not in s:
    raise SystemExit('ERROR: initial sponsored payment card not found')
s=s.replace(old,new,1)

# 4) Campaign manager pending-payment card (V36/V35B shape).
fn=s.find('async function sponsorBotShowV30(uid,id){')
fn_end=s.find('\n\nasync function handleSponsoredTaskManagerV30',fn)
if fn<0 or fn_end<0:
    raise SystemExit('ERROR: sponsor manager function boundaries not found')
branch=s.find("if(o.status==='awaiting_payment')return{text:`",fn,fn_end)
markup=s.find('`,markup:kb18([',branch,fn_end)
branch_end=s.find('])};',markup,fn_end)
if branch<0 or markup<0 or branch_end<0:
    raise SystemExit('ERROR: sponsored manager payment card not found')
branch_end+=4
buttons=s[markup+2:branch_end]
manager="""if(o.status==='awaiting_payment')return{text:`💎 <b>TON Payment</b>\n\n👥 ${o.target_completions} completions\n🎁 ${o.reward_per_completion} WIENER each\n\nSend: <code>${sponsorNumV30(o.package_ton).toFixed(6)}</code> TON\nTo: <code>${o.payment_address}</code>\nMemo: <code>${o.payment_memo}</code>\n\n⚠️ Include the memo exactly.\nAfter sending, tap <b>CHECK PAYMENT</b>.`,parse_mode:'HTML',"""+buttons
s=s[:branch]+manager+s[branch_end:]

# 5) V36 top-up payment card.
top=s.find('await edit18(q,{text:`💎 TOP-UP PAYMENT')
if top>=0:
    top_markup=s.find('`,markup:kb18([',top)
    top_end=s.find('])});',top_markup)
    if top_markup<0 or top_end<0:
        raise SystemExit('ERROR: top-up payment card boundaries not found')
    top_end+=5
    buttons=s[top_markup+2:top_end]
    top_new="""await edit18(q,{text:`💎 <b>TON Top-up Payment</b>\n\n➕ ${x.added_completions} completions\n💵 $${sponsorNumV30(x.price_usd).toFixed(2)}\n\nSend: <code>${sponsorNumV30(x.package_ton).toFixed(6)}</code> TON\nTo: <code>${x.payment_address}</code>\nMemo: <code>${x.payment_memo}</code>\n\n⚠️ Include the memo exactly.\nAfter sending, tap <b>CHECK PAYMENT</b>.`,parse_mode:'HTML',"""+buttons
    s=s[:top]+top_new+s[top_end:]
else:
    print('INFO: V36 top-up card not present; skipped')

marker="\napp.use((_req,res)=>\n  res.status(404).json({ok:false,error:'route_not_enabled_yet'})\n);\n"
if marker in s:
    s=s.replace(marker,"\n// === WIENER COPYABLE SPONSORED PAYMENT V47C ===\n"+marker,1)
else:
    s+='\n// === WIENER COPYABLE SPONSORED PAYMENT V47C ===\n'

p.write_text(s)
print('V47C installed: copyable amount, TON address and memo')
