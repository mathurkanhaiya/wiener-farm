#!/usr/bin/env bash
set -euo pipefail
cd /opt/wiener-code
BACKEND=/opt/wiener-backend/server.mjs
STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP="$BACKEND.v112-bulk-gram-$STAMP.bak"
[[ -f "$BACKEND" ]] || { echo "ERROR: backend missing"; exit 1; }
grep -Fq "async function gramDashboard18" "$BACKEND" || { echo "ERROR: GRAM dashboard missing"; exit 1; }
grep -Fq "handleMainTreasuryV28" "$BACKEND" || { echo "ERROR: V28 missing"; exit 1; }
node --check "$BACKEND"
cp "$BACKEND" "$BACKUP"
rollback(){ cp "$BACKUP" "$BACKEND"; pm2 restart wiener-api --update-env >/dev/null 2>&1 || true; }
trap rollback ERR

python3 - <<'PY'
from pathlib import Path
p=Path('/opt/wiener-backend/server.mjs')
s=p.read_text()
TAG='WIENER GRAM BULK PAY V112'
if TAG in s:
    print('V112 already installed')
    raise SystemExit(0)

old="async function gramDashboard18(id){const [pending,st]=await Promise.all([pool.query(`select count(*)::int c,coalesce(sum(receive_usdt),0) v from public.withdrawals where status='pending' and method_key='gram_ton'`),payoutStatus18(id,true).catch(()=>null)]);const p=pending.rows[0]||{},ready=!!st?.configured&&!!st?.auto_enabled&&!!st?.ton_enabled&&!st?.emergency_paused;return{text:`💎 GRAM PAY CENTER\\n\\n📥 Pending: ${p.c||0} · ${n18(p.v).toFixed(6)} GRAM\\n🏦 Treasury: ${short18(st?.wallet_address||'Not available')}\\n💎 Balance: ${st?.ton_balance==null?'—':n18(st.ton_balance).toFixed(6)+' GRAM'}\\n⚙️ Engine: ${ready?'🟢 READY':st?.emergency_paused?'🔴 PAUSED':'🟡 NOT READY'}`,markup:kb18([[cb18(`📥 PENDING (${p.c||0})`,'wgpay:list')],[cb18('📊 STATS','wgpay:stats'),cb18('🏦 TREASURY','wgpay:settings')],[cb18('🔄 REFRESH','wgpay:dash')]])}}"
new="async function gramDashboard18(id){const [pending,st]=await Promise.all([pool.query(`select count(*)::int c,coalesce(sum(receive_usdt),0) v from public.withdrawals where status='pending' and method_key='gram_ton'`),payoutStatus18(id,true).catch(()=>null)]);const p=pending.rows[0]||{},ready=!!st?.configured&&!!st?.auto_enabled&&!!st?.ton_enabled&&!st?.emergency_paused;return{text:`💎 GRAM PAY CENTER\\n\\n📥 Pending: ${p.c||0} · ${n18(p.v).toFixed(6)} GRAM\\n🏦 Treasury: ${short18(st?.wallet_address||'Not available')}\\n💎 Balance: ${st?.ton_balance==null?'—':n18(st.ton_balance).toFixed(6)+' GRAM'}\\n⚙️ Engine: ${ready?'🟢 READY':st?.emergency_paused?'🔴 PAUSED':'🟡 NOT READY'}`,markup:kb18([[cb18(`📥 PENDING (${p.c||0})`,'wgpay:list')],[cb18('⚡ BULK PAY · 10 LOWEST','gbulk112:review')],[cb18('📊 STATS','wgpay:stats'),cb18('🏦 TREASURY','wgpay:settings')],[cb18('🔄 REFRESH','wgpay:dash')]])}}"
if old not in s: raise SystemExit('ERROR: exact gramDashboard18 anchor changed; no patch applied')
s=s.replace(old,new,1)

