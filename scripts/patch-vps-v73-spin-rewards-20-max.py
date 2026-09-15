#!/usr/bin/env python3
from pathlib import Path
import os,re

backend=Path(os.environ.get('WIENER_BACKEND_FILE','/opt/wiener-backend/server.mjs'))
if not backend.exists():
    alt=Path('/opt/wiener-backend/server.js')
    if alt.exists(): backend=alt
frontend=Path('/opt/wiener-code/src/SpinEarn.tsx')
if not backend.exists(): raise SystemExit('ERROR: live Wiener backend not found')
if not frontend.exists(): raise SystemExit('ERROR: SpinEarn.tsx not found')

s=backend.read_text()
new="""const prizesV48=[
  {type:'wiener',amount:5,index:0,weight:28000},{type:'wiener',amount:8,index:2,weight:22000},{type:'wiener',amount:10,index:4,weight:16000},
  {type:'wiener',amount:15,index:6,weight:9000},{type:'wiener',amount:20,index:8,weight:4000},{type:'spin',amount:1,index:3,weight:12000},
  {type:'spin',amount:2,index:7,weight:4000},{type:'ton',amount:.0001,index:1,weight:3000},{type:'ton',amount:.0003,index:5,weight:1200},
  {type:'ton',amount:.001,index:9,weight:700},{type:'ton',amount:.005,index:11,weight:100}
];"""

# Replace the actual live prize table regardless of spacing or previous reward tweaks.
pat=r"const\s+prizesV48\s*=\s*\[(?:(?!\n\s*\];).|\n)*?\n\s*\];"
m=re.search(pat,s,re.S)
if m:
    current=m.group(0)
    if current!=new:
        s=s[:m.start()]+new+s[m.end():]
elif new not in s:
    raise SystemExit('ERROR: live Spin prizesV48 table not found')

# Keep TON budget fallback within the new WIENER maximum and correct wheel index.
s=re.sub(r"prize=\{type:'wiener',amount:(?:20|30|50),index:\d+,weight:0\}","prize={type:'wiener',amount:20,index:8,weight:0}",s)
backend.write_text(s)

f=frontend.read_text()
oldseg="""const segments=[
 ['wiener',5,'5 WIENER',WIENER_ICON],['ton',.0001,'0.0001 TON',TON_ICON],['wiener',10,'10 WIENER',WIENER_ICON],['spin',1,'+1 SPIN',SPIN_ICON],
 ['wiener',20,'20 WIENER',WIENER_ICON],['ton',.0003,'0.0003 TON',TON_ICON],['wiener',30,'30 WIENER',WIENER_ICON],['spin',2,'+2 SPINS',SPIN_ICON],
 ['wiener',50,'50 WIENER',WIENER_ICON],['ton',.001,'0.001 TON',TON_ICON],['wiener',5,'5 WIENER',WIENER_ICON],['ton',.005,'0.005 JACKPOT',TON_ICON]
] as const;"""
newseg="""const segments=[
 ['wiener',5,'5 WIENER',WIENER_ICON],['ton',.0001,'0.0001 TON',TON_ICON],['wiener',8,'8 WIENER',WIENER_ICON],['spin',1,'+1 SPIN',SPIN_ICON],
 ['wiener',10,'10 WIENER',WIENER_ICON],['ton',.0003,'0.0003 TON',TON_ICON],['wiener',15,'15 WIENER',WIENER_ICON],['spin',2,'+2 SPINS',SPIN_ICON],
 ['wiener',20,'20 WIENER',WIENER_ICON],['ton',.001,'0.001 TON',TON_ICON],['wiener',5,'5 WIENER',WIENER_ICON],['ton',.005,'0.005 JACKPOT',TON_ICON]
] as const;"""
if oldseg in f:
    f=f.replace(oldseg,newseg,1)
elif newseg not in f:
    # Fallback for harmless formatting changes: replace only the segments block.
    segpat=r"const\s+segments\s*=\s*\[(?:(?!\n\]\s+as\s+const;).|\n)*?\n\]\s+as\s+const;"
    sm=re.search(segpat,f,re.S)
    if not sm: raise SystemExit('ERROR: Spin frontend segments block not found')
    f=f[:sm.start()]+newseg+f[sm.end():]

# Remove duplicate/early result banner above controls; wheel/lower result remains.
oldwin='{prize&&<div className="spin-win"><img src={rewardIcon} alt=""/><small>YOU WON</small><strong>{rewardText}</strong></div>}'
f=f.replace(oldwin,'',1)

# Remove values/import used only by the removed duplicate banner.
f=f.replace(" const rewardIcon=prize?.type==='ton'?TON_ICON:prize?.type==='spin'?SPIN_ICON:WIENER_ICON;\n",'')
f=f.replace(" const rewardText=useMemo(()=>!prize?'':prize.type==='ton'?`${fmtTon(prize.amount)} TON`:prize.type==='spin'?`+${prize.amount} ${prize.amount===1?'Spin':'Spins'}`:`${prize.amount} WIENER`,[prize]);\n",'')
f=f.replace("import {useEffect,useMemo,useRef,useState} from 'react';","import {useEffect,useRef,useState} from 'react';")
frontend.write_text(f)
print('V73 applied: Spin WIENER max 20, revised weights, duplicate YOU WON banner removed')
