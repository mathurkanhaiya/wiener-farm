#!/usr/bin/env python3
from pathlib import Path
import os,re

p=Path(os.environ.get("WIENER_BACKEND_FILE","/opt/wiener-backend/server.mjs"))
if not p.exists():
    alt=Path("/opt/wiener-backend/server.js")
    if alt.exists(): p=alt

s=p.read_text()
if "WIENER GROUP GAMES V33" not in s:
    print("Group games already removed")
    raise SystemExit(0)

s,n=re.subn(r"\n// === WIENER GROUP GAMES V33 ===.*?// === END WIENER GROUP GAMES V33 ===\n","\n",s,count=1,flags=re.S)
if n!=1:
    raise SystemExit("ERROR: V33 game block not found")

s=s.replace("  if(await handleGamesV33(up,uid,text,m,q))return true;\n","",1)

for frag in [
    ",{command:'games',description:'Play WIENER group games'},{command:'gamestats',description:'Your game stats'},{command:'gameleaderboard',description:'Group game leaderboard'},{command:'cancelgame',description:'Cancel eligible game'}",
    "{command:'games',description:'Play WIENER group games'},",
    "{command:'gamestats',description:'Your game stats'},",
    "{command:'gameleaderboard',description:'Group game leaderboard'},",
    "{command:'cancelgame',description:'Cancel eligible game'},"
]:
    s=s.replace(frag,"")

p.write_text(s)
print("Removed V33 group games code and bot commands")
