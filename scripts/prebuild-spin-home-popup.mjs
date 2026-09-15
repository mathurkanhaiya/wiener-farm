import fs from 'node:fs';

// Mount the spin availability popup at App root so it is visible on Home.
const app='src/App.tsx';
if(fs.existsSync(app)){
 let s=fs.readFileSync(app,'utf8');
 if(!s.includes("from './SpinHomePopup'")){
  s=s.replace("import {RestrictedSticker} from './RestrictedSticker';","import {RestrictedSticker} from './RestrictedSticker';\nimport {SpinHomePopup} from './SpinHomePopup';");
 }
 const needle='<FarmClaimModal open={farmClaimOpen} data={data} onClose={()=>setFarmClaimOpen(false)} refresh={refresh} say={say}/>';
 if(s.includes(needle)&&!s.includes('<SpinHomePopup tab={tab} setTab={setTab}/>'+needle)){
  s=s.replace(needle,'<SpinHomePopup tab={tab} setTab={setTab}/>'+needle);
 }
 fs.writeFileSync(app,s);
}

// Allow the homepage CTA to open the existing Spin & Earn sheet after switching to Ads.
const spin='src/SpinEarn.tsx';
if(fs.existsSync(spin)){
 let s=fs.readFileSync(spin,'utf8');
 const mount="useEffect(()=>{mounted.current=true;void load();return()=>{mounted.current=false}},[]);";
 if(s.includes(mount)&&!s.includes("wiener-open-spin")){
  s=s.replace(mount,mount+"\n useEffect(()=>{const openSpin=()=>{setOpen(true);void load()};window.addEventListener('wiener-open-spin',openSpin);return()=>window.removeEventListener('wiener-open-spin',openSpin)},[]);");
 }
 fs.writeFileSync(spin,s);
}
