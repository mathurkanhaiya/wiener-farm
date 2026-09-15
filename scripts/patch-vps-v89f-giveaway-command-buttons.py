#!/usr/bin/env python3
from pathlib import Path
import re

p=Path('/opt/wiener-backend/server.mjs')
if not p.exists():
    alt=Path('/opt/wiener-backend/server.js')
    if alt.exists(): p=alt
if not p.exists(): raise SystemExit('ERROR: backend file not found')
s=p.read_text()
if 'WIENER GIVEAWAY STUDIO V89' not in s:
    raise SystemExit('ERROR: Giveaway Studio V89 is not installed')
TAG='WIENER GIVEAWAY STUDIO V89F COMMAND BUTTON FIX'
if TAG in s:
    print('V89F already installed')
    raise SystemExit(0)

start=s.find('async function giveawayBotV89(')
if start<0:
    raise SystemExit('ERROR: giveawayBotV89 handler not found')
end=s.find('// === END WIENER GIVEAWAY STUDIO V89 ===', start)
if end<0:
    raise SystemExit('ERROR: giveawayBotV89 end marker not found')
block=s[start:end]

# Direct /giveaway command: normalize any card-object send into Telegram's expected reply_markup field.
pat=re.compile(r"if\s*\(cmd\s*===\s*['\"]giveaway['\"]\)\s*\{(?P<body>.*?)return\s+true\s*;?\s*\}", re.S)
m=pat.search(block)
if not m:
    raise SystemExit('ERROR: /giveaway command branch not found inside giveawayBotV89')
body=m.group('body')

# Preserve the branch's admin/user selection, but replace only the sendMessage call.
if 'gw89Studio' not in body or 'gw89UserCard' not in body:
    raise SystemExit('ERROR: unexpected /giveaway branch shape')

# Find the local card variable if present; current V89 uses c.
var='c'
vm=re.search(r"const\s+([A-Za-z_$][\w$]*)\s*=\s*a\s*\?\s*await\s+gw89Studio\(uid\)\s*:\s*await\s+gw89UserCard\(uid\)", body)
if vm: var=vm.group(1)

send_re=re.compile(r"await\s+safeTg18\(\s*['\"]sendMessage['\"]\s*,\s*\{.*?\}\s*\)\s*;?", re.S)
if not send_re.search(body):
    raise SystemExit('ERROR: sendMessage call not found in /giveaway branch')
body=send_re.sub(f"await safeTg18('sendMessage',{{chat_id:uid,text:{var}.text,reply_markup:{var}.markup,disable_web_page_preview:true}});", body, count=1)
newbranch="if(cmd==='giveaway'){"+body+"return true}"
block=block[:m.start()]+newbranch+block[m.end():]

# Input-step cards can also be sent with spread syntax; normalize those known card senders.
block=re.sub(
    r"await\s+safeTg18\(\s*['\"]sendMessage['\"]\s*,\s*\{\s*chat_id\s*:\s*uid\s*,\s*\.\.\.\s*await\s+gw89DraftCard\(uid\)\s*\}\s*\)\s*;?",
    "{const _gw=await gw89DraftCard(uid);await safeTg18('sendMessage',{chat_id:uid,text:_gw.text,reply_markup:_gw.markup,disable_web_page_preview:true});}",
    block
)
block=re.sub(
    r"await\s+safeTg18\(\s*['\"]sendMessage['\"]\s*,\s*\{\s*chat_id\s*:\s*uid\s*,\s*\.\.\.\s*await\s+gw89Studio\(uid\)\s*\}\s*\)\s*;?",
    "{const _gw=await gw89Studio(uid);await safeTg18('sendMessage',{chat_id:uid,text:_gw.text,reply_markup:_gw.markup,disable_web_page_preview:true});}",
    block
)

s=s[:start]+block+s[end:]
s=s.replace('// === WIENER GIVEAWAY STUDIO V89 ===', '// === WIENER GIVEAWAY STUDIO V89F COMMAND BUTTON FIX ===\n// direct command cards now map internal markup -> Telegram reply_markup\n// === WIENER GIVEAWAY STUDIO V89 ===',1)
p.write_text(s)
print('V89F applied: /giveaway command now sends inline keyboard reliably')
