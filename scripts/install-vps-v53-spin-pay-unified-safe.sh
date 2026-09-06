#!/usr/bin/env bash
set -euo pipefail

cd /opt/wiener-code
BACKEND=/opt/wiener-backend/server.mjs
DB=wiener_farm_final
STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP="/opt/wiener-backend/server.mjs.v53-${STAMP}.bak"

[[ -f "$BACKEND" ]] || { echo 'ERROR: backend server.mjs not found' >&2; exit 1; }

echo '=== V53 SPIN TON UNIFIED PAY - PRECHECK ==='
for x in 'WIENER SPIN EARN V48' 'WIENER VPS FULL BOT PARITY V18' 'WIENER MAIN TON TREASURY V28'; do
  grep -Fq "$x" "$BACKEND" || { echo "ERROR: required backend layer missing: $x" >&2; exit 1; }
done
node --check "$BACKEND"
cp "$BACKEND" "$BACKUP"
rollback(){
  echo 'ERROR: V53 install failed; restoring backend backup.' >&2
  cp "$BACKUP" "$BACKEND"
  node --check "$BACKEND" >/dev/null 2>&1 && pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
}
trap rollback ERR

echo '=== V53 DATABASE ==='
runuser -u postgres -- psql -d "$DB" -v ON_ERROR_STOP=1 <<'SQL'
alter table public.wiener_spin_withdrawals add column if not exists admin_id bigint;
alter table public.wiener_spin_withdrawals add column if not exists rejection_reason text;
alter table public.wiener_spin_withdrawals add column if not exists refunded_at timestamptz;
alter table public.wiener_spin_withdrawals add column if not exists explorer_url text;
alter table public.wiener_spin_withdrawals add column if not exists updated_at timestamptz not null default now();
alter table public.wiener_spin_withdrawals add column if not exists payment_state text not null default 'pending';
alter table public.wiener_spin_withdrawals add column if not exists payment_claim_token text;
alter table public.wiener_spin_withdrawals add column if not exists payment_claimed_at timestamptz;

