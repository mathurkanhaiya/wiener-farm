#!/usr/bin/env python3
from pathlib import Path
import os,re

p=Path(os.environ.get('WIENER_BACKEND_FILE','/opt/wiener-backend/server.mjs'))
if not p.exists():
    alt=Path('/opt/wiener-backend/server.js')
    if alt.exists(): p=alt
if not p.exists(): raise SystemExit('ERROR: Wiener backend file not found')

s=p.read_text()
TAG='WIENER SPONSORED PAYMENT DB-FIRST V82'
if TAG in s:
    print('V82 sponsored payment DB-first fix already installed')
    raise SystemExit(0)
for need in ['async function reconcileSponsoredV10B','async function sponsorScanV30','sponsorPaymentSweepV42']:
    if need not in s: raise SystemExit('ERROR: required sponsored payment feature missing: '+need)

# Explicit user checks must not fail just because TON RPC is unavailable after the
# treasury monitor has already persisted the confirmed deposit in Postgres.
s=s.replace('await sponsorScanV30(true);',"await sponsorScanV30(true).catch(e=>{console.error('v82_ton_scan_unavailable',String(e?.message||e));return null});")

# Rebuild the V42 sweep so persisted deposits are reconciled BEFORE any RPC call.
start=s.find('async function sponsorPaymentSweepV42(){')
if start<0: raise SystemExit('ERROR: V42 payment sweep function not found')
end=s.find('const sponsorPaymentTimerV42=',start)
if end<0: raise SystemExit('ERROR: V42 payment sweep timer anchor not found')

new_fn=r'''async function sponsorPaymentSweepV42(){
  if(sponsorPaymentSweepBusyV42)return;
  sponsorPaymentSweepBusyV42=true;
  try{
    const loadPending=async()=>({
      orders:(await pool.query("select * from public.exclusive_task_orders where status='awaiting_payment' order by created_at asc limit 100")).rows,
      topups:(await pool.query("select * from public.sponsored_task_topups where status in ('awaiting_payment','payment_pending') order by created_at asc limit 100")).rows
    });

    // PASS 1: database first. If treasury detection already saved the TON deposit,
    // activate the sponsored task without depending on TON RPC availability.
    let p=await loadPending();
    if(!p.orders.length&&!p.topups.length)return;
    for(const o of p.orders)try{await reconcileSponsoredV10B(o)}catch(e){console.error('v82_db_order_reconcile',String(e?.message||e))}
    for(const x of p.topups)try{await reconcileSponsorTopupV30(x)}catch(e){console.error('v82_db_topup_reconcile',String(e?.message||e))}

    // PASS 2: only use TON RPC for deposits not already known locally. An RPC outage
    // no longer blocks settlement of confirmed deposits already in treasury history.
    p=await loadPending();
    if(p.orders.length||p.topups.length){
      try{await sponsorScanV30()}catch(e){console.error('v82_ton_scan_unavailable',String(e?.message||e))}
    }

    // PASS 3: reconcile anything the fresh scan just discovered.
    p=await loadPending();
    for(const o of p.orders)try{await reconcileSponsoredV10B(o)}catch(e){console.error('v82_postscan_order_reconcile',String(e?.message||e))}
    for(const x of p.topups)try{await reconcileSponsorTopupV30(x)}catch(e){console.error('v82_postscan_topup_reconcile',String(e?.message||e))}
  }finally{sponsorPaymentSweepBusyV42=false}
}
// === WIENER SPONSORED PAYMENT DB-FIRST V82 ===
'''
s=s[:start]+new_fn+s[end:]

p.write_text(s)
print('V82 installed: confirmed treasury deposits reconcile before TON RPC checks')
