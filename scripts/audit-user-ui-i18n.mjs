import fs from 'node:fs';
import path from 'node:path';

const root='src';
const ignore=/^(?:Admin|InternalTransferAdmin|MainTreasuryAdmin|EconomyUiPatch|icons|StabilityLayer)/;
const files=fs.readdirSync(root).filter(f=>f.endsWith('.tsx')&&!ignore.test(f));
const candidates=new Map();
function add(file,s){
  s=String(s||'').replace(/\s+/g,' ').trim();
  if(!s||s.length<2||s.length>180)return;
  if(!/[A-Za-z]/.test(s))return;
  if(/^(?:https?:\/\/|[A-Z0-9_./-]+\.(?:tsx|ts|css)|className|rgba|linear-gradient|radial-gradient|drop-shadow|translate|rotate|scale)/i.test(s))return;
  if(/^[A-Za-z0-9_.:-]+$/.test(s)&&!s.includes(' '))return;
  const key=`${file}\t${s}`;candidates.set(key,true);
}
for(const file of files){
 const src=fs.readFileSync(path.join(root,file),'utf8');
 // Plain JSX text between tags.
 for(const m of src.matchAll(/>([^<>{}\n][^<>{}]*)</g))add(file,m[1]);
 // User-facing props and messages.
 for(const m of src.matchAll(/(?:placeholder|title|aria-label)\s*=\s*["'`]([^"'`]+)["'`]/g))add(file,m[1]);
 for(const m of src.matchAll(/(?:say|setMessage|Error)\(\s*["'`]([^"'`]+)["'`]/g))add(file,m[1]);
 // Common ternary/button labels.
 for(const m of src.matchAll(/["'`]([A-Z][A-Za-z][^"'`]{2,90})["'`]/g)){
   const x=m[1];if(/\s/.test(x)&&!/^(?:Content-Type|cache-control|application\/json)/i.test(x))add(file,x);
 }
}
console.log('=== I18N_AUDIT_BEGIN ===');
for(const k of [...candidates.keys()].sort())console.log(k);
console.log(`=== I18N_AUDIT_END total=${candidates.size} ===`);
