#!/usr/bin/env python3
from pathlib import Path
import os

p=Path(os.environ.get('WIENER_BACKEND_FILE','/opt/wiener-backend/server.mjs'))
if not p.exists():
    alt=Path('/opt/wiener-backend/server.js')
    if alt.exists(): p=alt

s=p.read_text()
TAG='WIENER VIP PROFILE EXPERIENCE V40'
if TAG in s:
    print('V40 profile experience already installed')
    raise SystemExit(0)

if 'WIENER VIP PROFILE CARD V39' not in s:
    raise SystemExit('ERROR: V39 VIP profile card is required first')

old=r"""  if(m&&text.startsWith('/')){
    const pcmd=text.split(/\s+/)[0].replace(/^\//,'').split('@')[0].toLowerCase();
    if(pcmd==='profile'||pcmd==='card'){await profileV39.sendCard(m.chat.id,uid);return true}
    if(pcmd==='stats'){await safeTg18('sendMessage',{chat_id:m.chat.id,text:await profileV39.stats(uid,m.chat.type==='private')});return true}
  }
"""
new=r"""  if(m&&text.startsWith('/')){
    const pparts=text.split(/\s+/),pcmd=pparts[0].replace(/^\//,'').split('@')[0].toLowerCase();
    if(pcmd==='verify'){await profileV39.verifyMessage(m.chat.id,pparts[1]||'');return true}
    if(pcmd==='theme'){await profileV39.themeMenu(m.chat.id,uid);return true}
    if(pcmd==='profile'||pcmd==='card'||pcmd==='stats'){
      const target=await profileV39.resolveTarget(m,uid,pparts[1]||'');
      if(pcmd==='stats')await safeTg18('sendMessage',{chat_id:m.chat.id,text:await profileV39.stats(target,m.chat.type==='private'&&target===uid)});
      else await profileV39.sendCard(m.chat.id,target,uid,true);
      return true;
    }
  }
"""
if old not in s:
    raise SystemExit('ERROR: V39 profile command block not found')
s=s.replace(old,new,1)

oldcmd="{command:'profile',description:'Generate VIP profile card'},{command:'card',description:'Shareable VIP card'},{command:'stats',description:'Profile statistics'}"
newcmd="{command:'profile',description:'Generate VIP profile card'},{command:'card',description:'Shareable VIP card'},{command:'stats',description:'Profile statistics'},{command:'theme',description:'Choose profile card theme'},{command:'verify',description:'Verify a Wiener card'}"
if oldcmd in s:
    s=s.replace(oldcmd,newcmd,1)

help_old="/profile — Profile\n/leaderboard"
help_new="/profile — VIP profile card\n/card — Shareable profile card\n/stats — Detailed profile stats\n/theme — Card themes\n/verify <code> — Verify profile card\n/leaderboard"
if help_old in s:
    s=s.replace(help_old,help_new,1)

anchor='// === END WIENER VIP PROFILE CARD V39 ==='
if anchor not in s:
    raise SystemExit('ERROR: V39 marker anchor missing')
s=s.replace(anchor,anchor+"\n// === WIENER VIP PROFILE EXPERIENCE V40 ===",1)

p.write_text(s)
print('V40 installed: reply profiles + themes + verification + generation progress')
