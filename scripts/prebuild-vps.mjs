import fs from 'node:fs';
import path from 'node:path';

const roots=['src'];
const exts=new Set(['.ts','.tsx','.js','.jsx']);
let changed=0;

function patchAdsPage(s,p){
  if(!p.endsWith(`${path.sep}AdsPage.tsx`)&&!p.endsWith('AdsPage.tsx')) return s;
  s=s.replace(
    ",[adsReady,setAdsReady]=useState(false),[result,setResult]=useState<Result|null>(null)",
    ",[adsReady,setAdsReady]=useState(false),[mainUsed,setMainUsed]=useState(()=>data.user.ads_day===today()?Number(data.user.ads_watched_today||0):0),[result,setResult]=useState<Result|null>(null)"
  );
  s=s.replace(
    "const s=data.settings,u=data.user,used=u.ads_day===today()?Number(u.ads_watched_today):0,cooldown=",
    "const s=data.settings,u=data.user,used=mainUsed,cooldown="
  );
  s=s.replace(
    "setSecond(bonus);setAdsReady(true)",
    "if(mainStatus?.used!=null)setMainUsed(Number(mainStatus.used||0));setSecond(bonus);setAdsReady(true)"
  );
  s=s.replace(
    "setCooldown(Number(st.cooldown_seconds||20));setClaimOpen(false);finish('main',st)",
    "setMainUsed(v=>v+1);setCooldown(Number(st.cooldown_seconds||20));setClaimOpen(false);finish('main',st)"
  );
  return s;
}

function walk(dir){
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,ent.name);
    if(ent.isDirectory()) walk(p);
    else if(exts.has(path.extname(ent.name))){
      let s=fs.readFileSync(p,'utf8');
      const before=s;
      s=s.replace(/\$\{SUPABASE_URL\}\/functions\/v1\/([A-Za-z0-9_-]+)/g,'/api/supabase?fn=$1');
      s=s.replace(/https:\/\/[A-Za-z0-9.-]*supabase\.co\/functions\/v1\/([A-Za-z0-9_-]+)/g,'/api/supabase?fn=$1');
      s=patchAdsPage(s,p);
      if(s!==before){fs.writeFileSync(p,s);changed++;console.log('VPS proxy rewrite:',p)}
    }
  }
}
for(const r of roots) if(fs.existsSync(r)) walk(r);
console.log(`VPS prebuild complete; ${changed} source file(s) rewritten.`);
