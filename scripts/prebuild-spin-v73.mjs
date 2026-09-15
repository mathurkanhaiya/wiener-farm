import fs from 'node:fs';

const file='src/SpinEarn.tsx';
if(!fs.existsSync(file)) throw new Error(`Missing ${file}`);
let s=fs.readFileSync(file,'utf8');

const oldSeg=`const segments=[
 ['wiener',5,'5 WIENER',WIENER_ICON],['ton',.0001,'0.0001 TON',TON_ICON],['wiener',10,'10 WIENER',WIENER_ICON],['spin',1,'+1 SPIN',SPIN_ICON],
 ['wiener',20,'20 WIENER',WIENER_ICON],['ton',.0003,'0.0003 TON',TON_ICON],['wiener',30,'30 WIENER',WIENER_ICON],['spin',2,'+2 SPINS',SPIN_ICON],
 ['wiener',50,'50 WIENER',WIENER_ICON],['ton',.001,'0.001 TON',TON_ICON],['wiener',5,'5 WIENER',WIENER_ICON],['ton',.005,'0.005 JACKPOT',TON_ICON]
] as const;`;
const newSeg=`const segments=[
 ['wiener',5,'5 WIENER',WIENER_ICON],['ton',.0001,'0.0001 TON',TON_ICON],['wiener',8,'8 WIENER',WIENER_ICON],['spin',1,'+1 SPIN',SPIN_ICON],
 ['wiener',10,'10 WIENER',WIENER_ICON],['ton',.0003,'0.0003 TON',TON_ICON],['wiener',15,'15 WIENER',WIENER_ICON],['spin',2,'+2 SPINS',SPIN_ICON],
 ['wiener',20,'20 WIENER',WIENER_ICON],['ton',.001,'0.001 TON',TON_ICON],['wiener',5,'5 WIENER',WIENER_ICON],['ton',.005,'0.005 JACKPOT',TON_ICON]
] as const;`;

if(s.includes(oldSeg)) s=s.replace(oldSeg,newSeg);
else if(!s.includes(newSeg)) throw new Error('V73 Spin frontend segment anchor missing');

const win='{prize&&<div className="spin-win"><img src={rewardIcon} alt=""/><small>YOU WON</small><strong>{rewardText}</strong></div>}';
if(s.includes(win)) s=s.replace(win,'');

s=s.replace(" const rewardIcon=prize?.type==='ton'?TON_ICON:prize?.type==='spin'?SPIN_ICON:WIENER_ICON;\n",'');
s=s.replace(" const rewardText=useMemo(()=>!prize?'':prize.type==='ton'?`${fmtTon(prize.amount)} TON`:prize.type==='spin'?`+${prize.amount} ${prize.amount===1?'Spin':'Spins'}`:`${prize.amount} WIENER`,[prize]);\n",'');
s=s.replace("import {useEffect,useMemo,useRef,useState} from 'react';","import {useEffect,useRef,useState} from 'react';");

if(s.includes('30 WIENER')||s.includes('50 WIENER')) throw new Error('V73 Spin frontend still contains rewards above 20');
if(s.includes('YOU WON')) throw new Error('V73 duplicate YOU WON banner still present');
fs.writeFileSync(file,s);
console.log('V73 Spin frontend verified/applied: max 20 WIENER, duplicate YOU WON removed');
