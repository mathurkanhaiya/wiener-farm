from pathlib import Path

p = Path('/opt/wiener-backend/server.mjs')
s = p.read_text()
marker = "\napp.use((_req,res)=>\n  res.status(404).json({ok:false,error:'route_not_enabled_yet'})\n);\n"
TAG = 'WIENER VPS SUPABASE ADMIN PARITY V19'
if TAG in s:
    print('V19 Supabase admin parity already installed')
    raise SystemExit(0)
if 'WIENER VPS FULL BOT PARITY V18' not in s:
    raise SystemExit('ERROR: full V18 bot parity must be installed first')
if 'WIENER VPS FULL BOT PARITY V18B' not in s:
    raise SystemExit('ERROR: V18B hardening must be installed first')
if marker not in s:
    raise SystemExit('ERROR: final fallback marker not found')

hook = "    try{if(await handleBotFullV18(up,uid,text,m,q)) return done();}catch(e){console.error('v18_bot_ops',String(e?.message||e));}\n"
if hook not in s:
    raise SystemExit('ERROR: full V18 webhook hook not found')
s = s.replace(hook, "    try{if(await handleAdminParityV19(up,uid,text,m,q)) return done();}catch(e){console.error('v19_admin_parity',String(e?.message||e));}\n" + hook, 1)

old_commands = "[{command:'start',description:'Open WIENER dashboard'},{command:'menu',description:'Main menu'},{command:'balance',description:'Check WIENER balance'},{command:'farm',description:'Farm status'},{command:'ads',description:'Ads status'},{command:'tasks',description:'Available tasks'},{command:'referral',description:'Referral stats'},{command:'withdraw',description:'Open wallet'},{command:'profile',description:'Account profile'},{command:'leaderboard',description:'WIENER rankings'},{command:'promo',description:'Active promos'},{command:'giveaway',description:'Active giveaway'},{command:'addtask',description:'Create sponsored task'},{command:'support',description:'Support'},{command:'help',description:'Help and commands'}]"
legacy_commands = "[{command:'start',description:'Open WIENER dashboard'},{command:'menu',description:'Main menu'},{command:'balance',description:'Check WIENER balance'},{command:'farm',description:'Farm status'},{command:'tasks',description:'Available tasks'},{command:'referral',description:'Referral stats'},{command:'withdraw',description:'Open wallet'},{command:'profile',description:'Account profile'},{command:'leaderboard',description:'WIENER rankings'},{command:'support',description:'Support'},{command:'help',description:'Help and commands'}]"
if old_commands in s:
    s = s.replace(old_commands, legacy_commands, 1)
else:
    print('WARNING: V18 sync command array not found; V19 /syncbot still restores it')

needle = "[cb18('⏳ TX / RETRY','wpay:attempts')],[cb18('Max $0.10','wpay:max:010')"
if needle in s:
    s = s.replace(needle, "[cb18('⏳ TX / RETRY','wpay:attempts')],[cb18('🔐 SECRET STATUS','wpay:secrets')],[cb18('Max $0.10','wpay:max:010')", 1)
else:
    print('WARNING: payout settings button insertion point not found')

s = s.replace("if(act==='scan_deposits')return res.json({ok:true,data:await treasuryScan18()});", "if(act==='scan_deposits')return res.json({ok:true,data:await treasuryScan19()});if(act==='recover_latest_deposit')return res.json({ok:true,data:await treasuryRecover19()});", 1)
s = s.replace("return res.json({ok:true,data:await treasuryScan18()})", "return res.json({ok:true,data:await treasuryScan19()})", 1)
s = s.replace("scan=await treasuryScan18()", "scan=await treasuryScan19()", 1)

