#!/usr/bin/env python3
from pathlib import Path
import os

p=Path(os.environ.get('WIENER_BACKEND_FILE','/opt/wiener-backend/server.mjs'))
if not p.exists():
    alt=Path('/opt/wiener-backend/server.js')
    if alt.exists(): p=alt
if not p.exists(): raise SystemExit('ERROR: backend file not found')
s=p.read_text()
TAG='WIENER AMBASSADOR PROMO REWARD V91'
if TAG in s:
    print('V91 ambassador promo reward already installed')
    raise SystemExit(0)

changed=0
old="const reward=num(settings?.promo_reward_wiener)||10;"
new="const reward=num(settings?.promo_reward_wiener)||20;"
if old in s:
    s=s.replace(old,new,1); changed+=1
elif new not in s:
    raise SystemExit('ERROR: ambassador promo reward fallback anchor not found')

old_caption="🎁 Reward: ${reward} WIENER"
new_caption="🎁 Reward: ${reward} WIENER (${(reward/20000).toFixed(3)}$)"
if old_caption in s:
    s=s.replace(old_caption,new_caption,1); changed+=1
elif new_caption not in s:
    raise SystemExit('ERROR: ambassador promo caption anchor not found')

marker="// === WIENER AMBASSADOR GENERATED BANNERS V26 ==="
if marker not in s:
    marker="app.post('/functions/v1/wiener-ambassador-publish'"
    if marker not in s: raise SystemExit('ERROR: ambassador publish system not found')

insert="// === WIENER AMBASSADOR PROMO REWARD V91 ===\n// Ambassador promo codes use 20 WIENER; display equivalent at 20,000 WIENER = $1. Existing claimed codes are not rewritten.\n"
s=s.replace(marker,insert+marker,1)
p.write_text(s)
print(f'V91 backend patch applied; changes={changed}')
