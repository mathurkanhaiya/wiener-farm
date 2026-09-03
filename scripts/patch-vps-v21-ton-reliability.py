from pathlib import Path
import re

p=Path('/opt/wiener-backend/server.mjs')
s=p.read_text()
TAG='WIENER VPS TON RELIABILITY V21'
marker="\napp.use((_req,res)=>\n  res.status(404).json({ok:false,error:'route_not_enabled_yet'})\n);\n"
if TAG in s:
    print('V21 TON reliability already installed')
    raise SystemExit(0)
if 'WIENER VPS TON TREASURY CONFIG V20' not in s:
    raise SystemExit('ERROR: V20 TON config must be installed first')
if marker not in s:
    raise SystemExit('ERROR: final fallback marker missing')

hook="    try{if(await handleTonConfigV20(up,uid,text,m,q)) return done();}catch(e){console.error('v20_ton_config',String(e?.message||e));}\n"
if hook not in s:
    raise SystemExit('ERROR: V20 webhook hook missing')
s=s.replace(hook,"    try{if(await handleTonReliabilityV21(up,uid,text,m,q)) return done();}catch(e){console.error('v21_ton_reliability',String(e?.message||e));}\n"+hook,1)

old_status="const payout=await postLocalV10B('wiener-ton-payout',{action:'status',admin_id:uid}).catch(e=>({configured:false,status_error:String(e?.message||e)}));"
if old_status not in s:
    raise SystemExit('ERROR: V20 status call not found')
s=s.replace(old_status,"const payout=await tonStatusCached21(uid).catch(e=>({configured:false,status_error:String(e?.message||e)}));",1)

health_anchor="[cb18(`⏱ ${Number(s.ton_treasury_scan_interval_minutes||2)}m SCAN`,'cfg20:interval'),cb18('🔐 SECRET STATUS','cfg20:secrets')],"
if health_anchor in s:
    s=s.replace(health_anchor,health_anchor+"\n    [cb18('🩺 SYSTEM HEALTH','cfg21:health')],",1)
else:
    print('WARNING: /config health button anchor not found; cfg21:health still works by callback')

