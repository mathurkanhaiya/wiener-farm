from pathlib import Path

p=Path('/opt/wiener-backend/server.mjs')
s=p.read_text()
marker="\napp.use((_req,res)=>\n  res.status(404).json({ok:false,error:'route_not_enabled_yet'})\n);\n"
TAG='WIENER VPS TON TREASURY CONFIG V20'
if TAG in s:
    print('V20 TON treasury config already installed')
    raise SystemExit(0)
if 'WIENER VPS SUPABASE ADMIN PARITY V19' not in s or 'WIENER VPS SUPABASE ADMIN PARITY V19B' not in s:
    raise SystemExit('ERROR: V19/V19B admin parity must be installed first')
if marker not in s:
    raise SystemExit('ERROR: final fallback marker not found')

# Run /config before the V19/V18 handlers.
hook="    try{if(await handleAdminParityV19(up,uid,text,m,q)) return done();}catch(e){console.error('v19_admin_parity',String(e?.message||e));}\n"
if hook not in s:
    raise SystemExit('ERROR: V19 webhook hook not found')
s=s.replace(hook,"    try{if(await handleTonConfigV20(up,uid,text,m,q)) return done();}catch(e){console.error('v20_ton_config',String(e?.message||e));}\n"+hook,1)

# Add TON CONFIG to the Telegram admin dashboard without removing old controls.
old="[cb18('⚙️ SYSTEM','adm:system'),cb18('📜 AUDIT','adm:audit')],[cb18('👮 ADMINS','adm:admins'),web18('🖥 FULL ADMIN',`${a}?page=admin`)]"
new="[cb18('⚙️ SYSTEM','adm:system'),cb18('📜 AUDIT','adm:audit')],[cb18('💎 TON CONFIG','cfg20:home')],[cb18('👮 ADMINS','adm:admins'),web18('🖥 FULL ADMIN',`${a}?page=admin`)]"
if old in s:
    s=s.replace(old,new,1)
else:
    print('WARNING: admin home TON CONFIG insertion point not found; /config still works')

# Extend the authoritative V8B cron under its existing advisory lock.
old_cron="""    const [proof,farm,amb,giveaways]=await Promise.all([
      runProofRemindersV8(),runFarmRemindersV8(),runAmbassadorV8(),runGiveawaysV8()
    ]);
    return res.json({ok:true,busy:false,proof_reminders:proof,farm_reminders:farm,ambassador:amb,giveaways});"""
new_cron="""    const [proof,farm,amb,giveaways,tonTreasury]=await Promise.all([
      runProofRemindersV8(),runFarmRemindersV8(),runAmbassadorV8(),runGiveawaysV8(),runTonTreasuryAuto20()
    ]);
    return res.json({ok:true,busy:false,proof_reminders:proof,farm_reminders:farm,ambassador:amb,giveaways,ton_treasury:tonTreasury});"""
if old_cron not in s:
    raise SystemExit('ERROR: V8B authoritative cron block not found')
s=s.replace(old_cron,new_cron,1)

# Clean unnecessary zero padding in the migrated TON treasury alert too.
s=s.replace("Amount: ${amount.toFixed(9)}\\nNetwork: TON", "Amount: ${fmt20(amount,9)}\\nNetwork: TON", 1)

