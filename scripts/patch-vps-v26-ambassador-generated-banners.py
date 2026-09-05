from pathlib import Path
import re

p=Path('/opt/wiener-backend/server.mjs')
s=p.read_text()

MARK='WIENER AMBASSADOR GENERATED BANNERS V26'
if MARK in s:
    print('V26 Ambassador generated banners already installed')
    raise SystemExit(0)

route="app.post('/functions/v1/wiener-ambassador-publish',async(req,res)=>{"
if route not in s:
    raise SystemExit('ERROR: wiener-ambassador-publish route not found')

helpers=r'''
// === WIENER AMBASSADOR GENERATED BANNERS V26 ===
const AMB_HOST_DIR_V26='/opt/wiener-host-assets';
const AMB_TEMPLATE_V26='/opt/wiener-host-assets/ambassador-promo-template';
const AMB_TEMPLATE_FALLBACK_V26='/opt/wiener-host-assets/promo-code';
const fsAmbV26=await import('node:fs/promises');
const pathAmbV26=await import('node:path');
let sharpAmbV26=null;

async function getSharpAmbV26(){
  if(!sharpAmbV26) sharpAmbV26=(await import('sharp')).default;
  return sharpAmbV26;
}
async function fileExistsAmbV26(file){
  try{await fsAmbV26.access(file);return true}catch{return false}
}
function cleanAmbCodeV26(code){
  const x=String(code||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
  if(!/^AMB[A-Z0-9]{7}$/.test(x)) throw new Error('invalid_ambassador_code');
  return x;
}
function bannerSvgAmbV26(code,width,height){
  const clean=cleanAmbCodeV26(code);
  const cx=Math.round(width*0.59),cy=Math.round(height*0.758);
  const size=Math.max(58,Math.min(92,Math.round(width*0.057*(10/Math.max(10,clean.length)))));
  const stroke=Math.max(2,Math.round(size*0.035));
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <text x="${cx+4}" y="${cy+5}" text-anchor="middle" dominant-baseline="middle"
      font-family="DejaVu Sans,Arial,sans-serif" font-size="${size}" font-weight="900"
      letter-spacing="2" fill="rgba(50,28,8,.30)">${clean}</text>
    <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle"
      font-family="DejaVu Sans,Arial,sans-serif" font-size="${size}" font-weight="900"
      letter-spacing="2" fill="#0b542f" stroke="#f8dc82" stroke-width="${stroke}" paint-order="stroke fill">${clean}</text>
  </svg>`);
}
async function cleanupAmbBannersV26(){
  try{
    const rows=(await pool.query(`select name from public.hosted_assets where name like 'ambpromo-%' and updated_at<now()-interval '7 days' limit 500`)).rows;
    for(const row of rows){
      const name=String(row.name||'');
      if(!/^ambpromo-[a-z0-9_-]+$/.test(name))continue;
      await fsAmbV26.unlink(pathAmbV26.join(AMB_HOST_DIR_V26,name)).catch(()=>null);
    }
    if(rows.length)await pool.query(`delete from public.hosted_assets where name like 'ambpromo-%' and updated_at<now()-interval '7 days'`);
  }catch(e){console.error('amb_banner_cleanup_v26',String(e?.message||e))}
}
async function renderAmbassadorBannerV26(code,adminId){
  const clean=cleanAmbCodeV26(code);
  const template=await fileExistsAmbV26(AMB_TEMPLATE_V26)?AMB_TEMPLATE_V26:(await fileExistsAmbV26(AMB_TEMPLATE_FALLBACK_V26)?AMB_TEMPLATE_FALLBACK_V26:null);
  if(!template)throw new Error('ambassador_banner_template_missing');
  const sharp=await getSharpAmbV26();
  const meta=await sharp(template).metadata();
  const width=Number(meta.width||1536),height=Number(meta.height||864);
  if(width<900||height<450)throw new Error('ambassador_banner_template_invalid');
  const asset=`ambpromo-${clean.toLowerCase()}`;
  const output=pathAmbV26.join(AMB_HOST_DIR_V26,asset);
  await sharp(template).composite([{input:bannerSvgAmbV26(clean,width,height),top:0,left:0}]).png().toFile(output);
  const stat=await fsAmbV26.stat(output);
  await pool.query(`insert into public.hosted_assets(name,storage_path,content_type,file_size,original_name,uploaded_by,updated_at)
    values($1,$1,'image/png',$2,$3,$4,now())
    on conflict(name) do update set storage_path=excluded.storage_path,content_type=excluded.content_type,file_size=excluded.file_size,original_name=excluded.original_name,uploaded_by=excluded.uploaded_by,updated_at=now()`,
    [asset,stat.size,`${asset}.png`,adminId||null]);
  return {asset,url:`https://api.viralaitools.xyz/host/${asset}`,size:stat.size};
}
// === END WIENER AMBASSADOR GENERATED BANNERS V26 ===
'''
s=s.replace(route,helpers+"\n"+route,1)

made="        made=await makeCodeV6(a);\n        const caption="
if made not in s:
    raise SystemExit('ERROR: Ambassador code creation anchor not found')
s=s.replace(made,"        made=await makeCodeV6(a);\n        const banner=await renderAmbassadorBannerV26(made.code,id);\n        const caption=",1)

s,n=re.subn(r"photo:'https://[^']+/api/host/promo-code'", "photo:banner.url", s, count=1)
if n!=1:
    raise SystemExit('ERROR: Static Ambassador promo photo anchor not found')

old="url:'https://t.me/WienerDogeFarmBot/app'"
if old in s:
    s=s.replace(old,"url:`https://t.me/WienerDogeFarmBot/app?startapp=promo_${made.code}`",1)

# Keep generated-banner references on the broadcast item when the columns exist.
insert_old="await pool.query(`insert into public.ambassador_broadcast_items(broadcast_id,ambassador_id,channel_id,channel_username,channel_title,code_1,code_2,message_id,status,posted_at) values($1,$2,$3,$4,$5,$6,null,$7,'posted',now())`,[broadcastId,a.id,a.channel_id,a.channel_username,a.channel_title,made.code,msg.message_id]);"
insert_new="await pool.query(`insert into public.ambassador_broadcast_items(broadcast_id,ambassador_id,channel_id,channel_username,channel_title,code_1,code_2,message_id,status,posted_at) values($1,$2,$3,$4,$5,$6,null,$7,'posted',now())`,[broadcastId,a.id,a.channel_id,a.channel_username,a.channel_title,made.code,msg.message_id]);\n        await pool.query(`update public.ambassador_broadcast_items set banner_asset_name=$2,banner_url=$3 where broadcast_id=$1 and ambassador_id=$4 and message_id=$5`,[broadcastId,banner.asset,banner.url,a.id,msg.message_id]).catch(()=>null);"
if insert_old in s:
    s=s.replace(insert_old,insert_new,1)

# Clean expired generated banners once per publish.
admin_anchor="    if(!await ambassadorAdminV4(id)) throw new Error('admin_forbidden');"
if admin_anchor in s:
    s=s.replace(admin_anchor,admin_anchor+"\n    await cleanupAmbBannersV26();",1)

p.write_text(s)
print('Installed WIENER Ambassador generated banners V26')
