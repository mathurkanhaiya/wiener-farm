from pathlib import Path

p=Path('/opt/wiener-backend/server.mjs')
s=p.read_text()
TAG='WIENER VPS FULL BOT PARITY V18B'
if TAG in s:
    print('V18B already installed')
    raise SystemExit(0)
if 'WIENER VPS FULL BOT PARITY V18' not in s:
    raise SystemExit('ERROR: V18 must be installed first')

# Use a widely present timestamp column for risk overrides.
s=s.replace("manual_override=$2,enforcement_state=$3,state_updated_at=now()", "manual_override=$2,enforcement_state=$3,updated_at=now()")

# Pass the acting admin into the admin view so treasury status can use normal permission checks.
s=s.replace("async function adminView18(key){const s=await st18(),a=app18(s);", "async function adminView18(key,adminId=0){const s=await st18(),a=app18(s);")
s=s.replace("postLocalV10B('wiener-payout',{action:'status',admin_id:0})", "postLocalV10B('wiener-payout',{action:'status',admin_id:adminId})")
s=s.replace("x=await adminView18('system')", "x=await adminView18('system',uid)")
s=s.replace("else x=await adminView18(k);", "else x=await adminView18(k,uid);")

# Preserve the old admin /withdraw treasury behavior without breaking the normal user /withdraw wallet command.
needle="""    const map={menu:'home',balance:'balance',profile:'profile',farm:'farm',ads:'ads',tasks:'tasks',referral:'refs',invite:'refs',withdraw:'wallet',wallet:'wallet',promo:'promos',giveaway:'giveaways',help:'help',support:'help'};\n"""
insert="""    if(cmd==='withdraw'){\n      try{\n        await adm18(uid,'treasury');\n        await clearTreasury18(uid);\n        const tst=await treasuryStatus18();\n        if(!tst.withdraw_enabled){await safeTg18('sendMessage',{chat_id:uid,text:'⛔ Treasury withdrawals are currently disabled.'});return true}\n        await safeTg18('sendMessage',{chat_id:uid,text:`🏦 TREASURY WITHDRAW\\n\\nUSDT: ${n18(tst.usdt_balance).toFixed(6)}\\nPOL: ${n18(tst.pol_balance).toFixed(6)}\\n\\nMax / TX: ${n18(tst.max_usdt).toFixed(2)} USDT · ${n18(tst.max_pol).toFixed(2)} POL\\n\\nChoose asset:`,reply_markup:kb18([[cb18('💵 USDT','wtre:asset:USDT'),cb18('⛽ POL','wtre:asset:POL')],[cb18('❌ CANCEL','wtre:cancel')]])});\n        return true;\n      }catch(e){\n        if(!['admin_required','admin_forbidden'].includes(String(e?.message||e)))throw e;\n      }\n    }\n    const map={menu:'home',balance:'balance',profile:'profile',farm:'farm',ads:'ads',tasks:'tasks',referral:'refs',invite:'refs',withdraw:'wallet',wallet:'wallet',promo:'promos',giveaway:'giveaways',help:'help',support:'help'};\n"""
if needle not in s:
    raise SystemExit('ERROR: command-map insertion point not found')
s=s.replace(needle,insert,1)

# Marker only; behavior above is intentionally small and reviewable.
marker="\napp.use((_req,res)=>\n  res.status(404).json({ok:false,error:'route_not_enabled_yet'})\n);\n"
if marker not in s:
    raise SystemExit('ERROR: fallback marker missing')
s=s.replace(marker,"\n// === WIENER VPS FULL BOT PARITY V18B ===\n"+marker,1)
p.write_text(s)
print('V18B hardening installed')