create table if not exists public.wiener_spin_payout_attempts(
  withdrawal_id bigint primary key references public.wiener_spin_withdrawals(id) on delete cascade,
  admin_id bigint not null,
  amount_ton numeric(24,9) not null,
  wallet_address text not null,
  state text not null,
  provider text not null default 'ton_hot_wallet',
  signer_address text,
  provider_tx_id text,
  tx_hash text,
  explorer_url text,
  safe_to_retry boolean not null default false,
  error text,
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  confirmed_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists wiener_spin_payout_attempts_state_idx on public.wiener_spin_payout_attempts(state,created_at desc);
create index if not exists wiener_spin_withdrawals_status_idx on public.wiener_spin_withdrawals(status,created_at asc);

-- Repair legacy rows to explicit safe states only; never mark anything paid automatically.
update public.wiener_spin_withdrawals
set payment_state=case when status='paid' then 'confirmed' when status='rejected' then 'rejected' else 'pending' end,
    updated_at=now()
where payment_state is null or payment_state not in ('pending','processing','submitted','confirmed','rejected');
SQL

echo '=== V53 BACKEND PATCH ==='
python3 - <<'PY'
from pathlib import Path
import re
p=Path('/opt/wiener-backend/server.mjs')
s=p.read_text()
TAG='WIENER SPIN PAY UNIFIED V53'
if TAG in s:
    print('V53 already installed')
    raise SystemExit(0)
marker="\napp.use((_req,res)=>\n  res.status(404).json({ok:false,error:'route_not_enabled_yet'})\n);\n"
if marker not in s:
    raise SystemExit('ERROR: final fallback marker not found')
needle='handleMainTreasuryV28(up,uid,text,m,q)'
pos=s.find(needle)
if pos<0:
    raise SystemExit('ERROR: V28 webhook hook not found')
line_start=s.rfind('\n',0,pos)+1
indent=re.match(r'[ \t]*',s[line_start:pos]).group(0)
hook=indent+"try{if(await handleSpinPayV53(up,uid,text,m,q)) return done();}catch(e){console.error('v53_spin_pay',String(e?.message||e));}\n"
s=s[:line_start]+hook+s[line_start:]

code=r'''

// === WIENER SPIN PAY UNIFIED V53 ===
const SPIN_SIGNER_LOCK_V53=930053;
const spinFmt53=v=>Number(v||0).toFixed(6).replace(/0+$/,'').replace(/\.$/,'');

async function spinPayStats53(){
  const [s,n]=await Promise.all([
    pool.query(`select count(*) filter(where status='pending')::int pending,coalesce(sum(amount_ton) filter(where status='pending'),0)::float8 pending_ton,count(*) filter(where status='paid' and processed_at>=current_date)::int paid_today,coalesce(sum(amount_ton) filter(where status='paid' and processed_at>=current_date),0)::float8 paid_ton from public.wiener_spin_withdrawals`),
    pool.query(`select count(*)::int c from public.withdrawals where status='pending' and method_key='gram_ton' and network='TON'`)
  ]);
  return{...(s.rows[0]||{}),normal_pending:Number(n.rows[0]?.c||0)};
}
async function spinPayHome53(){const x=await spinPayStats53();return{text:`💸 WIENER PAY CENTER\n\n💎 Normal TON pending: ${x.normal_pending}\n🎡 Spin TON pending: ${Number(x.pending||0)}\n🎡 Spin pending value: ${spinFmt53(x.pending_ton)} TON\n✅ Spin paid today: ${Number(x.paid_today||0)} · ${spinFmt53(x.paid_ton)} TON\n\nSpin accounting stays separate; this screen only unifies admin payment operations.`,markup:kb18([[cb18('💎 NORMAL TON','wgpay:dash'),cb18('🎡 SPIN TON','spay:list')],[cb18('🔄 REFRESH','spay:home')],[cb18('◀️ ADMIN','adm:home')]])}}
async function spinPayCard53(offset=0){
  const o=Math.max(0,Number(offset||0));
  const w=(await pool.query(`select w.*,u.username,u.first_name,coalesce(r.risk_score,0) risk_score,coalesce(r.enforcement_state,'normal') enforcement_state,u.is_banned,u.device_blocked,u.total_ads,u.created_at user_created_at from public.wiener_spin_withdrawals w join public.users u on u.telegram_id=w.telegram_id left join public.user_risk_profiles r on r.telegram_id=w.telegram_id where w.status='pending' order by w.created_at asc offset $1 limit 1`,[o])).rows[0];
  if(!w)return{text:'✅ No pending Spin TON withdrawals.',markup:kb18([[cb18('🔄 REFRESH','spay:list')],[cb18('◀️ PAY CENTER','spay:home')]])};
  const state=String(w.payment_state||'pending');
  const blocked=!!w.is_banned||!!w.device_blocked||['reward_hold','restricted'].includes(String(w.enforcement_state));
  const actions=[];
  if(state==='pending')actions.push([cb18('✅ REVIEW & PAY',`spay:prepay:${w.id}`),cb18('❌ REJECT',`spay:reject:${w.id}`)]);
  else if(state==='submitted')actions.push([cb18('⚠️ SUBMITTED - VIEW','spay:submitted:'+w.id)]);
  actions.push([cb18('👤 USER','spay:user:'+w.id),cb18('🔄 REFRESH','spay:list')],[cb18('◀️ PAY CENTER','spay:home')]);
  return{text:`🎡 SPIN TON · ${state.toUpperCase()}\n\n👤 ${w.username?'@'+w.username:(w.first_name||'User')}\n🆔 ${w.telegram_id}\n💎 Amount: ${spinFmt53(w.amount_ton)} TON\n👛 ${w.wallet_address}\n🕒 ${when18(w.created_at)}\n\n📺 Ads: ${Number(w.total_ads||0)}\n🛡 Risk: ${Number(w.risk_score||0)}/100 · ${w.enforcement_state||'normal'}${blocked?'\n⛔ SECURITY HOLD - do not pay until reviewed':''}\n\nSource: 🎡 Spin & Earn`,markup:kb18(actions)};
}
async function spinReject53(admin,wid,reason){
  const c=await pool.connect();
  try{await c.query('begin');const w=(await c.query(`select * from public.wiener_spin_withdrawals where id=$1 for update`,[wid])).rows[0];if(!w)throw new Error('spin_withdrawal_not_found');if(w.status==='rejected'){await c.query('commit');return{already_rejected:true,w}}if(w.status!=='pending')throw new Error('spin_withdrawal_not_pending');if(['processing','submitted'].includes(String(w.payment_state)))throw new Error('payout_in_progress_or_submitted');await c.query(`update public.wiener_spin_state set spin_ton_balance=spin_ton_balance+$2,total_ton_withdrawn=greatest(0,total_ton_withdrawn-$2),updated_at=now() where telegram_id=$1`,[w.telegram_id,w.amount_ton]);const q=await c.query(`update public.wiener_spin_withdrawals set status='rejected',payment_state='rejected',rejection_reason=$2,admin_id=$3,refunded_at=now(),processed_at=now(),updated_at=now() where id=$1 returning *`,[wid,reason,admin]);await c.query('commit');return{w:q.rows[0]}}catch(e){await c.query('rollback');throw e}finally{c.release()}
}
async function spinPayout53(admin,wid){
  let db=null,locked=false,submitted=false,attempt=null;
  try{
    await adm18(admin,'withdrawals');
    const cfg=(await pool.query(`select payout_auto_enabled,payout_ton_enabled,payout_emergency_paused,payout_max_ton,payout_daily_cap_ton,payout_channel from public.app_settings where id=true`)).rows[0]||{};
    if(cfg.payout_emergency_paused)throw new Error('payout_emergency_paused');if(!cfg.payout_auto_enabled||!cfg.payout_ton_enabled)throw new Error('ton_payout_disabled');
    const mn=String(process.env.WIENER_TON_PAYOUT_MNEMONIC||'').trim(),endpoint=String(process.env.WIENER_TON_RPC_URL||'https://toncenter.com/api/v2/jsonRPC').trim(),apiKey=String(process.env.WIENER_TON_API_KEY||'').trim();if(mn.split(/\s+/).length<12)throw new Error('ton_payout_not_configured');
    const existing=(await pool.query(`select * from public.wiener_spin_withdrawals where id=$1`,[wid])).rows[0];if(!existing)throw new Error('spin_withdrawal_not_found');if(existing.status==='paid')return{already_paid:true,withdrawal:existing,tx_hash:existing.tx_hash,explorer_url:existing.explorer_url};if(existing.status!=='pending')throw new Error('spin_withdrawal_not_pending');if(existing.payment_state==='submitted')throw new Error('spin_payout_submitted_do_not_retry');
    const u=(await pool.query(`select u.is_banned,u.device_blocked,coalesce(r.risk_score,0) risk_score,coalesce(r.enforcement_state,'normal') enforcement_state from public.users u left join public.user_risk_profiles r on r.telegram_id=u.telegram_id where u.telegram_id=$1`,[existing.telegram_id])).rows[0]||{};if(u.is_banned||u.device_blocked||['reward_hold','restricted'].includes(String(u.enforcement_state)))throw new Error('spin_withdrawal_security_hold');
    const amount=Number(existing.amount_ton||0),max=Number(cfg.payout_max_ton||1),cap=Number(cfg.payout_daily_cap_ton||5);if(!(amount>0)||amount>max)throw new Error('amount_exceeds_ton_payout_limit');
    const dailyNormal=Number((await pool.query(`select coalesce(sum(amount_usdt),0)::float8 v from public.wiener_payout_attempts where network='TON' and asset='TON' and state='confirmed' and confirmed_at>=date_trunc('day',now() at time zone 'utc')`)).rows[0]?.v||0),dailySpin=Number((await pool.query(`select coalesce(sum(amount_ton),0)::float8 v from public.wiener_spin_payout_attempts where state='confirmed' and confirmed_at>=date_trunc('day',now() at time zone 'utc')`)).rows[0]?.v||0);if(dailyNormal+dailySpin+amount>cap)throw new Error('daily_ton_payout_cap_exceeded');
    const normalBusy=(await pool.query(`select 1 from public.wiener_payout_attempts where network='TON' and asset='TON' and state in ('broadcasting','submitted') and coalesce(submitted_at,created_at)>=now()-interval '3 minutes' limit 1`)).rows.length;if(normalBusy)throw new Error('ton_signer_busy_normal_payout');
    const claim=crypto.randomBytes(18).toString('hex');const claimed=await pool.query(`update public.wiener_spin_withdrawals set payment_state='processing',payment_claim_token=$2,payment_claimed_at=now(),admin_id=$3,updated_at=now() where id=$1 and status='pending' and (payment_state='pending' or (payment_state='processing' and payment_claimed_at<now()-interval '10 minutes')) returning *`,[wid,claim,admin]);if(!claimed.rows.length)throw new Error('spin_payout_already_processing');
    db=await pool.connect();locked=!!(await db.query(`select pg_try_advisory_lock($1) ok`,[SPIN_SIGNER_LOCK_V53])).rows[0]?.ok;if(!locked)throw new Error('ton_signer_busy');
    const [{TonClient,WalletContractV4},{mnemonicToPrivateKey},{Address,internal,SendMode,toNano}]=await Promise.all([import('@ton/ton'),import('@ton/crypto'),import('@ton/core')]);const kp=await mnemonicToPrivateKey(mn.split(/\s+/)),wc=WalletContractV4.create({workchain:0,publicKey:kp.publicKey}),client=new TonClient({endpoint,apiKey:apiKey||undefined}),contract=client.open(wc),from=wc.address.toString({bounceable:false,urlSafe:true,testOnly:false}),to=Address.parse(String(existing.wallet_address)),value=toNano(amount.toFixed(9)),balance=await contract.getBalance();if(balance<=value+toNano('0.02'))throw new Error('payout_wallet_insufficient_ton');const seqno=await contract.getSeqno();
    attempt=(await pool.query(`insert into public.wiener_spin_payout_attempts(withdrawal_id,admin_id,amount_ton,wallet_address,state,signer_address,provider_tx_id,safe_to_retry) values($1,$2,$3,$4,'broadcasting',$5,$6,false) on conflict(withdrawal_id) do update set admin_id=excluded.admin_id,state='broadcasting',signer_address=excluded.signer_address,provider_tx_id=excluded.provider_tx_id,error=null,safe_to_retry=false,updated_at=now() returning *`,[wid,admin,amount,String(existing.wallet_address),from,`seqno:${seqno}`])).rows[0];
    const before=Date.now();await contract.sendTransfer({seqno,secretKey:kp.secretKey,sendMode:SendMode.PAY_GAS_SEPARATELY,messages:[internal({to,value,bounce:false,body:'WIENER Farm Spin withdrawal'})]});submitted=true;await Promise.all([pool.query(`update public.wiener_spin_payout_attempts set state='submitted',submitted_at=now(),safe_to_retry=false,updated_at=now() where withdrawal_id=$1`,[wid]),pool.query(`update public.wiener_spin_withdrawals set payment_state='submitted',updated_at=now() where id=$1`,[wid])]);
    let advanced=false;for(let i=0;i<10;i++){await sleepV10(1500);if(await contract.getSeqno()>seqno){advanced=true;break}}if(!advanced)throw new Error('ton_transaction_submitted_reconcile_required');const txs=await client.getTransactions(wc.address,{limit:6}),tx=txs.find(t=>Number(t.now)*1000>=before-5000)||txs[0];if(!tx)throw new Error('ton_transaction_hash_unavailable_reconcile_required');const hash=tx.hash().toString('hex'),explorer=`https://tonviewer.com/transaction/${hash}`;
    const paid=(await pool.query(`update public.wiener_spin_withdrawals set status='paid',payment_state='confirmed',tx_hash=$2,explorer_url=$3,processed_at=now(),updated_at=now(),admin_id=$4 where id=$1 and status='pending' returning *`,[wid,hash,explorer,admin])).rows[0];if(!paid)throw new Error('spin_withdrawal_finalize_failed');await pool.query(`update public.wiener_spin_payout_attempts set state='confirmed',tx_hash=$2,explorer_url=$3,confirmed_at=now(),safe_to_retry=false,updated_at=now() where withdrawal_id=$1`,[wid,hash,explorer]);
    const app=String((await pool.query(`select app_url from public.app_settings where id=true`)).rows[0]?.app_url||'https://wiener-farm.vercel.app');await Promise.allSettled([safeTg18('sendMessage',{chat_id:paid.telegram_id,text:`✅ Spin TON Withdrawal Paid\n\n🎡 Source: Spin & Earn\n💎 Amount: ${spinFmt53(paid.amount_ton)} TON\n🔗 ${explorer}`,disable_web_page_preview:true,reply_markup:kb18([[url18('🔗 VIEW TRANSACTION',explorer)],[web18('🌭 OPEN WIENER FARM',app)]])}),cfg.payout_channel?safeTg18('sendMessage',{chat_id:cfg.payout_channel,text:`✅ Spin TON Withdrawal Paid\n\n🎡 SPIN TON\n💎 ${spinFmt53(paid.amount_ton)} TON\n👤 ${paid.telegram_id}\n🔗 ${explorer}`,disable_web_page_preview:true}):Promise.resolve()]);return{withdrawal:paid,tx_hash:hash,explorer_url:explorer};
  }catch(e){const msg=String(e?.message||e);if(attempt||submitted){await pool.query(`update public.wiener_spin_payout_attempts set state=$2,error=$3,safe_to_retry=$4,updated_at=now() where withdrawal_id=$1`,[wid,submitted?'submitted':'failed',msg,!submitted]).catch(()=>null)}await pool.query(`update public.wiener_spin_withdrawals set payment_state=$2,updated_at=now() where id=$1 and status='pending'`,[wid,submitted?'submitted':'pending']).catch(()=>null);throw e
  }finally{if(db){if(locked)await db.query(`select pg_advisory_unlock($1)`,[SPIN_SIGNER_LOCK_V53]).catch(()=>null);db.release()}}
}
async function handleSpinPayV53(up,uid,text,m,q){
  uid=Number(q?.from?.id||m?.from?.id||uid||0);const t=String(m?.text||text||'').trim(),data=String(q?.data||'');if(!uid)return false;
  if(m?.chat?.type==='private'&&/^\/pay(?:@\w+)?$/i.test(t)){try{await adm18(uid,'withdrawals')}catch{await safeTg18('sendMessage',{chat_id:uid,text:'⛔ Admin permission required.'});return true}const x=await spinPayHome53();await safeTg18('sendMessage',{chat_id:uid,text:x.text,reply_markup:x.markup,disable_web_page_preview:true});return true}
  if(!q||!data.startsWith('spay:'))return false;try{await adm18(uid,'withdrawals')}catch{await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:'Admin required',show_alert:true});return true}
  const p=data.split(':'),act=p[1],wid=p[2];
  if(act==='home'){await edit18(q,await spinPayHome53());await safeTg18('answerCallbackQuery',{callback_query_id:q.id});return true}
  if(act==='list'){await edit18(q,await spinPayCard53(0));await safeTg18('answerCallbackQuery',{callback_query_id:q.id});return true}
  if(act==='user'){const w=(await pool.query(`select * from public.wiener_spin_withdrawals where id=$1`,[wid])).rows[0];if(w){const x=await risk18(Number(w.telegram_id));await edit18(q,{text:`👤 SPIN PAYOUT PROFILE\n\n${x.u.username?'@'+x.u.username:x.u.first_name||'User'}\n🆔 ${w.telegram_id}\n🎡 Spin TON request: ${spinFmt53(w.amount_ton)} TON\n💰 WIENER: ${fmt18(x.u.balance)}\n📺 Ads: ${n18(x.u.total_ads)}\n🛡 Risk: ${n18(x.r.risk_score)}/100 · ${x.r.enforcement_state||'normal'}`,markup:kb18([[cb18('◀️ BACK','spay:list')]])})}await safeTg18('answerCallbackQuery',{callback_query_id:q.id});return true}
  if(act==='reject'){await edit18(q,{text:'❌ REJECT SPIN TON WITHDRAWAL\n\nThe reserved Spin TON will be returned exactly once.',markup:kb18([[cb18('🛡 Security verification failed',`spay:r1:${wid}`)],[cb18('⚠️ Abnormal earning activity',`spay:r2:${wid}`)],[cb18('👛 Invalid / unsupported wallet',`spay:r3:${wid}`)],[cb18('◀️ CANCEL','spay:list')]])});await safeTg18('answerCallbackQuery',{callback_query_id:q.id});return true}
  if(/^r[1-3]$/.test(act)){const reasons={r1:'Spin TON withdrawal rejected because the account did not pass security verification.',r2:'Spin TON withdrawal rejected due to abnormal earning activity detected during review.',r3:'Spin TON withdrawal rejected because the wallet could not be safely processed.'};const r=await spinReject53(uid,wid,reasons[act]);if(r.w)await safeTg18('sendMessage',{chat_id:r.w.telegram_id,text:`❌ Spin TON Withdrawal Rejected\n\n💎 ${spinFmt53(r.w.amount_ton)} TON\nReason: ${reasons[act]}\n\nThe reserved amount was returned to your Spin TON balance.`}).catch(()=>null);await edit18(q,await spinPayCard53(0));await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:'Rejected and refunded'});return true}
  if(act==='prepay'){const w=(await pool.query(`select * from public.wiener_spin_withdrawals where id=$1 and status='pending'`,[wid])).rows[0];if(!w){await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:'No longer pending',show_alert:true});return true}if(w.payment_state==='submitted'){await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:'Already submitted - do not retry',show_alert:true});return true}await edit18(q,{text:`⚠️ SPIN TON PAYOUT CONFIRMATION\n\n🎡 Source: Spin & Earn\n🆔 ${w.telegram_id}\n💎 Send: ${spinFmt53(w.amount_ton)} TON\n👛 ${w.wallet_address}\n\nThe server will lock this request before signing. Never confirm twice.`,markup:kb18([[cb18('✅ CONFIRM & PAY',`spay:confirm:${wid}`)],[cb18('❌ CANCEL','spay:list')]])});await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:'Confirmation required'});return true}
  if(act==='confirm'){await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:'Processing Spin TON payout…'}).catch(()=>null);try{const r=await spinPayout53(uid,wid);await safeTg18('sendMessage',{chat_id:uid,text:r.already_paid?`ℹ️ Already paid.\n${r.explorer_url||''}`:`✅ SPIN TON PAID\n\n💎 ${spinFmt53(r.withdrawal?.amount_ton)} TON\n🔗 ${r.explorer_url||''}`,disable_web_page_preview:true})}catch(e){await safeTg18('sendMessage',{chat_id:uid,text:`⚠️ SPIN PAYOUT NOT COMPLETED\n\n${String(e?.message||e).replace(/_/g,' ')}\n\nIf the transaction was submitted, the request is locked from retry to prevent a double payment.`})}await edit18(q,await spinPayCard53(0));return true}
  if(act==='submitted'){const a=(await pool.query(`select * from public.wiener_spin_payout_attempts where withdrawal_id=$1`,[wid])).rows[0];await edit18(q,{text:`⚠️ SPIN TON SUBMITTED\n\nWithdrawal: ${wid}\nState: ${a?.state||'submitted'}\nProvider ref: ${a?.provider_tx_id||'—'}\nTX: ${a?.explorer_url||'Not resolved yet'}\n\nAutomatic retry is blocked. Resolve/reconcile before any new send.`,markup:kb18([[cb18('◀️ BACK','spay:list')]])});await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:'Retry blocked for safety'});return true}
  return false;
}
// === END WIENER SPIN PAY UNIFIED V53 ===
'''
s=s.replace(marker,'\n'+code+marker,1)
p.write_text(s)
print('V53 unified Spin TON payout backend installed')
PY

echo '=== V53 STATIC SAFETY CHECK ==='
node --check "$BACKEND"
for x in 'WIENER SPIN PAY UNIFIED V53' 'handleSpinPayV53' 'SPIN_SIGNER_LOCK_V53' 'spinPayout53' 'spinReject53' 'spay:confirm' 'submitted_do_not_retry'; do
  grep -Fq "$x" "$BACKEND" || { echo "ERROR: V53 marker missing: $x" >&2; exit 1; }
done
cols=$(runuser -u postgres -- psql -d "$DB" -Atqc "select count(*) from information_schema.columns where table_schema='public' and table_name='wiener_spin_withdrawals' and column_name in ('admin_id','rejection_reason','refunded_at','explorer_url','updated_at','payment_state','payment_claim_token','payment_claimed_at')")
[[ "$cols" == "8" ]] || { echo "ERROR: spin withdrawal columns incomplete: $cols/8" >&2; exit 1; }
tbl=$(runuser -u postgres -- psql -d "$DB" -Atqc "select to_regclass('public.wiener_spin_payout_attempts') is not null")
[[ "$tbl" == "t" ]] || { echo 'ERROR: spin payout attempts table missing' >&2; exit 1; }

echo '=== V53 RESTART ==='
pm2 restart wiener-api --update-env
sleep 3
curl -fsS http://127.0.0.1:3000/health >/tmp/v53-health.json
cat /tmp/v53-health.json; echo
code=$(curl -sS -o /tmp/v53-webhook.out -w '%{http_code}' -X POST -H 'content-type: application/json' --data '{}' http://127.0.0.1:3000/functions/v1/wiener-bot-webhook || true)
echo "bot webhook protected smoke -> HTTP $code"
[[ "$code" != "000" && "$code" != "404" && "$code" != "502" ]] || { cat /tmp/v53-webhook.out 2>/dev/null || true; exit 1; }
pm2 save

trap - ERR
echo '=== V53 READY ==='
echo '/pay now opens one admin payout center with Normal TON and clearly labeled Spin TON queues.'
echo 'Spin rejection refunds reserved Spin TON exactly once.'
echo 'Spin pay uses explicit admin confirmation, row claim, risk/ban checks, shared daily TON cap accounting, signer advisory lock, in-flight normal TON guard, persistent attempt state, and no unsafe retry after broadcast.'
echo 'No payout was executed by this installer.'
