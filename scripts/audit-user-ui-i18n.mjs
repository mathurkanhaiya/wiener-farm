import fs from 'node:fs';
import path from 'node:path';

const root='src';
const ignore=/^(?:Admin|InternalTransferAdmin|MainTreasuryAdmin|EconomyUiPatch|icons|StabilityLayer|i18n|LocalizedSurface|FullUiTranslator|selectedPack|tgPack|lib|main|adInteraction|types)/;
const files=fs.readdirSync(root).filter(f=>f.endsWith('.tsx')&&!ignore.test(f));
const candidates=new Map();
function add(file,s){
  s=String(s||'').replace(/\s+/g,' ').trim();
  if(!s||s.length<2||s.length>180)return;
  if(!/[A-Za-z]/.test(s))return;
  if(/^(?:https?:\/\/|@\w+|rgba|linear-gradient|radial-gradient|drop-shadow|translate|rotate|scale|application\/json|Content-Type|cache-control)/i.test(s))return;
  if(/^[A-Za-z0-9_.:/-]+$/.test(s)&&!s.includes(' '))return;
  if(/[{};]=?>|\b(?:const|let|return|className|useState|Number|String|Math|Date|window|document|async|await)\b/.test(s))return;
  candidates.set(`${file}\t${s}`,{file,s});
}
for(const file of files){
 const src=fs.readFileSync(path.join(root,file),'utf8');
 for(const m of src.matchAll(/>([^<>{}\n][^<>{}]*)</g))add(file,m[1]);
 for(const m of src.matchAll(/(?:placeholder|title|aria-label)\s*=\s*["'`]([^"'`]+)["'`]/g))add(file,m[1]);
 for(const m of src.matchAll(/(?:say|setMessage|Error)\(\s*["'`]([^"'`]+)["'`]/g))add(file,m[1]);
 for(const m of src.matchAll(/["'`]([A-Z][A-Za-z][^"'`]{2,120})["'`]/g)){const x=m[1];if(/\s/.test(x))add(file,x)}
}

// Exact source phrases translated by LocalizedSurface, the historical direct phrase
// pack, or V75 newest-feature packs. This runs after prebuild, so all build-time
// translation layers are visible here.
const covered=new Set();
for(const f of ['src/LocalizedSurface.tsx','src/FullUiTranslator.tsx','src/i18n-v75-a.ts','src/i18n-v75-b.ts','src/i18n-v75-c.ts','src/i18n-v75-d.ts']){
 if(!fs.existsSync(f))continue;
 const src=fs.readFileSync(f,'utf8');
 for(const m of src.matchAll(/['"]([^'"\n]{2,220})['"]\s*:/g))covered.add(m[1].replace(/\\'/g,"'").trim());
}
const dynamic=[
 /^Ready in\s+.+$/i,/^Today's farms\s*·/i,/^Minimum is\s+.+\.$/i,/^Next withdrawal available in\s+.+$/i,
 /^\d+\s+current tasks completed$/i,/^Streak\s*·\s*Day\s+.+\s+of\s+7$/i,/^Best streak:\s*\d+\s+days/i,
 /^.+\s+today$/i,/^.+\s+each(?:\s*·.*)?$/i,/^Ends\s+.+$/i,/^Next ad in\s+.+$/i,
 /^You could[’']ve earned\s+.+?\s+more WIENER/i,
 /^Week\s+\d+\s*·\s*Day\s+\d+\s+(?:claimed|of\s+7)$/i,/^CLAIM(?: DAY 7 \+ ⭐ ·)?\s+[\d.,]+\s+WIENER$/i,
 /^WATCH AD\s*·\s*\d+\/\d+$/i,/^Minimum withdrawal is\s+[\d.]+\s+TON$/i,/^Next withdrawal in\s+.+$/i,
 /^AdsGram — \d+ ads$/i,/^Bonus Ads — \d+ ads$/i,/^.+ WIENER · \d+\/\d+ today$/i,/^WATCH AD → \+1 SPIN \(\d+ left\)$/i
];
const technical=(s)=>/^(?:WIENER|TON|GRAM|USDT|Polygon|BEP20|AdsGram|TX Hash|TON Connect|UQ… \/ EQ…|\d+(?:\.\d+)?\s*(?:WIENER|TON|USDT)?|[+≈$].*)$/i.test(s.trim());
const uncovered=[];
for(const {file,s} of candidates.values()){
 if(covered.has(s)||dynamic.some(r=>r.test(s))||technical(s))continue;
 uncovered.push(`${file}\t${s}`);
}
console.log('=== I18N_UNCOVERED_BEGIN ===');
for(const k of uncovered.sort())console.log(k);
console.log(`=== I18N_UNCOVERED_END total=${uncovered.length} candidates=${candidates.size} coveredExact=${covered.size} ===`);