scanner=r'''async function treasuryTonScan19(source='auto'){
  const db=await pool.connect();let locked=false,state={};
  try{
    const lock=(await db.query(`select pg_try_advisory_lock($1) ok`,[920260904])).rows[0]?.ok;
    if(!lock)return{found:0,error:'TON scan already running. Please wait a few seconds.',busy:true};
    locked=true;
    state=(await db.query(`select ton_treasury_next_scan_at,ton_treasury_scan_failures,ton_treasury_scan_cursor_lt from public.app_settings where id=true`)).rows[0]||{};
    const next=state.ton_treasury_next_scan_at?new Date(state.ton_treasury_next_scan_at).getTime():0;
    if(next>Date.now()){
      const sec=Math.max(1,Math.ceil((next-Date.now())/1000));
      return{found:0,error:`TON provider is cooling down. Retry in ${sec}s.`,retry_after_seconds:sec,backoff:true};
    }
    const mnemonic=String(process.env.WIENER_TON_PAYOUT_MNEMONIC||'').trim();
    if(mnemonic.split(/\s+/).length<12)return{found:0,error:'TON treasury signer is not configured on VPS.'};
    const [{TonClient,WalletContractV4},{mnemonicToPrivateKey}]=await Promise.all([import('@ton/ton'),import('@ton/crypto')]);
    const kp=await mnemonicToPrivateKey(mnemonic.split(/\s+/)),wc=WalletContractV4.create({workchain:0,publicKey:kp.publicKey});
    const endpoint=String(process.env.WIENER_TON_RPC_URL||'https://toncenter.com/api/v2/jsonRPC').trim(),apiKey=String(process.env.WIENER_TON_API_KEY||'').trim();
    await tonRpcGate21(!!apiKey);
    const client=new TonClient({endpoint,apiKey:apiKey||undefined}),address=wc.address.toString({bounceable:false,urlSafe:true,testOnly:false});
    const txs=await client.getTransactions(wc.address,{limit:50});
    const cursor=BigInt(String(state.ton_treasury_scan_cursor_lt||'0')||'0');let newest=cursor,found=0,newCount=0;
    for(const tx of [...txs].reverse()){
      const lt=BigInt(String(tx.lt||'0'));if(lt<=cursor)continue;if(lt>newest)newest=lt;newCount++;
      const im=tx.inMessage;if(!im||im.info?.type!=='internal')continue;const coins=BigInt(im.info.value?.coins||0);if(coins<=0n)continue;
      const hash=tx.hash().toString('hex'),exists=(await db.query(`select 1 from public.wiener_treasury_transfers where tx_hash=$1 limit 1`,[hash])).rows.length;if(exists)continue;
      const memo=tonComment19(im),from=im.info.src?im.info.src.toString({bounceable:false,urlSafe:true,testOnly:false}):'',amount=Number(coins)/1e9,utime=Number(tx.now||0),explorer=`https://tonviewer.com/transaction/${hash}`;
      await db.query(`insert into public.wiener_treasury_transfers(direction,asset,amount,network,chain_id,from_address,to_address,tx_hash,explorer_url,state,confirmations,confirmed_at,detected_at,metadata) values('deposit','TON',$1,'TON',null,$2,$3,$4,$5,'confirmed',1,now(),now(),$6::jsonb)`,[amount,from||null,address,hash,explorer,JSON.stringify({memo,lt:String(lt),utime,source:'ton_treasury_scanner_v21'})]);
      await treasuryNotify18(`✅ Treasury Deposit Received\n\nAsset: TON\nAmount: ${fmt20(amount,9)}\nNetwork: TON\nFrom: ${from||'Unknown'}\nTo: ${address}\nReference: ${memo||'—'}\nTX: ${explorer}\nConfirmations: 1\nStatus: Confirmed`);found++;
    }
    await db.query(`update public.app_settings set ton_treasury_scan_cursor_lt=$1,ton_treasury_scan_failures=0,ton_treasury_next_scan_at=now()+interval '45 seconds',ton_treasury_last_success_at=now(),ton_treasury_last_scan_error=null,ton_treasury_last_scan_count=$2 where id=true`,[String(newest),newCount]);
    return{found,scanned:txs.length,new_transactions:newCount,address,status:'ok',source};
  }catch(e){
    const raw=String(e?.message||e),limited=/429|too many requests|rate.?limit/i.test(raw),fail=Math.max(1,Number(state.ton_treasury_scan_failures||0)+1),steps=limited?[15,30,60,120,300]:[10,30,60,120,300],base=steps[Math.min(fail-1,steps.length-1)],sec=base+Math.floor(Math.random()*6),friendly=limited?`TON provider is busy. Automatic retry after ${sec}s.`:`TON scan temporarily unavailable. Automatic retry after ${sec}s.`;
    await db.query(`update public.app_settings set ton_treasury_scan_failures=$1,ton_treasury_next_scan_at=now()+($2::text||' seconds')::interval,ton_treasury_last_scan_error=$3 where id=true`,[fail,sec,friendly]).catch(()=>null);
    console.error('v21_ton_scan',{source,limited,fail,message:raw.slice(0,180)});
    return{found:0,error:friendly,retry_after_seconds:sec,rate_limited:limited};
  }finally{
    if(locked)await db.query(`select pg_advisory_unlock($1)`,[920260904]).catch(()=>null);
    db.release();
  }
}'''
pat=r"async function treasuryTonScan19\(\)\{.*?\n\}\nasync function treasuryScan19\(\)\{"
m=re.search(pat,s,re.S)
if not m:
    raise SystemExit('ERROR: V19 TON scanner body not found')
s=re.sub(pat,scanner+"\nasync function treasuryScan19(){",s,count=1,flags=re.S)

