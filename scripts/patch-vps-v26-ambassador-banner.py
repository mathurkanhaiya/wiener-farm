#!/usr/bin/env python3
from pathlib import Path
import os

p=Path(os.environ.get('WIENER_BACKEND_FILE','/opt/wiener-backend/server.mjs'))
if not p.exists():
    alt=Path('/opt/wiener-backend/server.js')
    if alt.exists(): p=alt
s=p.read_text()
TAG='// === WIENER AMBASSADOR BANNER V26 ==='
if TAG in s:
    print('V26 already installed')
    raise SystemExit(0)

needle="const HOST_DIR_V14='/opt/wiener-host-assets';"
if needle not in s:
    raise SystemExit('ERROR: V14 hosted asset system required')

helper=r'''
// === WIENER AMBASSADOR BANNER V26 ===
// Uses the hosted asset `ambassador-promo-template` as the immutable master.
// Rendering uses SVG + sharp on the VPS; generated files are served by the existing /host/:name route.
let sharpV26=null;
async function sharp26(){if(!sharpV26){const m=await import('sharp');sharpV26=m.default||m}return sharpV26}
const xml26=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
async function ambassadorTemplateV26(){
  for(const n of ['ambassador-promo-template','promo-code']){
    try{const f=pathV14.join(HOST_DIR_V14,n);const st=await fsV14.stat(f);if(st.isFile())return f}catch{}
  }
  throw new Error('ambassador_promo_template_missing');
}
async function renderAmbassadorBannerV26(code,adminId=null){
  const clean=String(code||'').trim().toUpperCase();
  if(!/^AMB[A-Z0-9]{7}$/.test(clean))throw new Error('invalid_ambassador_code');
  const template=await ambassadorTemplateV26();
  const image=await sharp26()(template).metadata();
  const w=Number(image.width||1536),h=Number(image.height||864);
  // The uploaded WIENER template ticket occupies roughly x=400..1400, y=525..785 at 1536x864.
  const x=Math.round(w*0.586), y=Math.round(h*0.755);
  const fs=Math.max(44,Math.round(w*(clean.length<=10?0.057:0.050)));
  const svg=Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><style>.s{font-family:Arial,Helvetica,sans-serif;font-weight:900;font-size:${fs}px;letter-spacing:2px;fill:#16552b;stroke:#0d3b20;stroke-width:1px;paint-order:stroke}.sh{font-family:Arial,Helvetica,sans-serif;font-weight:900;font-size:${fs}px;letter-spacing:2px;fill:rgba(0,0,0,.18)}</style><text x="${x+4}" y="${y+4}" text-anchor="middle" dominant-baseline="middle" class="sh">${xml26(clean)}</text><text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" class="s">${xml26(clean)}</text></svg>`);
  const name=`ambpromo-${clean.toLowerCase()}`;
  const file=pathV14.join(HOST_DIR_V14,name);
  await sharp26()(template).composite([{input:svg,top:0,left:0}]).png().toFile(file);
  const st=await fsV14.stat(file);
  await pool.query(`insert into public.hosted_assets(name,storage_path,content_type,file_size,original_name,uploaded_by,updated_at) values($1,$1,'image/png',$2,$3,$4,now()) on conflict(name) do update set storage_path=excluded.storage_path,content_type=excluded.content_type,file_size=excluded.file_size,original_name=excluded.original_name,uploaded_by=excluded.uploaded_by,updated_at=now()`,[name,st.size,name+'.png',adminId]);
  const app=String((await settingsV14()).app_url||'https://wiener.viralaitools.xyz').replace(/\/$/,'');
  return {name,url:`${app}/api/host/${name}`};
}
// === END WIENER AMBASSADOR BANNER V26 ===
'''
s=s.replace(needle,needle+'\n'+helper,1)

old="made=await makeCodeV6(a);\n        const caption=`👤 First 100 Active Users Only!"
new="made=await makeCodeV6(a);\n        const bannerV26=await renderAmbassadorBannerV26(made.code,id);\n        const caption=`👤 First 100 Active Users Only!"
if old not in s:
    raise SystemExit('ERROR: ambassador publish insertion point not found')
s=s.replace(old,new,1)

oldphoto="photo:'https://wiener-farm.vercel.app/api/host/promo-code'"
if oldphoto not in s:
    raise SystemExit('ERROR: static ambassador promo photo not found')
s=s.replace(oldphoto,"photo:bannerV26.url",1)

# Make the existing button deep-link the generated promo code so PromoClaim can prefill it.
oldbtn="url:'https://t.me/WienerDogeFarmBot/app'"
if oldbtn in s:
    s=s.replace(oldbtn,"url:`https://t.me/WienerDogeFarmBot/app?startapp=promo_${made.code}`",1)

p.write_text(s)
print('Installed WIENER AMBASSADOR BANNER V26')
