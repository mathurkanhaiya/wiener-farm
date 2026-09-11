#!/usr/bin/env python3
from pathlib import Path

p=Path('/opt/wiener-backend/server.mjs')
if not p.exists():
    alt=Path('/opt/wiener-backend/server.js')
    if alt.exists(): p=alt
if not p.exists(): raise SystemExit('ERROR: backend file not found')
s=p.read_text()
TAG='WIENER BOT COMMAND PRIORITY V90'
if TAG in s:
    print('V90 already installed')
    raise SystemExit(0)

need=['async function handleBotFullV18','async function broadcastStart78','async function bc78Home','async function startAddtask18','async function clearAddtask18','async function safeTg18']
for x in need:
    if x not in s: raise SystemExit('ERROR: missing live helper: '+x)

anchor='async function handleBotFullV18(up,uid,text,m,q){'
pos=s.find(anchor)
if pos<0: raise SystemExit('ERROR: handleBotFullV18 anchor missing')
pos += len(anchor)

code=r'''

  // === WIENER BOT COMMAND PRIORITY V90 ===
  // Critical admin/user commands must win over stale wizard sessions.
  // Without this, /broadcast or /addtask can be consumed as draft/session text.
  if(q && String(q.data||'')==='adm:broadcast'){
    try{await bc78ClearSession(uid)}catch{}
    await bc78Home(uid,q);
    return true;
  }
  if(m?.chat?.type==='private' && /^\/(broadcast|addtask)(?:@\w+)?(?:\s|$)/i.test(String(text||''))){
    const earlyCmd=String(text||'').trim().split(/\s+/)[0].replace(/^\//,'').split('@')[0].toLowerCase();
    if(earlyCmd==='broadcast'){
      try{await adm18(uid)}catch{
        await safeTg18('sendMessage',{chat_id:uid,text:'⛔ Admin permission required.'});
        return true;
      }
      try{await bc78ClearSession(uid)}catch{}
      await broadcastStart78(uid);
      return true;
    }
    if(earlyCmd==='addtask'){
      try{await clearAddtask18(uid)}catch{}
      if(typeof sponsorBotHomeV30==='function'){
        try{
          const c=await sponsorBotHomeV30(uid);
          await safeTg18('sendMessage',{chat_id:uid,text:c.text,reply_markup:c.markup,disable_web_page_preview:true});
          return true;
        }catch(e){console.error('v90_addtask_manager',String(e?.message||e))}
      }
      await startAddtask18(uid);
      return true;
    }
  }
  // === END WIENER BOT COMMAND PRIORITY V90 ===
'''

s=s[:pos]+code+s[pos:]
p.write_text(s)
print('V90 applied: /broadcast + admin Broadcast button + /addtask now bypass stale sessions')
