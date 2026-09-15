from pathlib import Path
import re

p=Path('/opt/wiener-backend/server.mjs')
if not p.exists():
    alt=Path('/opt/wiener-backend/server.js')
    if alt.exists(): p=alt
if not p.exists(): raise SystemExit('ERROR: Wiener backend server file not found')
s=p.read_text()

TAG='WIENER USER BOT UI V76'
if TAG in s:
    print('V76 already installed')
    raise SystemExit(0)

start=s.find('async function syncTelegramV18(){')
end=s.find('async function internalV18',start)
if start<0 or end<0:
    raise SystemExit('ERROR: syncTelegramV18 block not found')

block=s[start:end]
old_commands="{command:'start',description:'Open WIENER dashboard'},{command:'menu',description:'Main menu'},{command:'balance',description:'Check WIENER balance'},{command:'farm',description:'Farm status'},{command:'ads',description:'Ads status'},{command:'tasks',description:'Available tasks'},{command:'referral',description:'Referral stats'},{command:'withdraw',description:'Open wallet'},{command:'profile',description:'Account profile'},{command:'leaderboard',description:'WIENER rankings'},{command:'promo',description:'Active promos'},{command:'giveaway',description:'Active giveaway'},{command:'addtask',description:'Create sponsored task'},{command:'support',description:'Support'},{command:'help',description:'Help and commands'}"

pat=r"setMyCommands\(\{commands:\[(.*?)\]\}\)"
m=re.search(pat,block,re.S)
if not m:
    raise SystemExit('ERROR: setMyCommands command array not found inside syncTelegramV18')

current=m.group(1)
print('Current Telegram command list detected; normalizing for V76 compatibility')
normalized=block[:m.start(1)]+old_commands+block[m.end(1):]
s=s[:start]+normalized+s[end:]
p.write_text(s)
print('V76B compatibility anchor prepared; VIP/profile handlers themselves were not removed')
