import fs from 'node:fs';
import path from 'node:path';

const roots=['src'];
const exts=new Set(['.ts','.tsx','.js','.jsx']);
let changed=0;

function patchAdminHub(s,p){
  if(!p.endsWith(`${path.sep}AdminHub.tsx`)&&!p.endsWith('AdminHub.tsx')) return s;
  s=s.replace(
    "const load=async()=>{try{setBusy(true);setD(await api('admin_get'))}catch(e:any){say(e.message)}finally{setBusy(false)}};",
    "const load=async()=>{try{setBusy(true);const raw:any=await api('admin_get');setD(raw&&typeof raw==='object'?raw:{})}catch(e:any){say(e.message);setD({})}finally{setBusy(false)}};"
  );
  s=s.replace(
    "const withdrawals=d.withdrawals||[],tasks=d.tasks||[],promos=d.promos||[],stats=d.stats||{};",
    "const withdrawals=Array.isArray(d?.withdrawals)?d.withdrawals:[],tasks=Array.isArray(d?.tasks)?d.tasks:[],promos=Array.isArray(d?.promos)?d.promos:[],stats=(d?.stats&&typeof d.stats==='object')?d.stats:{};"
  );
  s=s.replace(
    "const search=async(value=q)=>{try{setBusy(true);const r=await api('admin_user_search',{query:value});setRows(r.users||[])}catch(e:any){say(e.message)}finally{setBusy(false)}};",
    "const search=async(value=q)=>{try{setBusy(true);const r:any=await api('admin_user_search',{query:value});setRows(Array.isArray(r?.users)?r.users:[])}catch(e:any){say(e.message);setRows([])}finally{setBusy(false)}};"
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
      s=patchAdminHub(s,p);
      if(s!==before){fs.writeFileSync(p,s);changed++;console.log('VPS proxy rewrite:',p)}
    }
  }
}
for(const r of roots) if(fs.existsSync(r)) walk(r);
console.log(`VPS prebuild complete; ${changed} source file(s) rewritten.`);
