import fs from 'node:fs';
const p='src/AdsPage.tsx';
const original=fs.readFileSync(p,'utf8');
let s=original;
if(!s.includes("from './TreasuryEarn'")){
 const anchor="import {SpinEarn} from './SpinEarn';";
 if(!s.includes(anchor))throw new Error('V104 Treasury import anchor missing');
 s=s.replace(anchor,anchor+"\nimport {TreasuryEarn} from './TreasuryEarn';");
}
if(!s.includes('<TreasuryEarn refresh={refresh} say={say}/>')){
 const anchor='<SpinEarn refresh={refresh} say={say}/>';
 if(!s.includes(anchor))throw new Error('V104 Treasury Earn anchor missing');
 s=s.replace(anchor,anchor+'<TreasuryEarn refresh={refresh} say={say}/>');
}
if(s!==original)fs.writeFileSync(p,s);
console.log('V104 secure Wiener Treasury UI restored under Earn');
