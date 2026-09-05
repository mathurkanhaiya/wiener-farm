#!/usr/bin/env python3
from pathlib import Path
import os

p=Path(os.environ.get('WIENER_BACKEND_FILE','/opt/wiener-backend/server.mjs'))
if not p.exists():
    alt=Path('/opt/wiener-backend/server.js')
    if alt.exists(): p=alt

s=p.read_text()
TAG='WIENER COPYABLE SPONSORED PAYMENT V47D'
if TAG in s:
    print('V47D already installed')
    raise SystemExit(0)

for need in ['async function showAddtask18','async function sponsorBotShowV30','payment_memo']:
    if need not in s:
        raise SystemExit('ERROR: sponsored payment feature missing: '+need)

# Generic card editor: allow optional HTML parse mode.
old="async function edit18(q,x){try{return await tgV10('editMessageText',{chat_id:q.message.chat.id,message_id:q.message.message_id,text:x.text,reply_markup:x.markup,disable_web_page_preview:true})}catch{return safeTg18('sendMessage',{chat_id:q.from.id,text:x.text,reply_markup:x.markup,disable_web_page_preview:true})}}"
new="async function edit18(q,x){try{return await tgV10('editMessageText',{chat_id:q.message.chat.id,message_id:q.message.message_id,text:x.text,reply_markup:x.markup,parse_mode:x.parse_mode||undefined,disable_web_page_preview:true})}catch{return safeTg18('sendMessage',{chat_id:q.from.id,text:x.text,reply_markup:x.markup,parse_mode:x.parse_mode||undefined,disable_web_page_preview:true})}}"
if old in s:
    s=s.replace(old,new,1)
elif 'parse_mode:x.parse_mode||undefined' not in s:
    raise SystemExit('ERROR: edit18 helper not recognized')

# /addtask wizard editor: allow optional parse mode.
old="edit=async(text,markup)=>{try{return await tgV10('editMessageText',{chat_id:s.wizard_chat_id,message_id:s.wizard_message_id,text,reply_markup:markup,disable_web_page_preview:true})}catch{return safeTg18('sendMessage',{chat_id:s.telegram_id,text,reply_markup:markup})}};"
new="edit=async(text,markup,parse_mode=null)=>{try{return await tgV10('editMessageText',{chat_id:s.wizard_chat_id,message_id:s.wizard_message_id,text,reply_markup:markup,parse_mode:parse_mode||undefined,disable_web_page_preview:true})}catch{return safeTg18('sendMessage',{chat_id:s.telegram_id,text,reply_markup:markup,parse_mode:parse_mode||undefined,disable_web_page_preview:true})}};"
if old in s:
    s=s.replace(old,new,1)
elif 'edit=async(text,markup,parse_mode=null)' not in s:
    raise SystemExit('ERROR: showAddtask18 editor not recognized')

# Replace the whole final payment branch by function boundaries. This avoids fragile exact text matching.
pay_start=s.find("if(s.step==='payment')")
pay_end=s.find('async function startAddtask18',pay_start)
if pay_start<0 or pay_end<0:
    raise SystemExit('ERROR: /addtask payment boundaries not found')
pay=r'''if(s.step==='payment'){
    const o=(await pool.query(`select * from public.exclusive_task_orders where id=$1`,[s.order_id])).rows[0];
    return edit(`🟡 <b>PAYMENT REQUIRED</b>

${o?.title||s.title||'Sponsored Task'}

👥 ${o?.target_completions||s.target_completions} completions
🎁 ${o?.reward_per_completion||10} WIENER each
💵 Total: ${(n18(o?.target_completions||s.target_completions)/100*.30).toFixed(2)}

💎 <b>TON Payment</b>

Send: <code>${n18(o?.package_ton).toFixed(6)}</code> TON
To: <code>${o?.payment_address||'—'}</code>
Memo: <code>${o?.payment_memo||'—'}</code>

⚠️ Send the exact TON amount.
⚠️ Include the memo exactly.
After sending, tap <b>CHECK PAYMENT</b>.`,kb18([
      [cb18('✅ CHECK PAYMENT','at:checkpay')],
      [cb18('🔄 REFRESH','at:checkpay')],
      [cb18('❌ Cancel','at:x')]
    ]),'HTML')
  }
}
'''
s=s[:pay_start]+pay+s[pay_end:]

# Campaign manager pending-payment card. Keep its current buttons, replace only the card body.
fn=s.find('async function sponsorBotShowV30(uid,id){')
fn_end=s.find('\n\nasync function handleSponsoredTaskManagerV30',fn)
if fn<0 or fn_end<0:
    raise SystemExit('ERROR: sponsor manager function boundaries not found')
branch=s.find("if(o.status==='awaiting_payment')return{text:`",fn,fn_end)
markup=s.find('markup:kb18([',branch,fn_end)
branch_end=s.find('])};',markup,fn_end)
if branch<0 or markup<0 or branch_end<0:
    raise SystemExit('ERROR: sponsor manager payment boundaries not found')
branch_end+=4
buttons=s[markup:branch_end]
manager=r'''if(o.status==='awaiting_payment')return{text:`🟡 <b>PAYMENT REQUIRED</b>

${String(o.title||'Sponsored Task').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}

👥 ${o.target_completions} completions
🎁 ${o.reward_per_completion} WIENER each
💵 Total: ${(sponsorNumV30(o.target_completions)/100*.30).toFixed(2)}

💎 <b>TON Payment</b>

Send: <code>${sponsorNumV30(o.package_ton).toFixed(6)}</code> TON
To: <code>${o.payment_address}</code>
Memo: <code>${o.payment_memo}</code>

⚠️ Send the exact TON amount.
⚠️ Include the memo exactly.
After sending, tap <b>CHECK PAYMENT</b>.`,parse_mode:'HTML','''+buttons
s=s[:branch]+manager+s[branch_end:]

# V36 top-up card, if installed.
top=s.find('await edit18(q,{text:`💎 TOP-UP PAYMENT')
if top>=0:
    top_end=s.find('])});',top)
    if top_end<0:
        raise SystemExit('ERROR: top-up payment boundaries not found')
    top_end+=5
    top_new=r'''await edit18(q,{text:`🟡 <b>TOP-UP PAYMENT REQUIRED</b>

➕ ${x.added_completions} completions
💵 Total: ${sponsorNumV30(x.price_usd).toFixed(2)}

💎 <b>TON Payment</b>

Send: <code>${sponsorNumV30(x.package_ton).toFixed(6)}</code> TON
To: <code>${x.payment_address}</code>
Memo: <code>${x.payment_memo}</code>

⚠️ Send the exact TON amount.
⚠️ Include the memo exactly.
After sending, tap <b>CHECK PAYMENT</b>.`,parse_mode:'HTML',markup:kb18([
        [cb18('✅ CHECK PAYMENT',`stm30:topcheck:${x.id}`)],
        [cb18('◀️ BACK TO TASK',`stm30:show:${id}`)]
      ])});'''
    s=s[:top]+top_new+s[top_end:]
else:
    print('INFO: V36 top-up card not present; skipped')

marker="\napp.use((_req,res)=>\n  res.status(404).json({ok:false,error:'route_not_enabled_yet'})\n);\n"
if marker in s:
    s=s.replace(marker,"\n// === WIENER COPYABLE SPONSORED PAYMENT V47D ===\n"+marker,1)
else:
    s+='\n// === WIENER COPYABLE SPONSORED PAYMENT V47D ===\n'

p.write_text(s)
print('V47D installed: copyable TON amount/address/memo')
