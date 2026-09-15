#!/usr/bin/env python3
from pathlib import Path
import os,re

p=Path(os.environ.get('WIENER_BACKEND_FILE','/opt/wiener-backend/server.mjs'))
if not p.exists():
    q=Path('/opt/wiener-backend/server.js')
    if q.exists(): p=q
s=p.read_text()
TAG='WIENER SPIN SECURITY V49'
if TAG in s:
    print('V49 spinner security already installed')
    raise SystemExit(0)
if 'WIENER SPIN EARN V48' not in s:
    raise SystemExit('ERROR: V48 Spin & Earn must be installed first')

# Runtime users must never execute schema DDL. Schema is provisioned once by the installer as postgres.
pat=r"let spinSetupPromiseV48=null;\nfunction spinSetupV48\(\)\{.*?\n\}\n\nasync function spinSettingsV48"
replacement="""let spinSetupPromiseV48=null;
function spinSetupV48(){
  if(spinSetupPromiseV48)return spinSetupPromiseV48;
  spinSetupPromiseV48=pool.query(`select
    to_regclass('public.wiener_spin_state') as state,
    to_regclass('public.wiener_spin_events') as events,
    to_regclass('public.wiener_spin_ad_sessions') as ads,
    to_regclass('public.wiener_spin_withdrawals') as withdrawals`).then(r=>{
      const x=r.rows[0]||{};
      if(!x.state||!x.events||!x.ads||!x.withdrawals)throw new Error('spin_schema_not_ready');
      return true;
    }).catch(e=>{spinSetupPromiseV48=null;throw e});
  return spinSetupPromiseV48;
}

async function spinSettingsV48"""
s2,n=re.subn(pat,replacement,s,flags=re.S)
if n!=1:
    raise SystemExit(f'ERROR: expected one spinSetupV48 block, found {n}')
s=s2

# Serialize TON budget accounting inside the same DB transaction to prevent concurrent spins exceeding the budget.
old="if(prize.type==='ton'){const used=await tonWonTodayV48();if(used+prize.amount>cfg.ton_budget)prize={type:'wiener',amount:20,index:4,weight:0}}"
new="if(prize.type==='ton'){await c.query(`select pg_advisory_xact_lock(49064801)`);const used=Number((await c.query(`select coalesce(sum(reward_amount),0)::float8 v from public.wiener_spin_events where reward_type='ton' and created_at>=date_trunc('day',now() at time zone 'utc')`)).rows[0]?.v||0);if(used+prize.amount>cfg.ton_budget)prize={type:'wiener',amount:20,index:4,weight:0}}"
if old not in s:
    raise SystemExit('ERROR: TON budget block not found')
s=s.replace(old,new,1)

# Add a marker for installer verification.
s=s.replace('// === WIENER SPIN EARN V48 ===','// === WIENER SPIN EARN V48 ===\n// === WIENER SPIN SECURITY V49 ===',1)
p.write_text(s)
print('V49 spinner security patch applied to',p)
