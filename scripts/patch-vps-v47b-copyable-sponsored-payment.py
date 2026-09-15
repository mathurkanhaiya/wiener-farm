#!/usr/bin/env python3
from pathlib import Path
import os

p=Path(os.environ.get('WIENER_BACKEND_FILE','/opt/wiener-backend/server.mjs'))
if not p.exists():
    alt=Path('/opt/wiener-backend/server.js')
    if alt.exists(): p=alt

s=p.read_text()
TAG='WIENER COPYABLE SPONSORED PAYMENT V47B'
if TAG in s:
    print('V47B copyable payment fields already installed')
    raise SystemExit(0)

for need in ['async function showAddtask18','async function sponsorBotShowV30','payment_memo']:
    if need not in s:
        raise SystemExit('ERROR: sponsored payment feature missing: '+need)

# Allow cards to opt into Telegram HTML parse mode.
old="async function edit18(q,x){try{return await tgV10('editMessageText',{chat_id:q.message.chat.id,message_id:q.message.message_id,text:x.text,reply_markup:x.markup,disable_web_page_preview:true})}catch{return safeTg18('sendMessage',{chat_id:q.from.id,text:x.text,reply_markup:x.markup,disable_web_page_preview:true})}}"
new="async function edit18(q,x){try{return await tgV10('editMessageText',{chat_id:q.message.chat.id,message_id:q.message.message_id,text:x.text,reply_markup:x.markup,parse_mode:x.parse_mode||undefined,disable_web_page_preview:true})}catch{return safeTg18('sendMessage',{chat_id:q.from.id,text:x.text,reply_markup:x.markup,parse_mode:x.parse_mode||undefined,disable_web_page_preview:true})}}"
if old in s:
    s=s.replace(old,new,1)
elif 'parse_mode:x.parse_mode||undefined' not in s:
    raise SystemExit('ERROR: edit18 helper format not recognized')

# /addtask wizard has its own edit helper.
old="edit=async(text,markup)=>{try{return await tgV10('editMessageText',{chat_id:s.wizard_chat_id,message_id:s.wizard_message_id,text,reply_markup:markup,disable_web_page_preview:true})}catch{return safeTg18('sendMessage',{chat_id:s.telegram_id,text,reply_markup:markup})}};"
new="edit=async(text,markup,parse_mode=null)=>{try{return await tgV10('editMessageText',{chat_id:s.wizard_chat_id,message_id:s.wizard_message_id,text,reply_markup:markup,parse_mode:parse_mode||undefined,disable_web_page_preview:true})}catch{return safeTg18('sendMessage',{chat_id:s.telegram_id,text,reply_markup:markup,parse_mode:parse_mode||undefined,disable_web_page_preview:true})}};"
if old in s:
    s=s.replace(old,new,1)
elif 'edit=async(text,markup,parse_mode=null)' not in s:
    raise SystemExit('ERROR: showAddtask18 edit helper format not recognized')

# Initial sponsored order payment screen.
pay_start=s.find("if(s.step==='payment')")
if pay_start<0:
    raise SystemExit('ERROR: /addtask payment screen start not found')
pay_end=s.find("async function startAddtask18",pay_start)
if pay_end<0:
    raise SystemExit('ERROR: /addtask payment screen end not found')
pay_block=s[pay_start:pay_end]
old_text_start=pay_block.find('return edit(`')
old_text_end=pay_block.find('`,kb18(',old_text_start)
if old_text_start<0 or old_text_end<0:
    raise SystemExit('ERROR: /addtask payment text boundary not found')
prefix=pay_block[:old_text_start]
suffix=pay_block[old_text_end:]
new_text="""return edit(`💎 <b>TON Payment</b>\n\nSend: <code>${n18(o?.package_ton).toFixed(6)}</code> TON\nTo: <code>${o?.payment_address||'—'}</code>\nMemo: <code>${o?.payment_memo||'—'}</code>\n\n⚠️ Include the memo exactly.\nAfter sending, tap <b>CHECK PAYMENT</b>.`"""
suffix=suffix.replace("))}}", ", 'HTML'))}}", 1) if "'HTML'" not in suffix else suffix
s=s[:pay_start]+prefix+new_text+suffix+s[pay_end:]

# Campaign manager pending payment: locate by function boundaries, preserve current buttons.
fn=s.find('async function sponsorBotShowV30(uid,id){')
fn_end=s.find('\n\nasync function handleSponsoredTaskManagerV30',fn)
if fn<0 or fn_end<0:
    raise SystemExit('ERROR: sponsor manager function boundaries not found')
branch=s.find("if(o.status==='awaiting_payment')return{text:`",fn,fn_end)
markup=s.find('`,markup:',branch,fn_end)
branch_end=s.find('])};',markup,fn_end)
if branch<0 or markup<0 or branch_end<0:
    raise SystemExit('ERROR: sponsor manager payment boundaries not found')
branch_end+=4
tail=s[markup+2:branch_end]
manager="""if(o.status==='awaiting_payment')return{text:`💎 <b>TON Payment</b>\n\n👥 ${o.target_completions} completions\n🎁 ${o.reward_per_completion} WIENER each\n\nSend: <code>${sponsorNumV30(o.package_ton).toFixed(6)}</code> TON\nTo: <code>${o.payment_address}</code>\nMemo: <code>${o.payment_memo}</code>\n\n⚠️ Include the memo exactly.\nAfter sending, tap <b>CHECK PAYMENT</b>.`,parse_mode:'HTML',"""+tail
s=s[:branch]+manager+s[branch_end:]

# V36 top-up payment, if present.
top=s.find('await edit18(q,{text:`💎 TOP-UP PAYMENT')
if top>=0:
    top_markup=s.find('`,markup:',top)
    top_end=s.find('])});',top_markup)
    if top_markup<0 or top_end<0:
        raise SystemExit('ERROR: top-up payment boundaries not found')
    top_end+=5
    top_tail=s[top_markup+2:top_end]
    top_new="""await edit18(q,{text:`💎 <b>TON Top-up Payment</b>\n\n➕ ${x.added_completions} completions\n💵 $${sponsorNumV30(x.price_usd).toFixed(2)}\n\nSend: <code>${sponsorNumV30(x.package_ton).toFixed(6)}</code> TON\nTo: <code>${x.payment_address}</code>\nMemo: <code>${x.payment_memo}</code>\n\n⚠️ Include the memo exactly.\nAfter sending, tap <b>CHECK PAYMENT</b>.`,parse_mode:'HTML',"""+top_tail
    s=s[:top]+top_new+s[top_end:]
else:
    print('INFO: top-up payment card not present; skipped')

marker="\napp.use((_req,res)=>\n  res.status(404).json({ok:false,error:'route_not_enabled_yet'})\n);\n"
if marker in s:
    s=s.replace(marker,"\n// === WIENER COPYABLE SPONSORED PAYMENT V47B ===\n"+marker,1)
else:
    s+='\n// === WIENER COPYABLE SPONSORED PAYMENT V47B ===\n'

p.write_text(s)
print('V47B installed: copyable TON amount/address/memo in sponsored task payments')
