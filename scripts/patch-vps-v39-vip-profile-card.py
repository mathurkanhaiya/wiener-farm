from pathlib import Path

p=Path('/opt/wiener-backend/server.mjs')
if not p.exists():
    alt=Path('/opt/wiener-backend/server.js')
    if alt.exists(): p=alt

s=p.read_text()
TAG='WIENER VIP PROFILE CARD V39'
if TAG in s:
    print('V39 VIP profile already installed')
    raise SystemExit(0)

for need in ['WIENER VPS FULL BOT PARITY V18','async function register18','async function handleBotFullV18','async function syncTelegramV18']:
    if need not in s:
        raise SystemExit('ERROR: required bot feature missing: '+need)

anchor='async function register18(m){'
glue="""// === WIENER VIP PROFILE CARD V39 ===
const profileV39=(await import('./profile-v39.mjs')).createProfileSystem({
  pool,
  BOT,
  tg:tgV10,
  safe:safeTg18,
  n:n18,
  fmt:fmt18,
  kb:kb18,
  cb:cb18,
  url:url18,
  usr:usr18
});
// === END WIENER VIP PROFILE CARD V39 ===

"""
s=s.replace(anchor,glue+anchor,1)

s=s.replace("cb18('📊 Profile','ux:profile')","cb18('👑 VIP Profile','pc39:make')",1)

uid_anchor="  if(!uid&&!q)return false;\n"
if uid_anchor not in s:
    raise SystemExit('ERROR: bot uid anchor missing')
cmd="""  if(m&&text.startsWith('/')){
    const pcmd=text.split(/\\s+/)[0].replace(/^\\//,'').split('@')[0].toLowerCase();
    if(pcmd==='profile'||pcmd==='card'){await profileV39.sendCard(m.chat.id,uid);return true}
    if(pcmd==='stats'){await safeTg18('sendMessage',{chat_id:m.chat.id,text:await profileV39.stats(uid,m.chat.type==='private')});return true}
  }
"""
s=s.replace(uid_anchor,uid_anchor+cmd,1)

cb_anchor='  // User/menu callbacks.\n'
if cb_anchor not in s:
    raise SystemExit('ERROR: user/menu callback anchor missing')
s=s.replace(cb_anchor,"  if(q&&await profileV39.handle(q))return true;\n\n"+cb_anchor,1)

old="{command:'profile',description:'Account profile'}"
new="{command:'profile',description:'Generate VIP profile card'},{command:'card',description:'Shareable VIP card'},{command:'stats',description:'Profile statistics'}"
if old in s:
    s=s.replace(old,new,1)

p.write_text(s)
print('V39 installed: /profile VIP card in private and groups + sticker + stats')
