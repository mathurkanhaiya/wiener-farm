from pathlib import Path
import os, re

p=Path(os.environ.get('WIENER_BACKEND_FILE','/opt/wiener-backend/server.mjs'))
if not p.exists():
    alt=Path('/opt/wiener-backend/server.js')
    if alt.exists(): p=alt
s=p.read_text()
TAG='WIENER MAIN TON TREASURY V28'
if TAG in s:
    print('V28 main TON treasury already installed')
    raise SystemExit(0)
if 'WIENER VPS TON RELIABILITY V21' not in s:
    raise SystemExit('ERROR: V21 TON reliability must be installed first')

# Keep the scanner eligible before the 7-second worker tick. Provider backoff remains authoritative on failures.
old_success="ton_treasury_scan_cursor_lt=$1,ton_treasury_scan_failures=0,ton_treasury_next_scan_at=now()+interval '45 seconds',ton_treasury_last_success_at=now()"
new_success="ton_treasury_scan_cursor_lt=$1,ton_treasury_scan_failures=0,ton_treasury_last_scan_at=now(),ton_treasury_next_scan_at=now()+interval '5 seconds',ton_treasury_last_success_at=now()"
if old_success in s:
    s=s.replace(old_success,new_success,1)
elif "ton_treasury_next_scan_at=now()+interval '5 seconds'" not in s:
    raise SystemExit('ERROR: V21 TON success cooldown anchor not found')
s=s.replace("set ton_treasury_scan_failures=$1,ton_treasury_next_scan_at=now()+($2::text||' seconds')::interval", "set ton_treasury_scan_failures=$1,ton_treasury_last_scan_at=now(),ton_treasury_next_scan_at=now()+($2::text||' seconds')::interval", 1)

# Legacy combined treasury scan becomes TON-only. Historical Polygon rows remain intact for audit.
pat=r"async function treasuryScan19\(\)\{.*?\n\}\n\nasync function handleAdminParityV19"
replacement="""async function treasuryScan19(){
  const ton=await treasuryTonScan19('main_treasury');
  let reconciled=false;
  try{const r=await mainTreasuryReconcileV28();reconciled=!!r}catch(e){console.error('v28_task_reconcile',String(e?.message||e))}
  return{found:n18(ton?.found),ton,main_treasury:'TON',polygon_disabled:true,sponsored_reconciled:reconciled};
}

async function handleAdminParityV19"""
if not re.search(pat,s,re.S):
    raise SystemExit('ERROR: treasuryScan19 anchor not found')
s=re.sub(pat,replacement,s,count=1,flags=re.S)

# Make the active admin entry point Main Treasury; stale old buttons are redirected by V28 handler.
s=s.replace("cb18('💎 TREASURY','adm:treasury')","cb18('💎 MAIN TREASURY','cfg28:home')")
s=s.replace("cb18('🏦 TREASURY','adm:treasury')","cb18('💎 MAIN TREASURY','cfg28:home')")
s=s.replace("cb18('💎 TON CONFIG','cfg20:home')","cb18('💎 MAIN TREASURY','cfg28:home')")

hook="    try{if(await handleTonReliabilityV21(up,uid,text,m,q)) return done();}catch(e){console.error('v21_ton_reliability',String(e?.message||e));}\n"
if hook not in s:
    raise SystemExit('ERROR: V21 webhook hook not found')
s=s.replace(hook,"    try{if(await handleMainTreasuryV28(up,uid,text,m,q)) return done();}catch(e){console.error('v28_main_treasury',String(e?.message||e));}\n"+hook,1)

marker="\napp.use((_req,res)=>\n  res.status(404).json({ok:false,error:'route_not_enabled_yet'})\n);\n"
if marker not in s:
    raise SystemExit('ERROR: final fallback marker not found')