code=r'''

// === WIENER VPS TON TREASURY CONFIG V20 ===
const fmt20=(v,d=9)=>{const n=Number(v||0);if(!Number.isFinite(n))return '0';return n.toLocaleString(undefined,{maximumFractionDigits:Math.max(0,d),minimumFractionDigits:0})};
const bool20=v=>v?'✅ ON':'⛔ OFF';

async function tonConfigStatus20(uid){
  const st=await st18();
  const payout=await postLocalV10B('wiener-ton-payout',{action:'status',admin_id:uid}).catch(e=>({configured:false,status_error:String(e?.message||e)}));
  const pending=(await pool.query(`select count(*)::int c,coalesce(sum(receive_usdt),0) v from public.withdrawals where status='pending' and method_key='gram_ton' and network='TON'`)).rows[0]||{};
  const last=(await pool.query(`select amount,tx_hash,detected_at from public.wiener_treasury_transfers where direction='deposit' and asset='TON' order by detected_at desc nulls last,created_at desc limit 1`).catch(()=>({rows:[]}))).rows[0]||null;
  const guards=(await pool.query(`select count(*) filter(where status='paid')::int paid,count(*) filter(where status='failed')::int failed,count(*) filter(where status='processing')::int processing from public.ton_treasury_autopay_guard where attempted_at>=date_trunc('day',now() at time zone 'utc')`).catch(()=>({rows:[{}]}))).rows[0]||{};
  return{st,payout,pending,last,guards};
}

async function tonConfigCard20(uid){
  const x=await tonConfigStatus20(uid),s=x.st,p=x.payout;
  const scan=!!s.ton_treasury_scan_enabled,auto=!!s.ton_treasury_autopay_enabled,paused=!!s.payout_emergency_paused;
  const addr=String(p.wallet_address||'Not available');
  const lastScan=s.ton_treasury_last_scan_at?when18(s.ton_treasury_last_scan_at):'Never';
  const lastAuto=s.ton_treasury_last_autopay_at?when18(s.ton_treasury_last_autopay_at):'Never';
  const lastDeposit=x.last?`${fmt20(x.last.amount,9)} TON · ${when18(x.last.detected_at)}`:'None recorded';
  const scanErr=s.ton_treasury_last_scan_error?`\n⚠️ Last scan: ${String(s.ton_treasury_last_scan_error).slice(0,90)}`:'';
  const autoErr=s.ton_treasury_last_autopay_error?`\n⚠️ Last autopay: ${String(s.ton_treasury_last_autopay_error).slice(0,90)}`:'';
  return{text:`💎 TON TREASURY CONFIG\n\n🏦 Wallet\n${addr}\nBalance: ${p.ton_balance==null?'—':fmt20(p.ton_balance,9)} TON\nSigner: ${p.configured?'✅ configured':'❌ missing'} · mnemonic hidden\nRPC: ${p.rpc_present?'✅':'❌'} · API key: ${p.api_key_present?'✅':'—'}\n\n📥 Deposits\nAuto scan: ${bool20(scan)} · every ${Number(s.ton_treasury_scan_interval_minutes||2)}m\nLast scan: ${lastScan}\nLast deposit: ${lastDeposit}${scanErr}\n\n💸 Autopay\nAutopay: ${bool20(auto)}\nTON payout engine: ${bool20(!!s.payout_ton_enabled)}\nGlobal payout engine: ${bool20(!!s.payout_auto_enabled)}\nEmergency pause: ${paused?'🔴 PAUSED':'🟢 READY'}\nMax auto payment: ${fmt20(s.ton_treasury_autopay_max_ton||0.1,9)} TON\nAuto daily cap: ${fmt20(s.ton_treasury_autopay_daily_cap_ton||1,9)} TON\nRisk ceiling: ${Math.min(20,Number(s.ton_treasury_autopay_risk_max||20))}/100\nPending GRAM/TON: ${Number(x.pending.c||0)} · ${fmt20(x.pending.v||0,9)} TON\nToday auto: ✅ ${Number(x.guards.paid||0)} · ❌ ${Number(x.guards.failed||0)} · ⏳ ${Number(x.guards.processing||0)}\nLast auto attempt: ${lastAuto}${autoErr}\n\n🔐 Secret values are never displayed or editable in Telegram.`,markup:kb18([
    [cb18('🔄 SCAN NOW','cfg20:scan'),cb18(scan?'⏸ AUTO SCAN OFF':'▶️ AUTO SCAN ON','cfg20:scan_toggle')],
    [cb18(`⏱ ${Number(s.ton_treasury_scan_interval_minutes||2)}m SCAN`,'cfg20:interval'),cb18('🔐 SECRET STATUS','cfg20:secrets')],
    [cb18(s.payout_ton_enabled?'⛔ TON PAYOUT OFF':'✅ TON PAYOUT ON','cfg20:payout_toggle')],
    [cb18(auto?'⛔ AUTOPAY OFF':'⚡ AUTOPAY ON','cfg20:autopay')],
    [cb18(`MAX ${fmt20(s.ton_treasury_autopay_max_ton||0.1,3)} TON`,'cfg20:max'),cb18(`DAY ${fmt20(s.ton_treasury_autopay_daily_cap_ton||1,3)} TON`,'cfg20:cap')],
    [cb18(paused?'🟢 RESUME PAYOUTS':'🛑 EMERGENCY PAUSE','cfg20:pause')],
    [cb18('◀️ ADMIN','adm:home')]
  ])};
}

async function runTonTreasuryAuto20(){
  const st=await st18();
  const out={scan:null,autopay:null};
  const interval=Math.max(2,Math.min(60,Number(st.ton_treasury_scan_interval_minutes||2)));
  const last=st.ton_treasury_last_scan_at?new Date(st.ton_treasury_last_scan_at).getTime():0;
  if(st.ton_treasury_scan_enabled&&(!last||Date.now()-last>=interval*60000)){
    try{
      out.scan=await treasuryTonScan19();
      const err=out.scan?.error?String(out.scan.error).slice(0,500):null;
      await pool.query(`update public.app_settings set ton_treasury_last_scan_at=now(),ton_treasury_last_scan_error=$1 where id=true`,[err]);
    }catch(e){
      const err=String(e?.message||e).slice(0,500);out.scan={found:0,error:err};
      await pool.query(`update public.app_settings set ton_treasury_last_scan_at=now(),ton_treasury_last_scan_error=$1 where id=true`,[err]).catch(()=>null);
    }
  }

  if(!st.ton_treasury_autopay_enabled){out.autopay={status:'off'};return out}
  if(st.payout_emergency_paused){out.autopay={status:'blocked',reason:'emergency_paused'};return out}
  if(!st.payout_auto_enabled||!st.payout_ton_enabled){out.autopay={status:'blocked',reason:'payout_engine_disabled'};return out}

  const owner=(await pool.query(`select telegram_id from public.admins where enabled=true and role in ('owner','admin') order by case when role='owner' then 0 else 1 end,telegram_id limit 1`)).rows[0];
  if(!owner?.telegram_id){out.autopay={status:'blocked',reason:'admin_missing'};return out}
  const admin=Number(owner.telegram_id);
  const status=await postLocalV10B('wiener-ton-payout',{action:'status',admin_id:admin}).catch(e=>({configured:false,error:String(e?.message||e)}));
  if(!status?.configured){out.autopay={status:'blocked',reason:'ton_signer_not_configured'};return out}

  // Hard safety ceilings remain enforced even if DB settings are edited directly.
  const riskMax=Math.max(0,Math.min(20,Number(st.ton_treasury_autopay_risk_max||20)));
  const maxAuto=Math.max(0.001,Math.min(0.25,Number(st.ton_treasury_autopay_max_ton||0.1),Number(st.payout_max_ton||1)));
  const dailyCap=Math.max(0.001,Math.min(2,Number(st.ton_treasury_autopay_daily_cap_ton||1),Number(st.payout_daily_cap_ton||5)));
  const used=Number((await pool.query(`select coalesce(sum(amount_usdt),0) v from public.wiener_payout_attempts where network='TON' and asset='TON' and state='confirmed' and confirmed_at>=date_trunc('day',now() at time zone 'utc')`)).rows[0]?.v||0);
  if(used>=dailyCap){out.autopay={status:'blocked',reason:'auto_daily_cap_reached',used,daily_cap:dailyCap};return out}

  const q=await pool.query(`
    select w.*
    from public.withdrawals w
    join public.users u on u.telegram_id=w.telegram_id
    left join public.user_risk_profiles r on r.telegram_id=w.telegram_id
    where w.status='pending'
      and w.method_key='gram_ton' and w.network='TON'
      and coalesce(u.is_banned,false)=false
      and coalesce(u.device_blocked,false)=false
      and coalesce(u.total_ads,0)>=5
      and u.created_at<=now()-interval '1 hour'
      and coalesce(r.risk_score,0)<=$1
      and coalesce(r.enforcement_state,'normal')='normal'
      and w.created_at<=now()-interval '2 minutes'
      and coalesce(w.receive_usdt,0)>0 and coalesce(w.receive_usdt,0)<=$2
      and not exists(select 1 from public.ton_treasury_autopay_guard g where g.withdrawal_id=w.id::text)
      and not exists(select 1 from public.wiener_payout_attempts a where a.withdrawal_id=w.id)
    order by w.created_at asc
    limit 1`,[riskMax,maxAuto]);
  const w=q.rows[0];
  if(!w){out.autopay={status:'idle',reason:'no_safe_candidate'};return out}
  const amount=Number(w.receive_usdt||0);
  if(used+amount>dailyCap){out.autopay={status:'blocked',reason:'candidate_exceeds_daily_cap'};return out}

  const claim=await pool.query(`insert into public.ton_treasury_autopay_guard(withdrawal_id,telegram_id,amount_ton,status,attempted_at) values($1,$2,$3,'processing',now()) on conflict(withdrawal_id) do nothing returning withdrawal_id`,[String(w.id),Number(w.telegram_id),amount]);
  if(!claim.rows.length){out.autopay={status:'idle',reason:'already_guarded'};return out}

  try{
    const pre=await postLocalV10B('wiener-ton-payout',{action:'preflight',admin_id:admin,withdrawal_id:w.id});
    if(!pre?.ready)throw new Error('ton_preflight_not_ready');
    const paid=await postLocalV10B('wiener-ton-payout',{action:'pay',admin_id:admin,withdrawal_id:w.id});
    await pool.query(`update public.ton_treasury_autopay_guard set status='paid',finished_at=now(),error=null where withdrawal_id=$1`,[String(w.id)]);
    await pool.query(`update public.app_settings set ton_treasury_last_autopay_at=now(),ton_treasury_last_autopay_error=null where id=true`);
    await audit18(admin,'ton_autopay_paid',Number(w.telegram_id),{withdrawal_id:String(w.id),amount_ton:amount});
    out.autopay={status:'paid',withdrawal_id:String(w.id),telegram_id:Number(w.telegram_id),amount_ton:amount,tx_hash:paid?.tx_hash||null};
  }catch(e){
    const err=String(e?.message||e).slice(0,500);
    await pool.query(`update public.ton_treasury_autopay_guard set status='failed',finished_at=now(),error=$2 where withdrawal_id=$1`,[String(w.id),err]).catch(()=>null);
    await pool.query(`update public.app_settings set ton_treasury_last_autopay_at=now(),ton_treasury_last_autopay_error=$1 where id=true`,[err]).catch(()=>null);
    await audit18(admin,'ton_autopay_failed',Number(w.telegram_id),{withdrawal_id:String(w.id),amount_ton:amount,error:err}).catch(()=>null);
    // The guard deliberately prevents automatic retry. Admin can inspect /pay and retry only after reconciliation.
    out.autopay={status:'failed',withdrawal_id:String(w.id),error:err,no_auto_retry:true};
  }
  return out;
}

async function handleTonConfigV20(up,uid,text,m,q){
  if(!uid)return false;
  if(m?.chat?.type==='private'&&/^\/config(?:@\w+)?$/i.test(text)){
    try{await adm18(uid,'withdrawals');const x=await tonConfigCard20(uid);await safeTg18('sendMessage',{chat_id:uid,text:x.text,reply_markup:x.markup,disable_web_page_preview:true})}
    catch{await safeTg18('sendMessage',{chat_id:uid,text:'⛔ Admin withdrawal permission required.'})}
    return true;
  }
  if(!q||!String(q.data||'').startsWith('cfg20:'))return false;
  try{await adm18(uid,'withdrawals')}catch{await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:'Admin permission required',show_alert:true});return true}
  const act=String(q.data).split(':')[1];
  const refresh=async(msg='Saved')=>{await edit18(q,await tonConfigCard20(uid));await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:msg})};
  if(act==='home'){await refresh('Updated');return true}
  if(act==='scan'){
    await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:'Scanning TON deposits…'});
    const r=await treasuryTonScan19();const err=r?.error?String(r.error).slice(0,500):null;
    await pool.query(`update public.app_settings set ton_treasury_last_scan_at=now(),ton_treasury_last_scan_error=$1 where id=true`,[err]);
    await edit18(q,await tonConfigCard20(uid));
    if(err)await safeTg18('sendMessage',{chat_id:uid,text:`⚠️ TON scan failed\n${err}`});
    else await safeTg18('sendMessage',{chat_id:uid,text:`✅ TON scan complete\nNew deposits: ${Number(r?.found||0)}\nScanned transactions: ${Number(r?.scanned||0)}`});
    return true;
  }
  if(act==='scan_toggle'){const st=await st18(),v=!st.ton_treasury_scan_enabled;await pool.query(`update public.app_settings set ton_treasury_scan_enabled=$1 where id=true`,[v]);await audit18(uid,v?'ton_auto_scan_enabled':'ton_auto_scan_disabled');await refresh(v?'Auto scan enabled':'Auto scan disabled');return true}
  if(act==='interval'){const st=await st18(),cur=Number(st.ton_treasury_scan_interval_minutes||2),vals=[2,5,10,15,30,60],idx=vals.indexOf(cur),v=vals[(idx<0?0:idx+1)%vals.length];await pool.query(`update public.app_settings set ton_treasury_scan_interval_minutes=$1 where id=true`,[v]);await audit18(uid,'ton_scan_interval_changed',null,{minutes:v});await refresh(`Scan every ${v}m`);return true}
  if(act==='secrets'){const p=await postLocalV10B('wiener-ton-payout',{action:'status',admin_id:uid}).catch(()=>({}));const txt=`🔐 TON TREASURY SECRET STATUS\n\n${p.configured?'✅':'❌'} Payout mnemonic configured\n${p.rpc_present?'✅':'❌'} TON RPC configured\n${p.api_key_present?'✅':'—'} TON API key configured\n\nWallet: ${p.wallet_address||'Unavailable'}\n\nSecret values are stored only in the VPS environment and are never displayed or editable here.`;await edit18(q,{text:txt,markup:kb18([[cb18('◀️ CONFIG','cfg20:home')]])});await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:'Secret status'});return true}
  if(act==='payout_toggle'){const st=await st18();if(st.payout_ton_enabled){await pool.query(`update public.app_settings set payout_ton_enabled=false,ton_treasury_autopay_enabled=false where id=true`);await audit18(uid,'ton_payout_disabled');await refresh('TON payouts + autopay disabled');return true}const p=await postLocalV10B('wiener-ton-payout',{action:'status',admin_id:uid}).catch(()=>({configured:false}));if(!p.configured){await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:'TON signer is not configured on VPS',show_alert:true});return true}await pool.query(`update public.app_settings set payout_ton_enabled=true where id=true`);await audit18(uid,'ton_payout_enabled');await refresh('TON payout engine enabled');return true}
  if(act==='autopay'){const st=await st18();if(st.ton_treasury_autopay_enabled){await pool.query(`update public.app_settings set ton_treasury_autopay_enabled=false where id=true`);await audit18(uid,'ton_autopay_disabled');await refresh('Autopay disabled');return true}const x=await tonConfigStatus20(uid),p=x.payout;if(!p.configured){await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:'TON signer is not configured',show_alert:true});return true}if(st.payout_emergency_paused){await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:'Emergency pause is active',show_alert:true});return true}await edit18(q,{text:`⚠️ ENABLE TON AUTOPAY?\n\nThis will also enable the global payout engine and TON payout engine. Polygon still keeps its own network toggle.\n\nSafety rules:\n• one withdrawal per cron run\n• account ≥1 hour old and ≥5 ads\n• no ban/device block\n• risk ≤20 and state must be normal\n• max ${fmt20(st.ton_treasury_autopay_max_ton||0.1,9)} TON per auto payment\n• daily cap ${fmt20(st.ton_treasury_autopay_daily_cap_ton||1,9)} TON\n• no automatic retry after any guarded attempt\n• emergency pause stops it immediately\n\nEnable only after checking the treasury balance and signer status.`,markup:kb18([[cb18('✅ CONFIRM AUTOPAY','cfg20:autopay_confirm')],[cb18('❌ CANCEL','cfg20:home')]])});await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:'Confirmation required'});return true}
  if(act==='autopay_confirm'){const st=await st18(),p=await postLocalV10B('wiener-ton-payout',{action:'status',admin_id:uid}).catch(()=>({configured:false}));if(!p.configured||st.payout_emergency_paused){await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:'Signer missing or emergency pause active',show_alert:true});return true}await pool.query(`update public.app_settings set payout_auto_enabled=true,payout_ton_enabled=true,ton_treasury_autopay_enabled=true,ton_treasury_last_autopay_error=null where id=true`);await audit18(uid,'ton_autopay_enabled',null,{max_ton:Number(st.ton_treasury_autopay_max_ton||0.1),daily_cap_ton:Number(st.ton_treasury_autopay_daily_cap_ton||1)});await refresh('TON autopay enabled');return true}
  if(act==='max'){const st=await st18(),cur=Number(st.ton_treasury_autopay_max_ton||0.1),vals=[0.05,0.1,0.25],idx=vals.findIndex(v=>Math.abs(v-cur)<1e-9),v=vals[(idx<0?0:idx+1)%vals.length];await pool.query(`update public.app_settings set ton_treasury_autopay_max_ton=$1 where id=true`,[v]);await audit18(uid,'ton_autopay_max_changed',null,{max_ton:v});await refresh(`Auto max ${fmt20(v,3)} TON`);return true}
  if(act==='cap'){const st=await st18(),cur=Number(st.ton_treasury_autopay_daily_cap_ton||1),vals=[0.5,1,2],idx=vals.findIndex(v=>Math.abs(v-cur)<1e-9),v=vals[(idx<0?0:idx+1)%vals.length];await pool.query(`update public.app_settings set ton_treasury_autopay_daily_cap_ton=$1 where id=true`,[v]);await audit18(uid,'ton_autopay_daily_cap_changed',null,{daily_cap_ton:v});await refresh(`Auto daily cap ${fmt20(v,3)} TON`);return true}
  if(act==='pause'){const st=await st18();if(!st.payout_emergency_paused){await pool.query(`update public.app_settings set payout_emergency_paused=true,ton_treasury_autopay_enabled=false where id=true`);await audit18(uid,'payout_emergency_pause');await refresh('Emergency pause enabled; autopay disarmed');return true}await edit18(q,{text:'⚠️ RESUME PAYOUT ENGINE?\n\nThis removes the global emergency pause. TON autopay will remain OFF and must be enabled again explicitly.',markup:kb18([[cb18('✅ RESUME','cfg20:resume_confirm')],[cb18('❌ KEEP PAUSED','cfg20:home')]])});await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:'Confirmation required'});return true}
  if(act==='resume_confirm'){await pool.query(`update public.app_settings set payout_emergency_paused=false,ton_treasury_autopay_enabled=false where id=true`);await audit18(uid,'payout_emergency_resume');await refresh('Payout engine resumed; TON autopay remains off');return true}
  await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:'Unknown config action',show_alert:true});return true;
}
// === END WIENER VPS TON TREASURY CONFIG V20 ===
'''

s=s.replace(marker,'\n'+code+marker,1)
p.write_text(s)
print('V20 TON treasury /config + safe auto scan/autopay installed')
