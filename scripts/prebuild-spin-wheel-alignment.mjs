import fs from 'node:fs';

const p='src/SpinEarn.tsx';
if(!fs.existsSync(p)) process.exit(0);
let s=fs.readFileSync(p,'utf8');

const old="const idx=Math.max(0,Math.min(11,Number(x.index||0))),center=idx*30;setRotation(r=>r+1440+(360-center));";
const neu="const idx=Math.max(0,Math.min(11,Number(x.index||0))),center=idx*30;setRotation(r=>{const current=((r%360)+360)%360;const target=((360-center)%360+360)%360;const delta=(target-current+360)%360;return r+1440+delta});";

if(s.includes(old)) s=s.replace(old,neu);
else if(!s.includes('const current=((r%360)+360)%360')) throw new Error('Spin rotation block not found');

// Keep the visible win card strictly tied to the authoritative server prize.
s=s.replace("const rewardIcon=prize?.type==='ton'?TON_ICON:prize?.type==='spin'?SPIN_ICON:WIENER_ICON;","const rewardIcon=prize?.type==='ton'?TON_ICON:prize?.type==='spin'?SPIN_ICON:WIENER_ICON;");

fs.writeFileSync(p,s);
