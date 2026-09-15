from pathlib import Path

p=Path('/opt/wiener-backend/server.mjs')
s=p.read_text()
TAG='WIENER VPS SUPABASE ADMIN PARITY V19B'
if TAG in s:
    print('V19B admin alerts already installed')
    raise SystemExit(0)
if 'WIENER VPS SUPABASE ADMIN PARITY V19' not in s:
    raise SystemExit('ERROR: V19 must be installed first')

# Restore the old wiener-device admin alert call. V3 kept device enforcement but
# lost alertAdmin during migration.
needle="return res.json({ok:true,data:{...(data||{}),blocked:!!data?.blocked,device_blocked:!!data?.device_blocked,access_blocked:!!data?.access_blocked,same_device:!!data?.same_device,referral_eligible:data?.referral_eligible!==false}});"
replacement="void alertDeviceAdmin19(id,data).catch(e=>console.error('admin_device_alert_v19',String(e?.message||e)));\n    "+needle
if needle in s:
    s=s.replace(needle,replacement,1)
else:
    print('WARNING: wiener-device response insertion point not found')

# Match the old treasury behavior: when the normal Polygon scan finds nothing
# and there is no recorded Polygon deposit yet, recover the most recent Alchemy
# transfer before scanning TON and reconciling sponsored tasks.
old="async function treasuryScan19(){\n  const polygon=await treasuryScan18(),ton=await treasuryTonScan19();let reconciled=false;"
new="async function treasuryScan19(){\n  const polygon=await treasuryScan18();let recovered=null;if(!n18(polygon?.found)){try{const c=(await pool.query(`select count(*)::int c from public.wiener_treasury_transfers where direction='deposit' and asset in ('USDT','POL')`)).rows[0]?.c||0;if(!c)recovered=await treasuryRecover19()}catch(e){console.error('v19_polygon_recover',String(e?.message||e))}}const ton=await treasuryTonScan19();let reconciled=false;"
if old in s:
    s=s.replace(old,new,1)
    s=s.replace("return{found:n18(polygon?.found)+n18(ton?.found),polygon,ton,sponsored_reconciled:reconciled}}", "return{found:n18(polygon?.found)+n18(recovered?.found)+n18(ton?.found),polygon,recovered,ton,sponsored_reconciled:reconciled}}",1)
else:
    print('WARNING: treasuryScan19 replacement point not found')

marker="\napp.use((_req,res)=>\n  res.status(404).json({ok:false,error:'route_not_enabled_yet'})\n);\n"
if marker not in s:
    raise SystemExit('ERROR: fallback marker missing')
code=r'''

// === WIENER VPS SUPABASE ADMIN PARITY V19B ===
async function alertDeviceAdmin19(id,result){
  let a=null;try{a=await rpc('claim_device_alert',[id])}catch(e){console.error('claim_device_alert_v19',String(e?.message||e));return}
  if(!a?.send)return;
  const admin=(await pool.query(`select telegram_id from public.admins where enabled=true and role in ('owner','admin') order by telegram_id limit 1`)).rows[0];if(!admin?.telegram_id)return;
  const user=a.username?`@${a.username}`:'No username',ref=a.referred_by?`${a.referrer_username?'@'+a.referrer_username:'UID '+a.referred_by} · ${a.referred_by}`:'Organic / no referrer',same=!!result?.same_device,blocked=!!result?.access_blocked,match=result?.matched_uid?`${result?.matched_username?'@'+result.matched_username+' · ':''}${result.matched_uid}`:(a.matched_uid?`${a.matched_username?'@'+a.matched_username+' · ':''}${a.matched_uid}`:'None'),text=`${blocked?'🚫 New User · Multi Account Banned':same?'⚠️ Device Reused · Primary Kept':'🆕 New User'}\n\n👤 ${a.name||'Telegram User'}\n${user} · ${a.telegram_id}\n\n👥 Referral\nInvited by: ${ref}\nQualification: ${n18(a.total_ads)}/5 ads\nEligible: ${blocked||a.referral_eligible===false?'❌ No':'✅ Yes'}\n\n📱 Device\nStatus: ${blocked?'🚫 DUPLICATE BANNED':same?'⚠️ Reused · Primary account':'✅ New device'}\nAccounts detected: ${n18(result?.accounts_detected||a.accounts_detected||1)}\nMatched account: ${match}\n\n🛡 Security\nAccount access: ${blocked?'❌ BANNED':'✅ ACTIVE'}\nReferral reward: ${blocked?'❌ BLOCKED':'✅ ELIGIBLE'}\nReason: ${blocked?'Multiple accounts / same device detected':same?'Oldest account preserved':'None'}\n\n🌭 WIENER Farm`;
  await tgV10('sendMessage',{chat_id:Number(admin.telegram_id),text,reply_markup:kb18([[web18('👤 VIEW USER',`https://wiener-farm.vercel.app/?page=admin&user=${a.telegram_id}`)]]),disable_web_page_preview:true});
}
// === END WIENER VPS SUPABASE ADMIN PARITY V19B ===
'''
s=s.replace(marker,code+marker,1)
p.write_text(s)
print('V19B device admin alerts + treasury recovery installed')
