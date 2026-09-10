#!/usr/bin/env python3
from pathlib import Path

p=Path('/opt/wiener-backend/server.mjs')
if not p.exists():
    alt=Path('/opt/wiener-backend/server.js')
    if alt.exists(): p=alt
if not p.exists(): raise SystemExit('ERROR: backend file not found')

s=p.read_text()
if 'WIENER GIVEAWAY STUDIO V89' not in s:
    raise SystemExit('ERROR: V89 Giveaway Studio is not installed')
TAG='WIENER GIVEAWAY STUDIO V89D BUTTON'
if TAG in s:
    print('V89D giveaway button already installed')
    raise SystemExit(0)

changed=0
# Route the existing admin-panel giveaway button directly to the new Studio.
old="cb18('🎉 GIVEAWAYS','adm:gives')"
new="cb18('🎁 GIVEAWAY STUDIO','gw89:home')"
if old in s:
    s=s.replace(old,new)
    changed+=1

# Make /giveaway visible in the current V76 public command menu. Admins get the Studio;
# normal users get the active giveaway view through V89's existing role-aware handler.
patterns=[
    ("{command:'profile',description:'VIP profile card'},{command:'help',description:'Help & support'}",
     "{command:'profile',description:'VIP profile card'},{command:'giveaway',description:'Giveaway'},{command:'help',description:'Help & support'}"),
    ("{command:'leaderboard',description:'WIENER rankings'},{command:'support',description:'Support'}",
     "{command:'leaderboard',description:'WIENER rankings'},{command:'giveaway',description:'Giveaway'},{command:'support',description:'Support'}")
]
for a,b in patterns:
    if a in s:
        s=s.replace(a,b)
        changed+=1

if not changed:
    raise SystemExit('ERROR: no known admin-button/command-menu anchor found; backend left unchanged')

# Add a marker near the V89 block so re-runs are safe.
s=s.replace('// === WIENER GIVEAWAY STUDIO V89 ===',
            '// === WIENER GIVEAWAY STUDIO V89D BUTTON ===\n// admin button + visible /giveaway command\n// === WIENER GIVEAWAY STUDIO V89 ===',1)
p.write_text(s)
print(f'V89D applied: {changed} giveaway button/command menu updates')
