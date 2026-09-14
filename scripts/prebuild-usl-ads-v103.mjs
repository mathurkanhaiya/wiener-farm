import fs from 'node:fs';

// Keep this build step to clean VPS checkouts modified by the old V103 installer.
const p='src/AdsPage.tsx';
const original=fs.readFileSync(p,'utf8');
let s=original;
s=s.replace(/<UslAdsBlock\b[^>]*\/>/g,'');
s=s.replace(/\nasync function uslApi\([\s\S]*?(?=\nexport function Ads\()/,'\n');
if(/UslAdsBlock|uslApi|loadUslSdk|TowerAds|uslads\.com/.test(s)){
 throw new Error('USL cleanup incomplete: inspect AdsPage.tsx before building');
}
if(s!==original)fs.writeFileSync(p,s);
console.log('USL Ads removed from frontend');
