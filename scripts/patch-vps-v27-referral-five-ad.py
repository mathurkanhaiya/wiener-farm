#!/usr/bin/env python3
from pathlib import Path
import os

p=Path(os.environ.get('WIENER_BACKEND_FILE','/opt/wiener-backend/server.mjs'))
if not p.exists():
    for q in [Path('/opt/wiener-backend/server.js'),Path('/opt/wiener-backend/server.mjs')]:
        if q.exists():
            p=q
            break
s=p.read_text()
TAG='// === WIENER REFERRAL FIVE AD RULE V27 ==='
if TAG in s:
    print('V27 referral rule already installed')
    raise SystemExit(0)

changes=0

old="A referral qualifies after ${n18(s.referral_active_ads_required)} verified ads."
if old in s:
    s=s.replace(old,"A referral qualifies after 5 verified ads.")
    changes+=1

old2="const qualified=refs.filter(r=>r.referral_active===true&&r.referral_reward_eligible!==false).length;return res.json({ok:true,data:{referrals:refs,qualified,leaderboard:lb}})"
new2="const normalized=refs.map(r=>({...r,referral_active:r.referral_reward_eligible!==false&&(r.referral_active===true||Number(r.total_ads||0)>=5)}));const qualified=normalized.filter(r=>r.referral_active===true).length;return res.json({ok:true,data:{referrals:normalized,qualified,leaderboard:lb}})"
if old2 in s:
    s=s.replace(old2,new2,1)
    changes+=1

marker="\napp.use((_req,res)=>\n  res.status(404).json({ok:false,error:'route_not_enabled_yet'})\n);\n"
if marker not in s:
    raise SystemExit('ERROR: final backend fallback marker not found')
s=s.replace(marker,"\n"+TAG+"\n"+marker,1)

if changes<1:
    raise SystemExit('ERROR: V27 could not find referral bot/API anchors; refusing partial patch')

p.write_text(s)
print(f'Installed V27 referral five-ad rule; backend_changes={changes}')
