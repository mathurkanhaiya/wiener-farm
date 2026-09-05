#!/usr/bin/env python3
from pathlib import Path
import os

p=Path(os.environ.get("WIENER_BACKEND_FILE","/opt/wiener-backend/server.mjs"))
if not p.exists():
    alt=Path("/opt/wiener-backend/server.js")
    if alt.exists(): p=alt

s=p.read_text()
TAG="WIENER SPONSORED PAYMENT SWEEP V44"
if TAG in s:
    print("V44 payment sweep already installed")
    raise SystemExit(0)

if "WIENER SPONSORED PAYMENT VERIFICATION V42" not in s:
    raise SystemExit("ERROR: V42 payment verifier is required")

start=s.find("let sponsorPaymentSweepBusyV42=false;")
end=s.find("// === END WIENER SPONSORED PAYMENT VERIFICATION V42 ===",start)
if start<0 or end<0:
    raise SystemExit("ERROR: V42 payment sweep block not found")

new=r'''// === WIENER SPONSORED PAYMENT SWEEP V44 ===
let sponsorPaymentSweepBusyV42=false;
async function sponsorPaymentSweepV42(){
  if(sponsorPaymentSweepBusyV42)return;
  sponsorPaymentSweepBusyV42=true;
  try{
    // Only recent unpaid orders trigger automatic chain polling.
    // Older abandoned orders remain recoverable via explicit CHECK PAYMENT.
    const pending=(await pool.query(
      "select "+
      "(select count(*)::int from public.exclusive_task_orders where status='awaiting_payment' and created_at>=now()-interval '6 hours') orders,"+
      "(select count(*)::int from public.sponsored_task_topups where status in ('awaiting_payment','payment_pending') and created_at>=now()-interval '6 hours') topups"
    )).rows[0]||{};
    if(Number(pending.orders||0)+Number(pending.topups||0)===0)return;

    await sponsorScanV30();

    const orders=(await pool.query(
      "select * from public.exclusive_task_orders where status='awaiting_payment' and created_at>=now()-interval '6 hours' order by created_at asc limit 30"
    )).rows;
    for(const o of orders){
      try{await reconcileSponsoredV10B(o)}
      catch(e){console.error("v44_order_reconcile",String(e?.message||e))}
    }

    const topups=(await pool.query(
      "select * from public.sponsored_task_topups where status in ('awaiting_payment','payment_pending') and created_at>=now()-interval '6 hours' order by created_at asc limit 30"
    )).rows;
    for(const x of topups){
      try{await reconcileSponsorTopupV30(x)}
      catch(e){console.error("v44_topup_reconcile",String(e?.message||e))}
    }
  }finally{sponsorPaymentSweepBusyV42=false}
}
const sponsorPaymentTimerV42=setInterval(
  ()=>sponsorPaymentSweepV42().catch(e=>console.error("v44_payment_sweep",String(e?.message||e))),
  7000
);
if(sponsorPaymentTimerV42.unref)sponsorPaymentTimerV42.unref();
// === END WIENER SPONSORED PAYMENT SWEEP V44 ===
'''
s=s[:start]+new+s[end:]

p.write_text(s)
print("V44 installed: 7s automatic TON sweep limited to recent pending payments; old orders remain manually recoverable")
