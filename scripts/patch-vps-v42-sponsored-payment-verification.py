#!/usr/bin/env python3
from pathlib import Path
import os,re

p=Path(os.environ.get("WIENER_BACKEND_FILE","/opt/wiener-backend/server.mjs"))
if not p.exists():
    alt=Path("/opt/wiener-backend/server.js")
    if alt.exists(): p=alt

s=p.read_text()
TAG="WIENER SPONSORED PAYMENT VERIFICATION V42"
if TAG in s:
    print("V42 payment verification already installed")
    raise SystemExit(0)

for need in [
    "WIENER SPONSORED TON PAYMENT FIX V29",
    "WIENER SPONSORED TASK MANAGER V30",
    "WIENER SPONSORED FIXED REWARD V38",
    "async function reconcileSponsoredV10B",
    "async function reconcileSponsorTopupV30",
    "async function sponsorScanV30"
]:
    if need not in s:
        raise SystemExit("ERROR: required payment feature missing: "+need)

# Fast background scan + deeper paginated scan for explicit CHECK PAYMENT.
scan_start=s.find("async function sponsorScanV30")
scan_end=s.find("async function sponsorOrderV30",scan_start)
if scan_start<0 or scan_end<0:
    raise SystemExit("ERROR: sponsor payment scanner anchors not found")
scanner=r'''async function sponsorScanV30(deep=false){
  const now=Date.now();
  if(sponsorScanPromiseV30)return sponsorScanPromiseV30;
  if(now-sponsorScanAtV30<4500)return{scanned:0,inserted:0,throttled:true};
  sponsorScanAtV30=now;
  sponsorScanPromiseV30=(async()=>{
    const t=await tonTreasuryV10B();let scanned=0,inserted=0,pages=0,lt=null,hash=null;
    const maxPages=deep?3:1;
    for(let page=0;page<maxPages;page++){
      const opts={limit:100};
      if(lt&&hash){opts.lt=lt;opts.hash=hash;opts.inclusive=true}
      const txs=await t.client.getTransactions(t.wc.address,opts);
      if(!txs.length)break;
      pages++;scanned+=txs.length;
      for(const tx of txs)try{if(await saveTonDepositV10B(t,tx))inserted++}catch(e){console.error("v42_save_ton",String(e?.message||e))}
      if(!deep)break;
      const last=txs[txs.length-1],prevLt=BigInt(last.prevTransactionLt||0n),prevHash=BigInt(last.prevTransactionHash||0n);
      if(prevLt<=0n||prevHash<=0n)break;
      const nextLt=prevLt.toString(),nextHash=hashB64V10B(prevHash);
      if(nextLt===lt&&nextHash===hash)break;
      lt=nextLt;hash=nextHash;
    }
    return{scanned,inserted,pages,deep};
  })();
  try{return await sponsorScanPromiseV30}finally{sponsorScanPromiseV30=null}
}

'''
s=s[:scan_start]+scanner+s[scan_end:]

# Explicit app/manager checks must surface TON RPC errors instead of pretending payment was not sent.
for old,new in [
    ("if(a==='check_initial'){\n      await sponsorScanV30().catch(()=>null);","if(a==='check_initial'){\n      await sponsorScanV30(true);"),
    ("if(a==='topup_status'){\n      await sponsorScanV30().catch(()=>null);","if(a==='topup_status'){\n      await sponsorScanV30(true);"),
    ("else if(act==='check'){\n      await sponsorScanV30().catch(()=>null);","else if(act==='check'){\n      await sponsorScanV30(true);"),
    ("else if(act==='topcheck'){\n      await sponsorScanV30().catch(()=>null);","else if(act==='topcheck'){\n      await sponsorScanV30(true);")
]:
    if old in s:
        s=s.replace(old,new,1)

# The creator status endpoint used a separate internal backfill whose errors were swallowed.
# Route it through the same verified scanner so an RPC outage returns a real error.
route=s.find("app.post('/functions/v1/wiener-sponsored-task'")
st=s.find("if(a==='status'){",route if route>=0 else 0)
if route>=0 and st>=0:
    en=s.find("return res.json({ok:true,data:o})",st)
    if en>st:
        b=s[st:en]
        m=re.search(r"if\(o\.status==='awaiting_payment'\)\{try\{.*?\}catch\{\}o=",b,re.S)
        if m:
            b=b[:m.start()]+"if(o.status==='awaiting_payment'){await sponsorScanV30(true);o="+b[m.end():]
            s=s[:st]+b+s[en:]
        else:
            print("WARNING: creator status scan block not changed")
else:
    print("WARNING: creator status action not found")

# Automatic lightweight settlement keeps working even if the user closes the app after paying.
watch=r"""
// === WIENER SPONSORED PAYMENT VERIFICATION V42 ===
let sponsorPaymentSweepBusyV42=false;
async function sponsorPaymentSweepV42(){
  if(sponsorPaymentSweepBusyV42)return;
  sponsorPaymentSweepBusyV42=true;
  try{
    const pending=(await pool.query("select (select count(*)::int from public.exclusive_task_orders where status='awaiting_payment') orders,(select count(*)::int from public.sponsored_task_topups where status in ('awaiting_payment','payment_pending')) topups")).rows[0]||{};
    if(Number(pending.orders||0)+Number(pending.topups||0)===0)return;
    await sponsorScanV30();
    const orders=(await pool.query("select * from public.exclusive_task_orders where status='awaiting_payment' order by created_at asc limit 30")).rows;
    for(const o of orders)try{await reconcileSponsoredV10B(o)}catch(e){console.error("v42_order_reconcile",String(e?.message||e))}
    const topups=(await pool.query("select * from public.sponsored_task_topups where status in ('awaiting_payment','payment_pending') order by created_at asc limit 30")).rows;
    for(const x of topups)try{await reconcileSponsorTopupV30(x)}catch(e){console.error("v42_topup_reconcile",String(e?.message||e))}
  }finally{sponsorPaymentSweepBusyV42=false}
}
const sponsorPaymentTimerV42=setInterval(()=>sponsorPaymentSweepV42().catch(e=>console.error("v42_payment_sweep",String(e?.message||e))),7000);
if(sponsorPaymentTimerV42.unref)sponsorPaymentTimerV42.unref();
// === END WIENER SPONSORED PAYMENT VERIFICATION V42 ===
"""
marker="\napp.use((_req,res)=>\n  res.status(404).json({ok:false,error:'route_not_enabled_yet'})\n);\n"
if marker not in s:
    raise SystemExit("ERROR: final backend marker missing")
s=s.replace(marker,"\n"+watch+marker,1)

p.write_text(s)
print("V42 installed: TON checks hardened + 7s automatic sponsored payment settlement")
