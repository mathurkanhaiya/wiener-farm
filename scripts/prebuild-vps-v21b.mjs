import fs from 'node:fs';

const src=fs.readFileSync('scripts/prebuild-vps-v21.mjs','utf8');
let fixed=src;
fixed=fixed.replace(
  "/const bindConnected=async\\(w:any,silent=false\\)=>\\{.*?\\};\\n useEffect\\(\\)=>/s,bind+'\\n useEffect(()=>','safe wallet binding'",
  "/const bindConnected=async\\(w:any,silent=false\\)=>\\{.*?\\};\\n useEffect/s,bind+'\\n useEffect','safe wallet binding'"
);
fixed=fixed.replace(
  "/ useEffect\\(\\)=>\\{const ui=getTonUI\\(\\);.*?\\},\\[\\]\\);\\n useEffect\\(\\)=>\\{if\\(!cooldownUntil\\)/s,lifecycle+'\\n useEffect(()=>{if(!cooldownUntil','wallet lifecycle'",
  "/ useEffect\\(\\(\\)=>\\{const ui=getTonUI\\(\\);.*?\\},\\[\\]\\);\\n useEffect/s,lifecycle+'\\n useEffect','wallet lifecycle'"
);
if(fixed===src)throw new Error('V21B could not repair expected matcher patterns');
fs.writeFileSync('/tmp/prebuild-vps-v21-fixed.mjs',fixed);
await import(`file:///tmp/prebuild-vps-v21-fixed.mjs?v=${Date.now()}`);