code=r'''

// === WIENER VPS TON RELIABILITY V21 ===
const sleep21=ms=>new Promise(r=>setTimeout(r,ms));
let tonRpcNext21=0,tonStatusCache21={at:0,data:null,promise:null};
async function tonRpcGate21(hasKey){const gap=hasKey?350:1200,wait=Math.max(0,tonRpcNext21-Date.now());if(wait)await sleep21(wait);tonRpcNext21=Date.now()+gap}
async function tonStatusCached21(uid,force=false){
  const now=Date.now();if(!force&&tonStatusCache21.data&&now-tonStatusCache21.at<15000)return tonStatusCache21.data;if(tonStatusCache21.promise)return tonStatusCache21.promise;
  tonStatusCache21.promise=postLocalV10B('wiener-ton-payout',{action:'status',admin_id:uid});
  try{const data=await tonStatusCache21.promise;tonStatusCache21={at:Date.now(),data,promise:null};return data}catch(e){tonStatusCache21.promise=null;if(tonStatusCache21.data)return{...tonStatusCache21.data,status_stale:true};throw e}
}
async function tonHealth21(){
  const st=(await pool.query(`select ton_treasury_scan_enabled,ton_treasury_last_scan_at,ton_treasury_last_success_at,ton_treasury_last_scan_error,ton_treasury_next_scan_at,ton_treasury_scan_failures,ton_treasury_last_scan_count,ton_treasury_autopay_enabled,payout_ton_enabled,payout_emergency_paused from public.app_settings where id=true`)).rows[0]||{};
  const next=st.ton_treasury_next_scan_at?Math.max(0,Math.ceil((new Date(st.ton_treasury_next_scan_at).getTime()-Date.now())/1000)):0,signer=String(process.env.WIENER_TON_PAYOUT_MNEMONIC||'').trim().split(/\s+/).length>=12,rpc=!!String(process.env.WIENER_TON_RPC_URL||'').trim(),key=!!String(process.env.WIENER_TON_API_KEY||'').trim();
  return{st,next,signer,rpc,key};
}
async function handleTonReliabilityV21(up,uid,text,m,q){
  if(!uid||!q)return false;const data=String(q.data||'');if(data!=='cfg20:scan'&&data!=='cfg21:health')return false;
  try{await adm18(uid,'withdrawals')}catch{await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:'Admin permission required',show_alert:true});return true}
  if(data==='cfg20:scan'){
    await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:'Checking TON deposits…'});const r=await treasuryTonScan19('manual');
    if(!r?.error)await pool.query(`update public.app_settings set ton_treasury_last_scan_at=now(),ton_treasury_last_scan_error=null where id=true`).catch(()=>null);
    await edit18(q,await tonConfigCard20(uid));
    await safeTg18('sendMessage',{chat_id:uid,text:r?.error?`⚠️ ${r.error}`:`✅ TON scan complete\nNew deposits: ${Number(r?.found||0)}\nNew transactions checked: ${Number(r?.new_transactions||0)}`});return true;
  }
  const h=await tonHealth21(),st=h.st,last=st.ton_treasury_last_success_at?when18(st.ton_treasury_last_success_at):'Never',err=st.ton_treasury_last_scan_error?String(st.ton_treasury_last_scan_error).slice(0,120):'None';
  await edit18(q,{text:`🩺 TON SYSTEM HEALTH\n\n✅ VPS API online\n✅ PostgreSQL online\n${h.signer?'✅':'❌'} TON signer configured\n${h.rpc?'✅':'❌'} TON RPC configured\n${h.key?'✅':'⚪'} TON API key ${h.key?'configured':'not configured'}\n${st.ton_treasury_scan_enabled?'✅':'⛔'} Auto deposit scan ${st.ton_treasury_scan_enabled?'enabled':'disabled'}\n\nLast successful scan: ${last}\nTransactions last scan: ${Number(st.ton_treasury_last_scan_count||0)}\nConsecutive scan failures: ${Number(st.ton_treasury_scan_failures||0)}\nProvider cooldown: ${h.next?`${h.next}s`:'ready'}\nLast scan issue: ${err}\n\nTON payout: ${st.payout_ton_enabled?'ON':'OFF'}\nTON autopay: ${st.ton_treasury_autopay_enabled?'ON':'OFF'}\nEmergency pause: ${st.payout_emergency_paused?'ACTIVE':'OFF'}\n\nWallet SDK uses deduplicated sync + recoverable disconnect handling in the Mini App.`,markup:kb18([[cb18('🔄 SCAN NOW','cfg20:scan')],[cb18('◀️ CONFIG','cfg20:home')]])});
  await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:'Health status'});return true;
}
// === END WIENER VPS TON RELIABILITY V21 ===
'''
s=s.replace(marker,'\n'+code+marker,1)
p.write_text(s)
print('V21 TON scanner lock/backoff/cursor + health controls installed')
