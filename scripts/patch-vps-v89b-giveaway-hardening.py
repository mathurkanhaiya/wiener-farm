#!/usr/bin/env python3
from pathlib import Path
p=Path('/opt/wiener-backend/server.mjs')
if not p.exists():
    alt=Path('/opt/wiener-backend/server.js')
    if alt.exists(): p=alt
if not p.exists(): raise SystemExit('ERROR: backend file not found')
s=p.read_text()
if 'WIENER GIVEAWAY STUDIO V89' not in s: raise SystemExit('ERROR: install V89 first')
TAG='WIENER GIVEAWAY STUDIO V89B HARDENING'
if TAG in s:
    print('V89B already installed'); raise SystemExit(0)

# Never silently pass a mandatory-join requirement if its verification source is unavailable.
s=s.replace("catch{joined=true}}\n const ok=", "catch{joined=false}}\n const ok=", 1)

# Ranking mode is deterministic by campaign goal; ticket/simple modes retain secure random draw.
old="const winners=await gw89SecureDraw(final,Math.min(g.winners_count,final.length));const dist="
new="""let winners;
 if(g.mode==='ranking'){
   const ranked=[];
   for(const e of final){const x=await gw89StatsForUser(Number(e.telegram_id),g);let score=0;if(g.goal==='referrals')score=x.refs;else if(g.goal==='tasks')score=x.tasks;else score=x.ads;ranked.push({...e,score})}
   winners=ranked.sort((a,b)=>b.score-a.score||b.tickets-a.tickets||Number(a.telegram_id)-Number(b.telegram_id)).slice(0,Math.min(g.winners_count,ranked.length));
 }else winners=await gw89SecureDraw(final,Math.min(g.winners_count,final.length));
 const dist="""
if old not in s: raise SystemExit('ERROR: winner-selection anchor missing')
s=s.replace(old,new,1)

# Route V89 before V19/V18 legacy bot handlers so admin /giveaway cannot be swallowed by old giveaway code.
hook19="    try{if(await handleAdminParityV19(up,uid,text,m,q)) return done();}catch(e){console.error('v19_admin_parity',String(e?.message||e));}\n"
hook18="    try{if(await handleBotFullV18(up,uid,text,m,q)) return done();}catch(e){console.error('v18_bot_ops',String(e?.message||e));}\n"
pre="    try{if(await giveawayBotV89(uid,text,m,q)) return done();}catch(e){console.error('v89_giveaway',String(e?.message||e));}\n"
if hook19 in s: s=s.replace(hook19,pre+hook19,1)
elif hook18 in s: s=s.replace(hook18,pre+hook18,1)
else: raise SystemExit('ERROR: webhook handler hook missing')

# Marker at a harmless global location, before V89 function block.
s=s.replace('// === WIENER GIVEAWAY STUDIO V89 ===', '// === WIENER GIVEAWAY STUDIO V89B HARDENING ===\n// priority routing + strict join verification + true ranking mode\n// === WIENER GIVEAWAY STUDIO V89 ===', 1)
p.write_text(s)
print('V89B applied: giveaway priority routing, strict eligibility fallback, ranking-mode winner selection')