code=r'''
// === WIENER MAIN TON TREASURY V28 ===
const MAIN_TREASURY_SCAN_MS_V28=7000;

async function mainTreasuryReconcileV28(){
  let rows=[];
  try{rows=(await pool.query(`select * from public.exclusive_task_orders where status='awaiting_payment' and payment_network='TON' order by created_at asc limit 100`)).rows}catch{return{checked:0,activated:0}}
  let activated=0;
  for(const o of rows){try{const x=await reconcileSponsoredV10B(o);if(x?.status==='live')activated++}catch(e){console.error('v28_reconcile_order',String(o?.id||''),String(e?.message||e))}}
  return{checked:rows.length,activated};
}

async function mainTreasuryTransactionsV28(limit=180,includeLegacy=true){
  const n=Math.max(20,Math.min(250,Number(limit||180)));
  let deposits=[],payouts=[],pending=[],legacyTransfers=[],legacyPayouts=[];
  try{deposits=(await pool.query(`
    select 'treasury:'||t.id::text id,
      case when td.tx_hash is not null or coalesce(t.metadata->>'memo','') like 'WTASK-%' then 'task_deposit' else 'deposit' end type,
      'in' direction,t.amount::float8 amount,'TON' asset,'TON' network,t.state,
      t.tx_hash,t.explorer_url,t.from_address,t.to_address,
      coalesce(td.order_id::text,t.metadata->>'memo') reference,td.telegram_id,
      coalesce(t.detected_at,t.confirmed_at,t.created_at) at,false legacy,'ton_treasury' source
    from public.wiener_treasury_transfers t
    left join public.task_deposits td on td.tx_hash=t.tx_hash
    where t.network='TON' and t.asset='TON'
    order by coalesce(t.detected_at,t.confirmed_at,t.created_at) desc limit $1`,[n])).rows}catch(e){console.error('v28_tx_deposits',String(e?.message||e))}
  try{payouts=(await pool.query(`
    select 'payout:'||p.withdrawal_id::text id,'withdrawal' type,'out' direction,p.amount_usdt::float8 amount,
      'TON' asset,'TON' network,p.state,p.tx_hash,p.explorer_url,p.from_address,p.wallet_address to_address,
      p.withdrawal_id::text reference,w.telegram_id,coalesce(p.confirmed_at,p.submitted_at,p.created_at) at,false legacy,'ton_payout' source
    from public.wiener_payout_attempts p
    left join public.withdrawals w on w.id=p.withdrawal_id
    where p.network='TON' and p.asset='TON'
    order by coalesce(p.confirmed_at,p.submitted_at,p.created_at) desc limit $1`,[n])).rows}catch(e){console.error('v28_tx_payouts',String(e?.message||e))}
  try{pending=(await pool.query(`
    select 'pending:'||w.id::text id,'withdrawal' type,'out' direction,w.receive_usdt::float8 amount,
      'TON' asset,'TON' network,'pending' state,null::text tx_hash,null::text explorer_url,null::text from_address,w.wallet_address to_address,
      w.id::text reference,w.telegram_id,w.created_at at,false legacy,'withdrawal_queue' source
    from public.withdrawals w
    where w.status='pending' and w.method_key='gram_ton' and w.network='TON'
      and not exists(select 1 from public.wiener_payout_attempts p where p.withdrawal_id=w.id and p.network='TON')
    order by w.created_at desc limit $1`,[n])).rows}catch(e){console.error('v28_tx_pending',String(e?.message||e))}
  if(includeLegacy){
    try{legacyTransfers=(await pool.query(`
      select 'legacy-treasury:'||t.id::text id,'legacy_polygon' type,case when t.direction='deposit' then 'in' else 'out' end direction,
        t.amount::float8 amount,t.asset,t.network,t.state,t.tx_hash,t.explorer_url,t.from_address,t.to_address,
        null::text reference,null::bigint telegram_id,coalesce(t.detected_at,t.confirmed_at,t.created_at) at,true legacy,'legacy_polygon_treasury' source
      from public.wiener_treasury_transfers t where t.network='Polygon'
      order by coalesce(t.detected_at,t.confirmed_at,t.created_at) desc limit 60`)).rows}catch{}
    try{legacyPayouts=(await pool.query(`
      select 'legacy-payout:'||p.withdrawal_id::text id,'legacy_polygon' type,'out' direction,p.amount_usdt::float8 amount,
        'USDT' asset,'Polygon' network,p.state,p.tx_hash,p.explorer_url,p.from_address,p.wallet_address to_address,
        p.withdrawal_id::text reference,w.telegram_id,coalesce(p.confirmed_at,p.submitted_at,p.created_at) at,true legacy,'legacy_polygon_payout' source
      from public.wiener_payout_attempts p left join public.withdrawals w on w.id=p.withdrawal_id
      where p.network='Polygon' order by coalesce(p.confirmed_at,p.submitted_at,p.created_at) desc limit 60`)).rows}catch{}
  }
  return [...deposits,...payouts,...pending,...legacyTransfers,...legacyPayouts]
    .sort((a,b)=>new Date(b.at||0).getTime()-new Date(a.at||0).getTime()).slice(0,n);
}

async function mainTreasuryStatusV28(uid){
  const [st,payout,pendingW,pendingT,in24,out24]=await Promise.all([
    st18(),
    tonStatusCached21(uid).catch(e=>({configured:false,balance_error:String(e?.message||e)})),
    pool.query(`select count(*)::int c,coalesce(sum(receive_usdt),0)::float8 amount from public.withdrawals where status='pending' and method_key='gram_ton' and network='TON'`),
    pool.query(`select count(*)::int c from public.exclusive_task_orders where status='awaiting_payment' and payment_network='TON'`),
    pool.query(`select coalesce(sum(t.amount),0)::float8 total,coalesce(sum(t.amount) filter(where td.tx_hash is not null or coalesce(t.metadata->>'memo','') like 'WTASK-%'),0)::float8 task from public.wiener_treasury_transfers t left join public.task_deposits td on td.tx_hash=t.tx_hash where t.network='TON' and t.asset='TON' and coalesce(t.detected_at,t.created_at)>=now()-interval '24 hours'`),
    pool.query(`select coalesce(sum(amount_usdt),0)::float8 total from public.wiener_payout_attempts where network='TON' and asset='TON' and state='confirmed' and coalesce(confirmed_at,created_at)>=now()-interval '24 hours'`)
  ]);
  return{
    main_network:'TON',legacy_polygon_archived:true,scan_interval_seconds:7,scan_enabled:!!st.ton_treasury_scan_enabled,
    wallet_address:payout.wallet_address||null,ton_balance:payout.ton_balance==null?null:Number(payout.ton_balance),
    signer_configured:!!payout.configured,rpc_present:!!payout.rpc_present,api_key_present:!!payout.api_key_present,
    last_scan_at:st.ton_treasury_last_scan_at||null,last_success_at:st.ton_treasury_last_success_at||null,
    next_scan_at:st.ton_treasury_next_scan_at||null,last_error:st.ton_treasury_last_scan_error||null,scan_failures:Number(st.ton_treasury_scan_failures||0),
    pending_withdrawals:Number(pendingW.rows[0]?.c||0),pending_withdrawal_ton:Number(pendingW.rows[0]?.amount||0),
    pending_task_payments:Number(pendingT.rows[0]?.c||0),in_24h:Number(in24.rows[0]?.total||0),task_in_24h:Number(in24.rows[0]?.task||0),out_24h:Number(out24.rows[0]?.total||0),
    payout_enabled:!!st.payout_ton_enabled,autopay_enabled:!!st.ton_treasury_autopay_enabled,emergency_paused:!!st.payout_emergency_paused
  };
}

async function mainTreasuryCardV28(uid){
  const x=await mainTreasuryStatusV28(uid),err=x.last_error?`\n⚠️ ${String(x.last_error).slice(0,100)}`:'';
  return{text:`💎 MAIN TREASURY · TON

🏦 ${x.wallet_address||'Signer not configured'}
Balance: ${x.ton_balance==null?'—':fmt20(x.ton_balance,9)} TON

⚡ Scanner: ${x.scan_enabled?'LIVE · 7 seconds':'OFF'}
Last success: ${x.last_success_at?when18(x.last_success_at):'Never'}${err}

📥 24h in: ${fmt20(x.in_24h,9)} TON
🎯 Task deposits: ${fmt20(x.task_in_24h,9)} TON
📤 24h out: ${fmt20(x.out_24h,9)} TON
⏳ Pending withdrawals: ${x.pending_withdrawals}
⏳ Awaiting task payments: ${x.pending_task_payments}

Polygon treasury is retired. Historical Polygon transactions are kept read-only for audit.`,markup:kb18([
    [cb18('🔄 SCAN NOW','cfg28:scan'),cb18('📜 TRANSACTIONS','cfg28:tx')],
    [cb18('💸 TON PAYOUTS','wgpay:dash'),cb18('🩺 HEALTH','cfg28:health')],
    [cb18('◀️ ADMIN','adm:home')]
  ])};
}

async function handleMainTreasuryV28(up,uid,text,m,q){
  if(!uid)return false;
  const t=String(text||''),data=String(q?.data||'');
  if(m?.chat?.type==='private'&&/^\/(deposit|treasury|treasurywithdraw|pay)(?:@\w+)?$/i.test(t)){
    try{await adm18(uid,t.toLowerCase().includes('pay')?'withdrawals':'treasury')}catch{await safeTg18('sendMessage',{chat_id:uid,text:'⛔ Admin permission required.'});return true}
    if(/^\/pay/i.test(t)){const x=await gramDashboard18(uid);await safeTg18('sendMessage',{chat_id:uid,text:x.text,reply_markup:x.markup,disable_web_page_preview:true});return true}
    const x=await mainTreasuryCardV28(uid);await safeTg18('sendMessage',{chat_id:uid,text:x.text,reply_markup:x.markup,disable_web_page_preview:true});return true;
  }
  if(!q)return false;
  if(data.startsWith('wpay:')){try{await adm18(uid,'withdrawals');const x=await gramDashboard18(uid);await edit18(q,x);await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:'TON payout center'})}catch{await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:'Admin required',show_alert:true})}return true}
  if(data==='adm:treasury'||data.startsWith('wtre:')){try{await adm18(uid,'treasury');await edit18(q,await mainTreasuryCardV28(uid));await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:'Main TON Treasury'})}catch{await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:'Admin required',show_alert:true})}return true}
  if(!data.startsWith('cfg28:'))return false;
  try{await adm18(uid,'treasury')}catch{await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:'Admin required',show_alert:true});return true}
  const act=data.split(':')[1];
  if(act==='home'||act==='health'){await edit18(q,await mainTreasuryCardV28(uid));await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:act==='health'?'Health refreshed':'Updated'});return true}
  if(act==='scan'){await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:'Scanning TON…'});const scan=await treasuryTonScan19('manual_v28'),reconcile=scan?.error?null:await mainTreasuryReconcileV28();await edit18(q,await mainTreasuryCardV28(uid));if(scan?.error)await safeTg18('sendMessage',{chat_id:uid,text:`⚠️ ${String(scan.error)}`});else await safeTg18('sendMessage',{chat_id:uid,text:`✅ MAIN TREASURY SCAN\nNew payments: ${Number(scan?.found||0)}\nTask orders activated: ${Number(reconcile?.activated||0)}`});return true}
  if(act==='tx'){const r=await mainTreasuryTransactionsV28(12,true);await edit18(q,{text:`📜 MAIN TREASURY TRANSACTIONS\n\n${r.map(x=>`${x.legacy?'◫':x.direction==='in'?'⬇️':'⬆️'} ${x.type.replace(/_/g,' ').toUpperCase()} · ${fmt20(x.amount,9)} ${x.asset}\n${String(x.state||'unknown').toUpperCase()} · ${x.telegram_id?'UID '+x.telegram_id+' · ':''}${short18(x.tx_hash||x.reference||'',22)}`).join('\n\n')||'No transactions.'}`,markup:kb18([[cb18('🔄 REFRESH','cfg28:tx')],[cb18('◀️ MAIN TREASURY','cfg28:home')]])});await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:'Transactions'});return true}
  return false;
}

app.post('/functions/v1/wiener-main-treasury',async(req,res)=>{
  try{
    const b=req.body||{},u=await edgeUser(b),uid=Number(u?.id||0);await adm18(uid,'treasury');
    const action=String(b.action||'status');
    if(action==='status')return res.json({ok:true,data:await mainTreasuryStatusV28(uid)});
    if(action==='transactions')return res.json({ok:true,data:{transactions:await mainTreasuryTransactionsV28(b.limit,b.include_legacy!==false)}});
    if(action==='scan'){const scan=await treasuryTonScan19('admin_v28'),reconcile=scan?.error?null:await mainTreasuryReconcileV28();return res.json({ok:true,data:{scan,reconcile}})}
    throw new Error('unknown_action');
  }catch(e){return edgeFail(res,e)}
});

async function mainTreasuryWorkerTickV28(){
  try{const st=await st18();if(!st.ton_treasury_scan_enabled)return;const scan=await treasuryTonScan19('worker_v28');if(!scan?.error&&Number(scan?.found||0)>0)await mainTreasuryReconcileV28()}catch(e){console.error('v28_main_treasury_worker',String(e?.message||e))}
}
if(!globalThis.__wienerMainTreasuryWorkerV28){
  globalThis.__wienerMainTreasuryWorkerV28=true;
  setTimeout(()=>mainTreasuryWorkerTickV28(),2500);
  setInterval(()=>mainTreasuryWorkerTickV28(),MAIN_TREASURY_SCAN_MS_V28);
}
// === END WIENER MAIN TON TREASURY V28 ===
'''

s=s.replace(marker,"\n"+code+marker,1)
p.write_text(s)
print('V28 installed: TON is Main Treasury, Polygon active treasury retired, 7-second scanner + unified transactions enabled')