marker="\nasync function handleMainTreasuryV28(up,uid,text,m,q){"
if marker not in s: raise SystemExit('ERROR: V28 handler anchor missing')
code=r'''
// === WIENER GRAM BULK PAY V112 ===
let gramBulkRunningV112=false;
async function gramBulkRowsV112(){
  return (await pool.query(`select * from public.withdrawals where status='pending' and method_key='gram_ton' order by receive_usdt asc,created_at asc limit 10`)).rows;
}
async function gramBulkReviewV112(){
  const rows=await gramBulkRowsV112(),total=rows.reduce((a,w)=>a+n18(w.receive_usdt),0);
  if(!rows.length)return{text:'✅ No pending GRAM withdrawals.',markup:kb18([[cb18('◀️ GRAM PAY CENTER','wgpay:dash')]])};
  return{text:`⚡ BULK GRAM PAY\\n\\n💎 Lowest pending withdrawals: ${rows.length}/10\\n💰 Total: ${total.toFixed(6)} GRAM\\n\\n${rows.map((w,i)=>`${i+1}. ${n18(w.receive_usdt).toFixed(6)} GRAM · ${w.username?'@'+w.username:'UID '+w.telegram_id}`).join('\\n')}\\n\\nEach withdrawal is sent independently through the existing GRAM payout engine and keeps its own transaction record. The list is re-checked when you confirm.`,markup:kb18([[cb18(`✅ CONFIRM ${rows.length} PAYMENTS`,'gbulk112:confirm')],[cb18('❌ CANCEL','wgpay:dash')]])};
}
async function gramBulkRunV112(admin){
  if(gramBulkRunningV112)throw new Error('bulk_gram_payment_already_running');
  gramBulkRunningV112=true;
  try{
    const rows=await gramBulkRowsV112();let paid=0,failed=0,sent=0;const failures=[];
    for(const selected of rows){
      const cur=(await pool.query(`select * from public.withdrawals where id=$1 and status='pending' and method_key='gram_ton' limit 1`,[selected.id])).rows[0];
      if(!cur){failed++;failures.push(`${short18(selected.id,10)} · no longer pending`);continue}
      try{
        const pre=await postLocalV10B('wiener-ton-payout',{action:'preflight',admin_id:admin,withdrawal_id:cur.id});
        if(!pre?.ready)throw new Error(pre?.reason||'preflight_not_ready');
        const r=await postLocalV10B('wiener-ton-payout',{action:'pay',admin_id:admin,withdrawal_id:cur.id,confirm_high_value:true,confirm_risk:true});
        if(r?.already_paid){failed++;failures.push(`${short18(cur.id,10)} · already paid before this batch`);continue}
        const amount=n18(r?.withdrawal?.receive_usdt||cur.receive_usdt);paid++;sent+=amount;
        // The existing payout endpoint remains responsible for the per-user and payout-channel TX log.
        await safeTg18('sendMessage',{chat_id:admin,text:`✅ GRAM BULK ITEM PAID\\n\\n🆔 ${cur.id}\\n👤 ${cur.username?'@'+cur.username:'UID '+cur.telegram_id}\\n💎 ${amount.toFixed(6)} GRAM\\n🔗 ${r?.explorer_url||'TX recorded by payout engine'}`,disable_web_page_preview:true}).catch(()=>null);
      }catch(e){
        failed++;const msg=String(e?.message||e).replace(/_/g,' ');failures.push(`${short18(cur.id,10)} · ${msg.slice(0,80)}`);
      }
    }
    return{selected:rows.length,paid,failed,sent,failures};
  }finally{gramBulkRunningV112=false}
}
async function handleGramBulkV112(up,uid,text,m,q){
  const data=String(q?.data||'');if(!q||!data.startsWith('gbulk112:'))return false;
  try{await adm18(uid,'withdrawals')}catch{await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:'Admin required',show_alert:true});return true}
  const act=data.split(':')[1];
  if(act==='review'){await edit18(q,await gramBulkReviewV112());await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:'Review the 10 lowest GRAM withdrawals'});return true}
  if(act==='confirm'){
    if(gramBulkRunningV112){await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:'Bulk GRAM payment already running',show_alert:true});return true}
    await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:'Bulk GRAM payout started'}).catch(()=>null);
    await edit18(q,{text:'⚡ BULK GRAM PAY\\n\\nProcessing up to 10 lowest pending GRAM withdrawals one by one. Do not tap again.',markup:kb18([[cb18('⏳ PROCESSING…','gbulk112:busy')]])}).catch(()=>null);
    try{
      const r=await gramBulkRunV112(uid);
      const fail=r.failures.length?`\\n\\n❌ Failed / skipped:\\n${r.failures.map(x=>'• '+x).join('\\n')}`:'';
      await safeTg18('sendMessage',{chat_id:uid,text:`✅ BULK GRAM PAY COMPLETE\\n\\n💎 Selected: ${r.selected}\\n✅ Paid: ${r.paid}\\n❌ Failed/skipped: ${r.failed}\\n💰 Sent: ${r.sent.toFixed(6)} GRAM${fail}\\n\\nEvery successful withdrawal keeps its own TON transaction and payout log.`,disable_web_page_preview:true});
    }catch(e){await safeTg18('sendMessage',{chat_id:uid,text:`⚠️ BULK GRAM PAY STOPPED\\n\\n${String(e?.message||e).replace(/_/g,' ')}\\n\\nAlready successful individual payouts remain valid and are not retried.`})}
    await safeTg18('sendMessage',{chat_id:uid,...await gramDashboard18(uid),disable_web_page_preview:true}).catch(()=>null);return true
  }
  if(act==='busy'){await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:'Payment is already processing',show_alert:true});return true}
  return false;
}
// === END WIENER GRAM BULK PAY V112 ===
'''
s=s.replace(marker,'\n'+code+marker,1)
# Insert bulk callback before V28's normal callback routing.
needle="  if(!q)return false;\n  if(data.startsWith('wpay:'))"
repl="  if(!q)return false;\n  if(data.startsWith('gbulk112:'))return await handleGramBulkV112(up,uid,text,m,q);\n  if(data.startsWith('wpay:'))"
if needle not in s: raise SystemExit('ERROR: V28 callback anchor changed')
s=s.replace(needle,repl,1)
p.write_text(s)
print('V112 GRAM bulk pay installed')
PY

node --check "$BACKEND"
for x in "WIENER GRAM BULK PAY V112" "BULK PAY · 10 LOWEST" "gbulk112:confirm" "method_key='gram_ton'" "order by receive_usdt asc,created_at asc limit 10"; do grep -Fq "$x" "$BACKEND" || { echo "ERROR: missing $x"; exit 1; }; done
pm2 restart wiener-api --update-env
sleep 3
curl -fsS http://127.0.0.1:3000/health
echo
pm2 save
trap - ERR
echo "=== V112 READY ==="
echo "/pay -> GRAM PAY CENTER now includes BULK PAY · 10 LOWEST."
echo "No payout was executed by this installer."
