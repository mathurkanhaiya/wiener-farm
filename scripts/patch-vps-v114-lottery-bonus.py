#!/usr/bin/env python3
from pathlib import Path
import os
p=Path(os.environ.get('WIENER_BACKEND_FILE','/opt/wiener-backend/server.mjs'))
s=p.read_text()
TAG='WIENER LOTTERY BONUS ENTRIES V114'
if TAG in s: print('V114 already installed'); raise SystemExit(0)
anchor="// === END WIENER DAILY LOTTERY V113 ==="
if anchor not in s: raise SystemExit('ERROR: install V113 first')
code=r"""
// === WIENER LOTTERY BONUS ENTRIES V114 ===
// Lottery ad bonus: max 20 verified completions/day, +1 random-draw entry each.
// Bonus entries do not add to total_pot; paid pool remains 80/20.
async function lotteryBonusSetupV114(){
 await pool.query(`create table if not exists public.wiener_lottery_bonus_entries(id bigserial primary key,round_id bigint not null references public.wiener_lottery_rounds(id) on delete cascade,telegram_id bigint not null references public.users(telegram_id) on delete cascade,session_id text not null unique,created_at timestamptz not null default now())`);
 await pool.query(`create table if not exists public.wiener_lottery_ad_sessions(session_id text primary key,round_id bigint not null references public.wiener_lottery_rounds(id) on delete cascade,telegram_id bigint not null references public.users(telegram_id) on delete cascade,status text not null default 'started',created_at timestamptz not null default now(),completed_at timestamptz)`);
}
app.post('/functions/v1/wiener-lottery-bonus',async(req,res)=>{
 try{
  await lotterySetup();await lotteryBonusSetupV114();const b=req.body||{}, {id}=await edgeUser(b),action=String(b.action||'status'),r=await lotteryRoundV113();
  const used=async()=>Number((await pool.query(`select count(*)::int n from public.wiener_lottery_bonus_entries where round_id=$1 and telegram_id=$2`,[r.id,id])).rows[0]?.n||0);
  if(action==='status')return res.json({ok:true,data:{used:await used(),limit:20,block_id:'int-44228'}});
  if(action==='start'){if(await used()>=20)throw Error('Daily Lottery ad limit reached');const sid=crypto.randomBytes(18).toString('hex');await pool.query(`insert into public.wiener_lottery_ad_sessions(session_id,round_id,telegram_id) values($1,$2,$3)`,[sid,r.id,id]);return res.json({ok:true,data:{session_id:sid,block_id:'int-44228'}})}
  if(action==='complete'){const sid=String(b.session_id||'');const c=await pool.connect();try{await c.query('begin');const a=(await c.query(`select * from public.wiener_lottery_ad_sessions where session_id=$1 and telegram_id=$2 for update`,[sid,id])).rows[0];if(!a)throw Error('Lottery ad session not found');if(a.status==='completed'){await c.query('commit');return res.json({ok:true,data:{used:await used(),limit:20,credited:false}})}if(Date.now()-new Date(a.created_at).getTime()<2500)throw Error('Ad completed too quickly');const n=Number((await c.query(`select count(*)::int n from public.wiener_lottery_bonus_entries where round_id=$1 and telegram_id=$2`,[r.id,id])).rows[0]?.n||0);if(n>=20)throw Error('Daily Lottery ad limit reached');await c.query(`insert into public.wiener_lottery_bonus_entries(round_id,telegram_id,session_id) values($1,$2,$3)`,[r.id,id,sid]);await c.query(`update public.wiener_lottery_ad_sessions set status='completed',completed_at=now() where session_id=$1`,[sid]);await c.query('commit');return res.json({ok:true,data:{used:n+1,limit:20,credited:true}})}catch(e){await c.query('rollback');throw e}finally{c.release()}}
  throw Error('unsupported_lottery_bonus_action');
 }catch(e){return edgeFail(res,e)}
});
// === END WIENER LOTTERY BONUS ENTRIES V114 ===
"""
s=s.replace(anchor,anchor+'\n'+code,1)
# Make final draw select from paid + bonus entries with equal weight.
old="const count=Number(rr.total_tickets||0),digest=crypto.createHash('sha256').update(String(rr.revealed_seed)+':'+String(rr.id)+':'+String(count)).digest('hex'),idx=Number(BigInt('0x'+digest.slice(0,16))%BigInt(count));\n   const win=(await c.query(`select id,telegram_id from public.wiener_lottery_tickets where round_id=$1 order by id offset $2 limit 1`,[r.id,idx])).rows[0];if(!win)throw Error('lottery_winner_missing');"
new="const bonusCount=Number((await c.query(`select count(*)::int n from public.wiener_lottery_bonus_entries where round_id=$1`,[r.id])).rows[0]?.n||0),count=Number(rr.total_tickets||0)+bonusCount,digest=crypto.createHash('sha256').update(String(rr.revealed_seed)+':'+String(rr.id)+':'+String(count)).digest('hex'),idx=Number(BigInt('0x'+digest.slice(0,16))%BigInt(count));\n   const win=(await c.query(`select id,telegram_id from (select id,telegram_id,0 kind from public.wiener_lottery_tickets where round_id=$1 union all select id,telegram_id,1 kind from public.wiener_lottery_bonus_entries where round_id=$1) z order by kind,id offset $2 limit 1`,[r.id,idx])).rows[0];if(!win)throw Error('lottery_winner_missing');"
if old not in s: raise SystemExit('ERROR: V113 draw anchor not found')
s=s.replace(old,new,1)
p.write_text(s)
print('V114 installed: Lottery ad bonus entries')
