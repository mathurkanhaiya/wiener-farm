#!/usr/bin/env python3
from pathlib import Path

p=Path('/opt/wiener-backend/server.mjs')
if not p.exists():
    alt=Path('/opt/wiener-backend/server.js')
    if alt.exists(): p=alt
if not p.exists(): raise SystemExit('ERROR: backend file not found')
s=p.read_text()
if 'WIENER GIVEAWAY STUDIO V89' not in s:
    raise SystemExit('ERROR: Giveaway Studio V89 is not installed')
TAG='WIENER GIVEAWAY STUDIO V89E REPLY MARKUP FIX'
if TAG in s:
    print('V89E already installed')
    raise SystemExit(0)

old="if(cmd==='giveaway'){const a=await adm18(uid);const c=a?await gw89Studio(uid):await gw89UserCard(uid);await safeTg18('sendMessage',{chat_id:uid,...c});return true}"
new="if(cmd==='giveaway'){const a=await adm18(uid);const c=a?await gw89Studio(uid):await gw89UserCard(uid);await safeTg18('sendMessage',{chat_id:uid,text:c.text,reply_markup:c.markup,disable_web_page_preview:true});return true}"
if old not in s:
    # support slightly different formatting introduced by the current patch
    old2="if(cmd==='giveaway'){const a=await adm18(uid);const c=a?await gw89Studio(uid):await gw89UserCard(uid);await safeTg18('sendMessage',{chat_id:uid,...c,disable_web_page_preview:true});return true}"
    if old2 in s:
        s=s.replace(old2,new,1)
    else:
        raise SystemExit('ERROR: /giveaway sendMessage anchor not found; inspect live V89 handler')
else:
    s=s.replace(old,new,1)

# Also fix V89 flows that send card objects with a non-Telegram `markup` key.
repls={
"await safeTg18('sendMessage',{chat_id:uid,...await gw89DraftCard(uid)});":"{const c=await gw89DraftCard(uid);await safeTg18('sendMessage',{chat_id:uid,text:c.text,reply_markup:c.markup,disable_web_page_preview:true});}",
"await safeTg18('sendMessage',{chat_id:uid,...await gw89Studio(uid)});":"{const c=await gw89Studio(uid);await safeTg18('sendMessage',{chat_id:uid,text:c.text,reply_markup:c.markup,disable_web_page_preview:true});}"
}
for a,b in repls.items():
    s=s.replace(a,b)

s=s.replace('// === WIENER GIVEAWAY STUDIO V89 ===', '// === WIENER GIVEAWAY STUDIO V89E REPLY MARKUP FIX ===\n// Telegram sendMessage requires reply_markup, not the internal card key `markup`.\n// === WIENER GIVEAWAY STUDIO V89 ===',1)
p.write_text(s)
print('V89E applied: Giveaway Studio inline keyboards now use reply_markup')
