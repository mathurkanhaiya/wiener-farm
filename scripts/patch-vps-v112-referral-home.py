#!/usr/bin/env python3
from pathlib import Path
import os

p=Path(os.environ.get('WIENER_BACKEND_FILE','/opt/wiener-backend/server.mjs'))
s=p.read_text()
tag='// === WIENER REFERRAL HOME GATE V112 ==='
if tag in s:
    print('V112 already installed')
    raise SystemExit(0)
for anchor in ['async function refCreditStageV98(row,stage,amount){',"  if(!row.join_rewarded_at){await refCreditStageV98", "app.post('/functions/v1/wiener-referral-v2'"]:
    if s.count(anchor)!=1: raise SystemExit('ERROR: missing or ambiguous referral anchor: '+anchor)
# Both device registration and the sweeper must stop before either unpaid stage.
s=s.replace("  if(!row.join_rewarded_at){await refCreditStageV98", "  if(!row.join_rewarded_at&&!row.join_home_verified_at)return{pending_home:true,row};\n  if(!row.join_rewarded_at){await refCreditStageV98",1)
# Guard the credit function too: future callers cannot bypass the Home prerequisite.
anchor="async function refCreditStageV98(row,stage,amount){\n  const c=await pool.connect();try{await c.query('begin');"
if anchor not in s: raise SystemExit('ERROR: referral transaction anchor missing')
s=s.replace(anchor,anchor+"""
    const gate=(await c.query(`select r.join_home_verified_at,r.join_rewarded_at,u.is_banned,u.device_blocked,u.referral_reward_eligible,r.vpn_blocked,r.status from public.referral_v2 r join public.users u on u.telegram_id=r.referred_user_id where r.referred_user_id=$1 for update of r`,[row.referred_user_id])).rows[0];
    if(!gate||gate.is_banned||gate.device_blocked||gate.referral_reward_eligible===false||gate.vpn_blocked||gate.status==='banned'||(stage==='join'&&!gate.join_home_verified_at)||(stage==='qualified'&&!gate.join_rewarded_at)){await c.query('rollback');return false}
""",1)
module=Path(__file__).with_name('referral-home-v112.mjs').read_text().replace('export function ','function ')
code=tag+'\n'+module+"""
async function mandatoryHomeCheckV112(body){
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),8000);
  try{
    // Reuse the installed membership verifier via loopback, with signed Telegram auth.
    const r=await fetch('http://127.0.0.1:3000/functions/v1/wiener-mandatory',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'check',initData:body.initData}),signal:ctl.signal});
    const x=await r.json();
    if(!r.ok||x.ok!==true||x.data?.all_joined!==true)throw Error('mandatory_join_required');
  }finally{clearTimeout(timer)}
}
app.post('/functions/v1/wiener-referral-home',createReferralHomeHandler({pool,edgeUser,refUser:refUserV98,refReconcile:refReconcileV98,mandatoryCheck:mandatoryHomeCheckV112,randomToken:()=>crypto.randomBytes(32).toString('hex')}));
// === END WIENER REFERRAL HOME GATE V112 ===
"""
anchor="app.post('/functions/v1/wiener-referral-v2'"
s=s.replace(anchor,code+'\n'+anchor,1)
p.write_text(s)
print('V112 referral Home gate installed; early credits disabled')
