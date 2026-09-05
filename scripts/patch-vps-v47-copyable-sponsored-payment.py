#!/usr/bin/env python3
from pathlib import Path
import os,re

p=Path(os.environ.get('WIENER_BACKEND_FILE','/opt/wiener-backend/server.mjs'))
if not p.exists():
    alt=Path('/opt/wiener-backend/server.js')
    if alt.exists(): p=alt

s=p.read_text()
TAG='WIENER COPYABLE SPONSORED PAYMENT V47'
if TAG in s:
    print('V47 copyable payment fields already installed')
    raise SystemExit(0)

for need in ['async function showAddtask18','async function sponsorBotShowV30','payment_memo']:
    if need not in s:
        raise SystemExit('ERROR: sponsored payment feature missing: '+need)

# Allow rich HTML only when a card explicitly requests it.
old="async function edit18(q,x){try{return await tgV10('editMessageText',{chat_id:q.message.chat.id,message_id:q.message.message_id,text:x.text,reply_markup:x.markup,disable_web_page_preview:true})}catch{return safeTg18('sendMessage',{chat_id:q.from.id,text:x.text,reply_markup:x.markup,disable_web_page_preview:true})}}"
new="async function edit18(q,x){try{return await tgV10('editMessageText',{chat_id:q.message.chat.id,message_id:q.message.message_id,text:x.text,reply_markup:x.markup,parse_mode:x.parse_mode||undefined,disable_web_page_preview:true})}catch{return safeTg18('sendMessage',{chat_id:q.from.id,text:x.text,reply_markup:x.markup,parse_mode:x.parse_mode||undefined,disable_web_page_preview:true})}}"
if old in s:
    s=s.replace(old,new,1)
else:
    print('WARNING: edit18 format already changed; continuing')

# showAddtask18 has its own edit helper, so give it optional parse_mode.
old="edit=async(text,markup)=>{try{return await tgV10('editMessageText',{chat_id:s.wizard_chat_id,message_id:s.wizard_message_id,text,reply_markup:markup,disable_web_page_preview:true})}catch{return safeTg18('sendMessage',{chat_id:s.telegram_id,text,reply_markup:markup})}};"
new="edit=async(text,markup,parse_mode=null)=>{try{return await tgV10('editMessageText',{chat_id:s.wizard_chat_id,message_id:s.wizard_message_id,text,reply_markup:markup,parse_mode:parse_mode||undefined,disable_web_page_preview:true})}catch{return safeTg18('sendMessage',{chat_id:s.telegram_id,text,reply_markup:markup,parse_mode:parse_mode||undefined,disable_web_page_preview:true})}};"
if old not in s:
    raise SystemExit('ERROR: showAddtask18 edit helper not found')
s=s.replace(old,new,1)

# Initial /addtask payment screen: amount/address/memo become tap-to-copy code spans.
pat=r"if\(s\.step==='payment'\)\{const o=\(await pool\.query\(`select \* from public\.exclusive_task_orders where id=\$1`,\[s\.order_id\]\)\)\.rows\[0\];return edit\(`💎 TON Payment.*?\)\}\}"
m=re.search(pat,s,re.S)
if not m:
    raise SystemExit('ERROR: /addtask payment screen not found')
replacement=r'''if(s.step==='payment'){const o=(await pool.query(`select * from public.exclusive_task_orders where id=$1`,[s.order_id])).rows[0];return edit(`💎 <b>TON Payment</b>

Send: <code>${n18(o?.package_ton).toFixed(6)}</code> TON
To: <code>${o?.payment_address||'—'}</code>
Memo: <code>${o?.payment_memo||'—'}</code>

⚠️ Include the memo exactly.
After sending, tap <b>CHECK PAYMENT</b>.`,kb18([[cb18('✅ CHECK PAYMENT','at:checkpay')],[cb18('🔄 REFRESH','at:checkpay')],[cb18('❌ Cancel','at:x')]]),'HTML')}}'''
s=s[:m.start()]+replacement+s[m.end():]

# Campaign manager pending-payment card.
pat=r"if\(o\.status==='awaiting_payment'\)return\{text:`🟡 PAYMENT REQUIRED.*?\}\)\};"
m=re.search(pat,s,re.S)
if not m:
    raise SystemExit('ERROR: sponsored manager payment card not found')
block=m.group(0)
# Preserve whichever buttons V35/V36 currently provide; change only display text and parse mode.
markup_at=block.find('`,markup:')
if markup_at<0:
    raise SystemExit('ERROR: manager payment markup split not found')
markup=block[markup_at+2:]
title_expr="${String(o.title||'Task').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}"
text="""if(o.status==='awaiting_payment')return{text:`💎 <b>TON Payment</b>\n\n"""+title_expr+"""\n\n👥 ${o.target_completions} completions\n🎁 ${o.reward_per_completion} WIENER each\n\nSend: <code>${sponsorNumV30(o.package_ton).toFixed(6)}</code> TON\nTo: <code>${o.payment_address}</code>\nMemo: <code>${o.payment_memo}</code>\n\n⚠️ Include the memo exactly.\nAfter sending, tap <b>CHECK PAYMENT</b>.`"""
newblock=text+",parse_mode:'HTML',"+markup
s=s[:m.start()]+newblock+s[m.end():]

# Top-up payment card if V36 is installed.
top_pat=r"await edit18\(q,\{text:`💎 TOP-UP PAYMENT.*?\}\)\);"
tm=re.search(top_pat,s,re.S)
if tm:
    tb=tm.group(0)
    split=tb.find('`,markup:')
    if split>0:
        mk=tb[split+2:]
        # mk ends with '});' from edit18; insert parse_mode before markup.
        nt="""await edit18(q,{text:`💎 <b>TON Top-up Payment</b>\n\n➕ ${x.added_completions} completions\n💵 $${sponsorNumV30(x.price_usd).toFixed(2)}\n\nSend: <code>${sponsorNumV30(x.package_ton).toFixed(6)}</code> TON\nTo: <code>${x.payment_address}</code>\nMemo: <code>${x.payment_memo}</code>\n\n⚠️ Include the memo exactly.\nAfter sending, tap <b>CHECK PAYMENT</b>.`"""
        s=s[:tm.start()]+nt+",parse_mode:'HTML',"+mk+s[tm.end():]
else:
    print('INFO: V36 top-up payment card not present; skipped')

marker="\napp.use((_req,res)=>\n  res.status(404).json({ok:false,error:'route_not_enabled_yet'})\n);\n"
if marker in s:
    s=s.replace(marker,"\n// === WIENER COPYABLE SPONSORED PAYMENT V47 ===\n"+marker,1)
else:
    s+='\n// === WIENER COPYABLE SPONSORED PAYMENT V47 ===\n'

p.write_text(s)
print('V47 installed: TON amount, address and memo are copyable in sponsored-task bot payments')
