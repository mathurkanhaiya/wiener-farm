from pathlib import Path
import os, re

p=Path(os.environ.get('WIENER_BACKEND_FILE','/opt/wiener-backend/server.mjs'))
if not p.exists():
    alt=Path('/opt/wiener-backend/server.js')
    if alt.exists(): p=alt
s=p.read_text()

MARK='WIENER AMBASSADOR GENERATED BANNERS V26'
if MARK in s:
    changed=0
    old_gen="const c='AMB'+crypto.randomUUID().replace(/-/g,'').slice(0,7).toUpperCase();"
    new_gen="const c='AMBA'+crypto.randomUUID().replace(/-/g,'').slice(0,6).toUpperCase();"
    if old_gen in s:
        s=s.replace(old_gen,new_gen,1); changed+=1
    if "/^AMB[A-Z0-9]{7}$/" in s:
        s=s.replace("/^AMB[A-Z0-9]{7}$/","/^AMBA[A-F0-9]{6}$/"); changed+=1
    if "/^ambpromo-[a-z0-9_-]+$/" in s:
        pass
    old_geom="""  // Large, visually centered code inside the right-hand golden ticket panel.\n  const cx=Math.round(width*0.590),cy=Math.round(height*0.755);\n  const size=Math.max(90,Math.min(118,Math.round(width*0.084*(10/Math.max(10,clean.length)))));\n  const stroke=Math.max(2,Math.round(size*0.025));"""
    new_geom="""  // Fit the code fully inside the right-hand golden ticket panel.\n  const cx=Math.round(width*0.605),cy=Math.round(height*0.795);\n  const size=Math.max(78,Math.min(100,Math.round(width*0.071*(10/Math.max(10,clean.length)))));\n  const stroke=Math.max(2,Math.round(size*0.024));"""
    if old_geom in s:
        s=s.replace(old_geom,new_geom,1); changed+=1
    if "trackAmbassadorClaimV26" not in s:
        anchor="// === END WIENER AMBASSADOR GENERATED BANNERS V26 ==="
        helper=r"""
async function trackAmbassadorClaimV26(uid,code){
  try{
    const clean=cleanAmbCodeV26(code);
    const ap=(await pool.query(`select id,ambassador_id from public.ambassador_promos where code=$1 limit 1`,[clean])).rows[0];
    if(!ap)return;
    const bi=(await pool.query(`select broadcast_id from public.ambassador_broadcast_items where ambassador_id=$1 and code_1=$2 order by posted_at desc nulls last limit 1`,[ap.ambassador_id,clean])).rows[0]||{};
    await pool.query(`insert into public.ambassador_claim_attributions(ambassador_id,promo_id,broadcast_id,code,telegram_id,claimed_at)
      values($1,$2,$3,$4,$5,now()) on conflict(code,telegram_id) do nothing`,
      [String(ap.ambassador_id),String(ap.id),bi.broadcast_id?String(bi.broadcast_id):null,clean,Number(uid)]);
  }catch(e){console.error('amb_claim_attribution_v26',String(e?.message||e))}
}
"""
        if anchor in s:
            s=s.replace(anchor,helper+"\n"+anchor,1); changed+=1
        old_finalize="async function promoFinalizeV6(id,sid){const data=await rpc('finalize_promo_reward_if_ready',[id,sid]);if(data?.status==='credited'&&data?.code)await promoSyncV6(String(data.code));return data}"
        new_finalize="async function promoFinalizeV6(id,sid){const data=await rpc('finalize_promo_reward_if_ready',[id,sid]);if(data?.status==='credited'&&data?.code){await promoSyncV6(String(data.code));await trackAmbassadorClaimV26(id,String(data.code))}return data}"
        if old_finalize in s:
            s=s.replace(old_finalize,new_finalize,1); changed+=1
    if changed:
        p.write_text(s)
        print(f'V26 Ambassador banner repair applied; changes={changed}')
    else:
        print('V26 Ambassador generated banners already installed and current')
    raise SystemExit(0)

# Force the canonical code format: AMBA + 6 uppercase hex chars, e.g. AMBA6A6B14.
old_gen="const c='AMB'+crypto.randomUUID().replace(/-/g,'').slice(0,7).toUpperCase();"
new_gen="const c='AMBA'+crypto.randomUUID().replace(/-/g,'').slice(0,6).toUpperCase();"
if old_gen in s:
    s=s.replace(old_gen,new_gen,1)
elif new_gen not in s:
    raise SystemExit('ERROR: Ambassador unique-code generator anchor not found')

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
  if(!/^AMBA[A-F0-9]{6}$/.test(x)) throw new Error('invalid_ambassador_code');
  return x;
}
function bannerSvgAmbV26(code,width,height){
  const clean=cleanAmbCodeV26(code);
  // Fit the code fully inside the right-hand golden ticket panel.
  const cx=Math.round(width*0.605),cy=Math.round(height*0.795);
  const size=Math.max(78,Math.min(100,Math.round(width*0.071*(10/Math.max(10,clean.length)))));
  const stroke=Math.max(2,Math.round(size*0.024));
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

finalize_old="async function promoFinalizeV6(id,sid){const data=await rpc('finalize_promo_reward_if_ready',[id,sid]);if(data?.status==='credited'&&data?.code)await promoSyncV6(String(data.code));return data}"
finalize_new="async function promoFinalizeV6(id,sid){const data=await rpc('finalize_promo_reward_if_ready',[id,sid]);if(data?.status==='credited'&&data?.code){await promoSyncV6(String(data.code));await trackAmbassadorClaimV26(id,String(data.code))}return data}"
if finalize_old in s:
    s=s.replace(finalize_old,finalize_new,1)
elif "trackAmbassadorClaimV26(id,String(data.code))" not in s:
    print('WARNING: promo finalization attribution hook anchor not found')

p.write_text(s)
print('Installed WIENER Ambassador generated banners V26')