code = r'''

// === WIENER VPS SUPABASE ADMIN PARITY V19 ===
const age19=(d)=>{if(!d)return '—';const v=new Date(d).getTime();if(!Number.isFinite(v))return '—';const z=Math.max(0,Math.floor((Date.now()-v)/1000));if(z<60)return `${z}s`;if(z<3600)return `${Math.floor(z/60)}m`;if(z<86400)return `${Math.floor(z/3600)}h`;return `${Math.floor(z/86400)}d`};

async function adminHome19(){
  const [users,active,newu,pending,watch,hold,restricted]=await Promise.all([
    pool.query(`select count(*)::int c from public.users`),
    pool.query(`select count(*)::int c from public.users where last_active>=now()-interval '24 hours'`),
    pool.query(`select count(*)::int c from public.users where created_at>=now()-interval '24 hours'`),
    pool.query(`select count(*)::int c,coalesce(sum(receive_usdt),0) v from public.withdrawals where status='pending'`),
    pool.query(`select count(*)::int c from public.user_risk_profiles where enforcement_state='watch'`),
    pool.query(`select count(*)::int c from public.user_risk_profiles where enforcement_state='reward_hold'`),
    pool.query(`select count(*)::int c from public.user_risk_profiles where enforcement_state='restricted'`)
  ]);
  const st=await st18(),a=app18(st);
  return {text:`🛡 WIENER FARM ADMIN\n\n👥 Users: ${users.rows[0]?.c||0}\n🟢 Active 24h: ${active.rows[0]?.c||0}\n🆕 New 24h: ${newu.rows[0]?.c||0}\n💸 Pending WD: ${pending.rows[0]?.c||0} · ${n18(pending.rows[0]?.v).toFixed(4)}\n👀 Watch: ${watch.rows[0]?.c||0}\n🟠 Reward hold: ${hold.rows[0]?.c||0}\n🚫 Restricted: ${restricted.rows[0]?.c||0}\n\nChoose a control center.`,markup:kb18([[cb18('👤 USERS','adm:users'),cb18('🛡 FRAUD','adm:fraud')],[cb18('💸 WITHDRAWALS','adm:wd'),cb18('👥 REFERRALS','adm:refs')],[cb18('📺 ADS','adm:ads'),cb18('✅ TASKS','adm:tasks')],[cb18('💎 TREASURY','adm:treasury'),cb18('🎁 PROMOS','adm:promos')],[cb18('🎉 GIVEAWAYS','adm:gives'),cb18('📢 BROADCAST','adm:broadcast')],[cb18('⚙️ SYSTEM','adm:system'),cb18('📜 AUDIT','adm:audit')],[cb18('👮 ADMINS','adm:admins'),web18('🖥 FULL ADMIN',`${a}?page=admin`)]])};
}

async function polygonPayCard19(id,after=null){
  let args=[],extra='';if(after){args=[after];extra=' and w.created_at>$1'}
  let rows=(await pool.query(`select w.* from public.withdrawals w where w.status='pending' and coalesce(w.method_key,'')<>'gram_ton'${extra} order by w.created_at asc limit 1`,args)).rows;
  if(!rows.length&&after)rows=(await pool.query(`select * from public.withdrawals where status='pending' and coalesce(method_key,'')<>'gram_ton' order by created_at asc limit 1`)).rows;
  const w=rows[0];if(!w)return{text:'✅ No pending Polygon/USDT withdrawals.',markup:kb18([[cb18('⚙️ SETTINGS','wpay:settings')],[cb18('🧾 HISTORY','wpay:history')]])};
  const [x,taskCount,sec,st,pre]=await Promise.all([
    risk18(Number(w.telegram_id)),
    pool.query(`select count(*)::int c from public.task_completions where telegram_id=$1`,[w.telegram_id]).then(r=>r.rows[0]?.c||0).catch(()=>0),
    pool.query(`select device_id,fingerprint_v2,ip_hash from public.user_security_events where telegram_id=$1 order by created_at desc limit 1`,[w.telegram_id]).then(r=>r.rows[0]||{}).catch(()=>({})),
    payoutStatus18(id,false).catch(()=>null),
    postLocalV10B('wiener-payout',{action:'preflight',admin_id:id,withdrawal_id:w.id}).catch(e=>({ready:false,reason:String(e?.code||e?.message||'preflight_failed')}))
  ]);
  let sharedIp=0,sharedFp=0;
  if(sec.ip_hash)sharedIp=(await pool.query(`select count(distinct telegram_id)::int c from public.user_security_events where ip_hash=$1 and telegram_id<>$2 and created_at>=now()-interval '24 hours'`,[sec.ip_hash,w.telegram_id]).catch(()=>({rows:[{c:0}]}))).rows[0]?.c||0;
  if(sec.fingerprint_v2)sharedFp=(await pool.query(`select count(distinct telegram_id)::int c from public.user_security_events where fingerprint_v2=$1 and telegram_id<>$2`,[sec.fingerprint_v2,w.telegram_id]).catch(()=>({rows:[{c:0}]}))).rows[0]?.c||0;
  const ready=!!st?.configured&&!!st?.auto_enabled&&!!st?.polygon_enabled&&!st?.emergency_paused&&pre?.ready!==false;
  return{text:`💸 PENDING WITHDRAWAL\n\n👤 ${w.username?'@'+w.username:x.u.first_name||'User'}\n🆔 ${w.telegram_id}\n⏱ Requested: ${age19(w.created_at)} ago\n\n💵 Gross: ${n18(w.gross_usdt).toFixed(4)} USDT\n💰 Pay: ${n18(w.receive_usdt).toFixed(4)} USDT\n🌐 ${w.network}\n👛 ${w.wallet_address}\n\n📺 Ads: ${n18(x.u.total_ads)} · ✅ Tasks: ${taskCount}\n🌾 Farms: ${n18(x.u.farm_sessions)}\n👥 Referrals: ${n18(x.u.active_referrals_count)}/${n18(x.u.referrals_count)}\n🔗 Shared IP 24h: ${sharedIp} · Shared fingerprint: ${sharedFp}\n🛡 Risk: ${n18(x.r.risk_score)}/100 · ${x.r.enforcement_state||'normal'}\n\n${pre?.ready?'🟢 Pre-check PASSED':`🔴 Pre-check: ${String(pre?.reason||'not ready').replace(/_/g,' ')}`}\n${ready?'🏦 Payout engine READY':st?.emergency_paused?'🔴 Payout engine PAUSED':'🔒 Payout engine NOT READY'}`,markup:kb18([[ready?cb18('💸 REVIEW & PAY',`wpay:prepay:${w.id}`):cb18('🔄 RECHECK','wpay:home')],[cb18('❌ DECLINE',`wpay:decline:${w.id}`),cb18('⏭ NEXT',`wpay:next:${new Date(w.created_at).toISOString()}`)],[cb18('⚙️ SETTINGS','wpay:settings'),cb18('🔄 REFRESH','wpay:home')]])};
}

async function polygonStats19(){
  const q=(await pool.query(`select count(*) filter(where status='paid' and processed_at>=current_date)::int paid,count(*) filter(where status='rejected' and processed_at>=current_date)::int rejected,count(*) filter(where status='pending')::int pending,coalesce(sum(receive_usdt) filter(where status='paid' and processed_at>=current_date),0) paid_v,coalesce(sum(receive_usdt) filter(where status='pending'),0) pending_v from public.withdrawals where coalesce(method_key,'')<>'gram_ton'`)).rows[0]||{};
  let attempts={failed:0,submitted:0,gas:'0'};try{attempts=(await pool.query(`select count(*) filter(where state='failed')::int failed,count(*) filter(where state in ('submitted','broadcasting'))::int submitted,coalesce(sum(gas_used::numeric) filter(where created_at>=current_date),0)::text gas from public.wiener_payout_attempts`)).rows[0]||attempts}catch{}
  const st=await st18();return{text:`📊 PAYOUT STATS — TODAY\n\n📥 Pending: ${q.pending||0} · ${n18(q.pending_v).toFixed(4)} USDT\n✅ Paid: ${q.paid||0} · ${n18(q.paid_v).toFixed(4)} USDT\n❌ Rejected: ${q.rejected||0}\n⏳ Submitted/broadcasting: ${attempts.submitted||0}\n⚠️ Failed attempts: ${attempts.failed||0}\n⛽ Recorded gas units: ${attempts.gas||'0'}\n\nDaily cap: ${n18(st.payout_daily_cap_usdt).toFixed(2)} USDT`,markup:kb18([[cb18('◀️ SETTINGS','wpay:settings')]])};
}
async function polygonSecrets19(id){
  const st=await payoutStatus18(id,false).catch(()=>null);return{text:`🔐 PAYOUT SECRET STATUS\n\n${st?.rpc_present?'✅':'❌'} Polygon RPC configured\n${st?.token_present?'✅':'❌'} USDT contract configured\n${st?.private_key_present?'✅':'❌'} Payout private key configured\n\nSecret values are never displayed in Telegram.`,markup:kb18([[cb18('◀️ SETTINGS','wpay:settings')]])};
}

async function syncOldBotCommands19(){
  const st=await st18(),sec=String(st.telegram_webhook_secret||''),url='https://api.viralaitools.xyz/functions/v1/wiener-bot-webhook',app=app18(st);if(!sec)throw new Error('telegram_webhook_secret_missing');
  await tgV10('setWebhook',{url,secret_token:sec,allowed_updates:['message','callback_query','my_chat_member'],drop_pending_updates:false});
  await tgV10('setMyCommands',{commands:[{command:'start',description:'Open WIENER dashboard'},{command:'menu',description:'Main menu'},{command:'balance',description:'Check WIENER balance'},{command:'farm',description:'Farm status'},{command:'tasks',description:'Available tasks'},{command:'referral',description:'Referral stats'},{command:'withdraw',description:'Open wallet'},{command:'profile',description:'Account profile'},{command:'leaderboard',description:'WIENER rankings'},{command:'support',description:'Support'},{command:'help',description:'Help and commands'}]});
  await tgV10('setChatMenuButton',{menu_button:{type:'web_app',text:'🌭 OPEN WIENER FARM',web_app:{url:app}}});
  return tgV10('getWebhookInfo',{});
}

async function treasuryRecover19(){
  try{
    const c=await treasuryRuntime18();if(!/alchemy\.com/i.test(c.rpc))return{found:0,reason:'alchemy_required'};
    const latest=await c.pc.getBlockNumber(),body={jsonrpc:'2.0',id:1,method:'alchemy_getAssetTransfers',params:[{fromBlock:'0x0',toBlock:'latest',toAddress:c.account.address,category:['external','erc20'],excludeZeroValue:true,withMetadata:true,maxCount:'0x64',order:'desc'}]},j=await fetch(c.rpc,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}).then(r=>r.json());
    const dec=Number(await c.pc.readContract({address:c.token,abi:erc20Abi18,functionName:'decimals'}));
    for(const x of j?.result?.transfers||[]){const tx=String(x.hash||''),cat=String(x.category||'').toLowerCase(),raw=String(x.rawContract?.address||'').toLowerCase(),block=parseInt(String(x.blockNum||'0x0'),16);let asset='',amount=0;if(cat==='external'){asset='POL';amount=Number(x.value||0)}else if(cat==='erc20'&&raw===String(c.token).toLowerCase()){asset='USDT';amount=Number(c.formatUnits(BigInt(String(x.rawContract?.value||'0x0')),dec))}if(!asset||!tx||!(amount>0))continue;const ok=await recordTreasuryDeposit18(asset,amount,String(x.from||''),c.account.address,tx,block,Math.max(1,Number(latest-BigInt(block)+1n)));if(ok)return{found:1,asset,amount,tx_hash:tx,block_number:block}}
    return{found:0};
  }catch(e){return{found:0,error:String(e?.message||e)}}
}

function tonComment19(msg){try{const sl=msg.body.beginParse();if(sl.remainingBits<32||sl.loadUint(32)!==0)return '';return sl.loadStringTail()}catch{return ''}}
async function treasuryTonScan19(){
  try{
    const mnemonic=String(process.env.WIENER_TON_PAYOUT_MNEMONIC||'').trim();if(mnemonic.split(/\s+/).length<12)return{found:0,skipped:'ton_treasury_not_configured'};
    const [{TonClient,WalletContractV4},{mnemonicToPrivateKey}]=await Promise.all([import('@ton/ton'),import('@ton/crypto')]);
    const kp=await mnemonicToPrivateKey(mnemonic.split(/\s+/)),wc=WalletContractV4.create({workchain:0,publicKey:kp.publicKey}),endpoint=String(process.env.WIENER_TON_RPC_URL||'https://toncenter.com/api/v2/jsonRPC'),apiKey=String(process.env.WIENER_TON_API_KEY||'').trim(),client=new TonClient({endpoint,apiKey:apiKey||undefined}),address=wc.address.toString({bounceable:false,urlSafe:true,testOnly:false}),txs=await client.getTransactions(wc.address,{limit:100});let found=0;
    for(const tx of [...txs].reverse()){
      const im=tx.inMessage;if(!im||im.info?.type!=='internal')continue;const coins=BigInt(im.info.value?.coins||0);if(coins<=0n)continue;const hash=tx.hash().toString('hex'),exists=(await pool.query(`select 1 from public.wiener_treasury_transfers where tx_hash=$1 limit 1`,[hash])).rows.length;if(exists)continue;const memo=tonComment19(im),from=im.info.src?im.info.src.toString({bounceable:false,urlSafe:true,testOnly:false}):'',amount=Number(coins)/1e9,lt=String(tx.lt||''),utime=Number(tx.now||0),explorer=`https://tonviewer.com/transaction/${hash}`;
      await pool.query(`insert into public.wiener_treasury_transfers(direction,asset,amount,network,chain_id,from_address,to_address,tx_hash,explorer_url,state,confirmations,confirmed_at,detected_at,metadata) values('deposit','TON',$1,'TON',null,$2,$3,$4,$5,'confirmed',1,now(),now(),$6::jsonb)`,[amount,from||null,address,hash,explorer,JSON.stringify({memo,lt,utime,source:'ton_treasury_scanner_v19'})]);
      await treasuryNotify18(`✅ Treasury Deposit Received\n\nAsset: TON\nAmount: ${amount.toFixed(9)}\nNetwork: TON\nFrom: ${from||'Unknown'}\nTo: ${address}\nReference: ${memo||'—'}\nTX: ${explorer}\nConfirmations: 1\nStatus: Confirmed`);found++;
    }
    return{found,scanned:txs.length,address};
  }catch(e){console.error('v19_ton_treasury_scan',String(e?.message||e));return{found:0,error:String(e?.message||e)}}
}
async function treasuryScan19(){
  const polygon=await treasuryScan18(),ton=await treasuryTonScan19();let reconciled=false;try{const a=(await pool.query(`select telegram_id from public.admins where enabled=true and role in ('owner','admin') order by case when role='owner' then 0 else 1 end limit 1`)).rows[0];if(a?.telegram_id){await postLocalV10B('wiener-sponsored-task',{action:'reconcile_all',telegram_id:Number(a.telegram_id)});reconciled=true}}catch(e){console.error('v19_sponsored_reconcile',String(e?.message||e))}return{found:n18(polygon?.found)+n18(ton?.found),polygon,ton,sponsored_reconciled:reconciled}}

async function handleAdminParityV19(up,uid,text,m,q){
  if(!uid)return false;
  if(m?.chat?.type==='private'&&/^\/(syncbot|botsync)(?:@\w+)?$/i.test(text)){
    try{await adm18(uid);const info=await syncOldBotCommands19();await safeTg18('sendMessage',{chat_id:uid,text:`✅ Bot synchronized\n\nWebhook: VPS\nMini App menu: Vercel\nPending updates: ${n18(info.pending_update_count)}`})}catch(e){await safeTg18('sendMessage',{chat_id:uid,text:`❌ ${String(e?.message||e)}`})}return true;
  }
  if(m?.chat?.type==='private'&&/^\/notify(?:@\w+)?(?:\s|$)/i.test(text)){
    let a;try{a=await adm18(uid)}catch{}if(!a||!['owner','admin'].includes(String(a.role))){await safeTg18('sendMessage',{chat_id:uid,text:'⛔ Admin permission required.'});return true}const msg=text.replace(/^\/notify(?:@\w+)?\s*/i,'').trim();if(!msg){await safeTg18('sendMessage',{chat_id:uid,text:'Usage: /notify <message>'});return true}await safeTg18('sendMessage',{chat_id:uid,text:'📤 Broadcast started. Duplicate webhook replays are suppressed.'});try{const r=await postLocalV10B('wiener-notify',{admin_id:uid,text:msg});await safeTg18('sendMessage',{chat_id:uid,text:r.duplicate_suppressed?'⏭ Duplicate broadcast suppressed.':`✅ Broadcast completed\n\n👤 Users: ${n18(r.users_sent)}\n💬 Groups/Channels: ${n18(r.chats_sent)}\n❌ Failed: ${n18(r.failed)}\n📨 Total: ${n18(r.total)}`})}catch(e){await safeTg18('sendMessage',{chat_id:uid,text:`⚠️ Broadcast failed: ${String(e?.message||e)}`})}return true;
  }
  if(m?.chat?.type==='private'&&/^\/admin(?:@\w+)?$/i.test(text)){
    try{await adm18(uid);const x=await adminHome19();await safeTg18('sendMessage',{chat_id:uid,text:x.text,reply_markup:x.markup,disable_web_page_preview:true})}catch{await safeTg18('sendMessage',{chat_id:uid,text:'⛔ Admin permission required.'})}return true;
  }
  if(m?.chat?.type==='private'&&/^\/pay(?:@\w+)?$/i.test(text)){
    try{await adm18(uid,'withdrawals')}catch{await safeTg18('sendMessage',{chat_id:uid,text:'⛔ Admin permission required.'});return true}const gram=(await pool.query(`select count(*)::int c from public.withdrawals where status='pending' and method_key='gram_ton'`)).rows[0]?.c||0,x=gram>0?await gramDashboard18(uid):await polygonPayCard19(uid);await safeTg18('sendMessage',{chat_id:uid,text:x.text,reply_markup:x.markup,disable_web_page_preview:true});return true;
  }
  if(q&&String(q.data||'')==='adm:home'){
    try{await adm18(uid);await edit18(q,await adminHome19());await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:'Updated'})}catch{await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:'Admin permission required',show_alert:true})}return true;
  }
  if(q&&String(q.data||'').startsWith('wpay:')){
    try{await adm18(uid,'withdrawals')}catch{await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:'Admin required',show_alert:true});return true}const p=String(q.data).split(':'),act=p[1];if(act==='home'||act==='status'){await edit18(q,await polygonPayCard19(uid));await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:'Updated'});return true}if(act==='next'){await edit18(q,await polygonPayCard19(uid,p.slice(2).join(':')));await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:'Next'});return true}if(act==='stats'){await edit18(q,await polygonStats19());await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:'Stats'});return true}if(act==='secrets'){await edit18(q,await polygonSecrets19(uid));await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:'Secret status'});return true}
  }
  return false;
}

app.get('/functions/v1/wiener-admin-action',async(req,res)=>{
  const page=(title,text,ok=true)=>res.status(ok?200:400).type('html').set('cache-control','no-store').send(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#002b18;color:white;font-family:system-ui;min-height:100vh;display:grid;place-items:center"><main style="width:min(86vw,380px);padding:34px 24px;text-align:center;border:1px solid #ffffff22;border-radius:28px;background:#ffffff10"><div style="font-size:54px">${ok?'✅':'⚠️'}</div><h2>${title}</h2><p style="opacity:.7;line-height:1.5">${text}</p><button onclick="window.close()" style="width:100%;height:52px;border:0;border-radius:16px;background:#ffe025;font-weight:900">CLOSE</button></main></body>`);
  try{const token=String(req.query?.token||'');if(!token)return page('Invalid action','This admin action link is invalid.',false);const data=await rpc('consume_admin_unban_token',[token]),x=Array.isArray(data)?data[0]:data,tid=Number(x?.telegram_id||x?.p_telegram_id||0);if(!tid)throw new Error('invalid_or_expired_token');return page('User Unbanned',`UID ${tid} can access WIENER Farm again. This device is now admin-approved.`)}catch(e){const m=String(e?.message||e);return page('Unable to unban',m.includes('expired')?'This UNBAN button has expired.':m.includes('used')?'This UNBAN action was already used.':'The action could not be completed.',false)}
});

// === END WIENER VPS SUPABASE ADMIN PARITY V19 ===
'''

s = s.replace(marker, '\n' + code + marker, 1)
p.write_text(s)
print('V19 Supabase admin parity patch installed')
