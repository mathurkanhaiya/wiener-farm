import fs from 'node:fs';
import path from 'node:path';

const root='src';
const ignore=/^(?:Admin|InternalTransferAdmin|MainTreasuryAdmin|EconomyUiPatch|icons|StabilityLayer|i18n|LocalizedSurface|FullUiTranslator|selectedPack|tgPack|lib|main|adInteraction|types)/;
const files=fs.readdirSync(root).filter(f=>f.endsWith('.tsx')&&!ignore.test(f));
const candidates=new Map();
function add(file,s){
  s=String(s||'').replace(/\s+/g,' ').trim();
  if(!s||s.length<2||s.length>160)return;
  if(!/[A-Za-z]/.test(s))return;
  if(/^(?:https?:\/\/|@\w+|rgba|linear-gradient|radial-gradient|drop-shadow|translate|rotate|scale|application\/json|Content-Type|cache-control)/i.test(s))return;
  if(/^[A-Za-z0-9_.:/-]+$/.test(s)&&!s.includes(' '))return;
  if(/[{};]=?>|\b(?:const|let|return|className|useState|Number|String|Math|Date|window|document|async|await)\b/.test(s))return;
  candidates.set(`${file}\t${s}`,true);
}
for(const file of files){
 const src=fs.readFileSync(path.join(root,file),'utf8');
 for(const m of src.matchAll(/>([^<>{}\n][^<>{}]*)</g))add(file,m[1]);
 for(const m of src.matchAll(/(?:placeholder|title|aria-label)\s*=\s*["'`]([^"'`]+)["'`]/g))add(file,m[1]);
 for(const m of src.matchAll(/(?:say|setMessage|Error)\(\s*["'`]([^"'`]+)["'`]/g))add(file,m[1]);
 for(const m of src.matchAll(/["'`]([A-Z][A-Za-z][^"'`]{2,100})["'`]/g)){
   const x=m[1];if(/\s/.test(x))add(file,x);
 }
}
console.log('=== I18N_AUDIT_BEGIN ===');
for(const k of [...candidates.keys()].sort())console.log(k);
console.log(`=== I18N_AUDIT_END total=${candidates.size} ===`);
