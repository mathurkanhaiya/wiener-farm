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
// Apply the custom Adsgram icon after earlier frontend patches.
const oldIcon="<AnimatedIcon name=\"ads\" active={!mainDisabled}/>";
const adsgramIcon="<img src=\"https://pixlinkhost.vercel.app/i/2O4rXYYJTA\" alt=\"Adsgram\" width={44} height={44} style={{display:'block',objectFit:'contain',background:'transparent'}}/>";
if(!s.includes(adsgramIcon)){
 if(!s.includes(oldIcon))throw new Error('Adsgram icon anchor missing');
 s=s.replace(oldIcon,adsgramIcon);
}
// Keep icon alignment without the square tile's background, border or shadow.
s=s.replace('<div className="square play">'+adsgramIcon+'</div>',
 '<div style={{width:44,height:44,flexShrink:0,display:"grid",placeItems:"center",background:"transparent",border:0,boxShadow:"none"}}>'+adsgramIcon+'</div>');
if(s!==original)fs.writeFileSync(p,s);
console.log('USL Ads removed from frontend');
