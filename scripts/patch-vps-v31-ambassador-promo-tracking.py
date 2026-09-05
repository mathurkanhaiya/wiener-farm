from pathlib import Path
import os,re

p=Path(os.environ.get('WIENER_BACKEND_FILE','/opt/wiener-backend/server.mjs'))
if not p.exists():
    alt=Path('/opt/wiener-backend/server.js')
    if alt.exists(): p=alt
s=p.read_text()
TAG='WIENER AMBASSADOR PROMO TRACKING V31'
if TAG in s:
    print('V31 ambassador promo tracking already installed')
    raise SystemExit(0)
if 'async function promoFinalizeV6' not in s:
    raise SystemExit('ERROR: promoFinalizeV6 missing')
if 'WIENER AMBASSADOR GENERATED BANNERS V26' not in s:
    raise SystemExit('ERROR: Ambassador V26 missing')

helper=r'''
// === WIENER AMBASSADOR PROMO TRACKING V31 ===
function isAmbassadorPromoV31(code){
  return /^AMBA[A-F0-9]{6}$/i.test(String(code||'').trim());
}
async function trackAmbassadorClaimV31(uid,code,sid=null){
  const clean=String(code||'').trim().toUpperCase();
  if(!isAmbassadorPromoV31(clean))return{ambassador:false,tracked:false,reason:'not_ambassador_code'};

  try{
    let ap=(await pool.query(`select * from public.ambassador_promos where upper(code)=upper($1) limit 1`,[clean])).rows[0]||null;
    let ambassadorId=ap?.ambassador_id?String(ap.ambassador_id):null;
    let promoId=ap?.id==null?null:String(ap.id);
    let broadcastId=null;

    const item=(await pool.query(`
      select broadcast_id,ambassador_id
      from public.ambassador_broadcast_items
      where upper(code_1)=upper($1) or upper(code_2)=upper($1)
      order by posted_at desc nulls last
      limit 1
    `,[clean])).rows[0]||null;
    if(item?.ambassador_id&&!ambassadorId)ambassadorId=String(item.ambassador_id);
    if(item?.broadcast_id)broadcastId=String(item.broadcast_id);

    if(!ambassadorId){
      const pc=(await pool.query(`select note from public.promo_codes where upper(code)=upper($1) limit 1`,[clean])).rows[0];
      const m=String(pc?.note||'').match(/^ambassador:([^:]+):broadcast:([^:]+)$/i);
      if(m){ambassadorId=String(m[1]);if(!broadcastId)broadcastId=String(m[2])}
    }
    if(!ambassadorId){
      console.error('amb_claim_v31_unmapped',JSON.stringify({uid:Number(uid),code:clean,sid:sid?String(sid):null}));
      return{ambassador:true,tracked:false,reason:'ambassador_mapping_missing'};
    }

    const q=await pool.query(`
      insert into public.ambassador_claim_attributions(ambassador_id,promo_id,broadcast_id,code,telegram_id,claimed_at)
      values($1,$2,$3,$4,$5,now())
      on conflict(code,telegram_id) do nothing
      returning id
    `,[ambassadorId,promoId,broadcastId,clean,Number(uid)]);
    return{ambassador:true,tracked:q.rowCount>0,duplicate:q.rowCount===0,ambassador_id:ambassadorId,broadcast_id:broadcastId};
  }catch(e){
    console.error('amb_claim_attribution_v31',JSON.stringify({uid:Number(uid),code:clean,sid:sid?String(sid):null,error:String(e?.message||e)}));
    return{ambassador:true,tracked:false,reason:'tracking_error'};
  }
}
// === END WIENER AMBASSADOR PROMO TRACKING V31 ===
'''

anchor='// === END WIENER AMBASSADOR GENERATED BANNERS V26 ==='
if anchor not in s:
    raise SystemExit('ERROR: V26 helper end marker missing')
s=s.replace(anchor,helper+'\n'+anchor,1)

pat=r"async function promoFinalizeV6\(id,sid\)\{.*?\}"
matches=list(re.finditer(pat,s,re.S))
if not matches:
    raise SystemExit('ERROR: promoFinalizeV6 body not found')
m=matches[-1]
new=r'''async function promoFinalizeV6(id,sid){
  const data=await rpc('finalize_promo_reward_if_ready',[id,sid]);
  if(data?.status==='credited'){
    let code=String(data?.code||'').trim().toUpperCase();
    if(!code){
      try{code=String((await pool.query(`select code from public.promo_ad_sessions where id=$1 and telegram_id=$2 limit 1`,[sid,id])).rows[0]?.code||'').trim().toUpperCase()}catch{}
    }
    if(code){
      await promoSyncV6(code);
      if(isAmbassadorPromoV31(code))await trackAmbassadorClaimV31(id,code,sid);
      if(!data?.code&&data&&typeof data==='object')data.code=code;
    }
  }
  return data;
}'''
s=s[:m.start()]+new+s[m.end():]

# Disable the old V26 hook path if it remains elsewhere, so normal promos never
# produce invalid_ambassador_code noise and Ambassador codes are tracked once.
s=s.replace("await trackAmbassadorClaimV26(id,String(data.code))","await trackAmbassadorClaimV31(id,String(data.code),sid)")

p.write_text(s)
print('V31 installed: normal promos bypass Ambassador tracker; AMBA claims resolve code from session and track reliably')
