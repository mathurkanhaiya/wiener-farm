import fs from 'node:fs';
import path from 'node:path';

const roots=['src'];
const exts=new Set(['.ts','.tsx','.js','.jsx']);
let changed=0;

function walk(dir){
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,ent.name);
    if(ent.isDirectory()) walk(p);
    else if(exts.has(path.extname(ent.name))){
      let s=fs.readFileSync(p,'utf8');
      const before=s;
      s=s.replace(/\$\{SUPABASE_URL\}\/functions\/v1\/([A-Za-z0-9_-]+)/g,'/api/supabase?fn=$1');
      s=s.replace(/https:\/\/[A-Za-z0-9.-]*supabase\.co\/functions\/v1\/([A-Za-z0-9_-]+)/g,'/api/supabase?fn=$1');
      if(s!==before){fs.writeFileSync(p,s);changed++;console.log('VPS proxy rewrite:',p)}
    }
  }
}
for(const r of roots) if(fs.existsSync(r)) walk(r);
console.log(`VPS prebuild complete; ${changed} source file(s) rewritten.`);
