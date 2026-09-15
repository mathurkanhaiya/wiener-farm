#!/usr/bin/env python3
from pathlib import Path
import os

p=Path(os.environ.get('WIENER_BACKEND_FILE','/opt/wiener-backend/server.mjs'))
if not p.exists():
    alt=Path('/opt/wiener-backend/server.js')
    if alt.exists(): p=alt
s=p.read_text()
TAG='WIENER SPIN EARN V48'
if TAG in s:
    print('V48 Spin & Earn already installed')
    raise SystemExit(0)
for need in ['edgeUser','edgeFail','const pool','app.use((_req,res)=>']:
    if need not in s:
        raise SystemExit('ERROR: required backend primitive missing: '+need)
marker="\napp.use((_req,res)=>\n  res.status(404).json({ok:false,error:'route_not_enabled_yet'})\n);\n"
if marker not in s:
    pos=s.rfind('app.use((_req,res)=>')
    if pos<0: raise SystemExit('ERROR: final fallback marker not found')
    line=s.rfind('\n',0,pos)
    marker=s[line:]

code=r'''

// === WIENER SPIN EARN V48 ===
let spinSetupPromiseV48=null;
function spinSetupV48(){
  if(spinSetupPromiseV48)return spinSetupPromiseV48;
  spinSetupPromiseV48=(async()=>{
    await pool.query(`create table if not exists public.wiener_spin_state(
      telegram_id bigint primary key references public.users(telegram_id) on delete cascade,
      spin_day date not null default current_date,
      free_used integer not null default 0,
      ad_used integer not null default 0,
      bonus_spins integer not null default 0,
      spin_ton_balance numeric(24,9) not null default 0,
      total_ton_earned numeric(24,9) not null default 0,
      total_ton_withdrawn numeric(24,9) not null default 0,
      updated_at timestamptz not null default now()
    )`);
    await pool.query(`create table if not exists public.wiener_spin_events(
      id bigserial primary key,
      telegram_id bigint not null references public.users(telegram_id) on delete cascade,
      idempotency_key text not null unique,
      reward_type text not null check(reward_type in ('wiener','ton','spin')),
      reward_amount numeric(24,9) not null,
      segment_index integer not null,
      source text not null default 'spin',
      created_at timestamptz not null default now()
    )`);
    await pool.query(`create index if not exists wiener_spin_events_user_created_idx on public.wiener_spin_events(telegram_id,created_at desc)`);
    await pool.query(`create table if not exists public.wiener_spin_ad_sessions(
      session_id text primary key,
      telegram_id bigint not null references public.users(telegram_id) on delete cascade,
      status text not null default 'started',
      created_at timestamptz not null default now(),
      completed_at timestamptz
    )`);
    await pool.query(`create index if not exists wiener_spin_ad_sessions_user_idx on public.wiener_spin_ad_sessions(telegram_id,created_at desc)`);
    await pool.query(`create table if not exists public.wiener_spin_withdrawals(
      id bigserial primary key,
      telegram_id bigint not null references public.users(telegram_id) on delete cascade,
      amount_ton numeric(24,9) not null,
      wallet_address text not null,
      status text not null default 'pending',
      tx_hash text,
      created_at timestamptz not null default now(),
      processed_at timestamptz
    )`);
    await pool.query(`create unique index if not exists wiener_spin_one_pending_withdrawal_idx on public.wiener_spin_withdrawals(telegram_id) where status='pending'`);
    await pool.query(`alter table public.app_settings add column if not exists spin_enabled boolean not null default true`);
    await pool.query(`alter table public.app_settings add column if not exists spin_free_daily integer not null default 1`);
    await pool.query(`alter table public.app_settings add column if not exists spin_ad_daily_limit integer not null default 3`);
    await pool.query(`alter table public.app_settings add column if not exists spin_ton_daily_budget numeric(24,9) not null default 0.1`);
    await pool.query(`alter table public.app_settings add column if not exists spin_ton_withdraw_min numeric(24,9) not null default 0.02`);
  })().catch(e=>{spinSetupPromiseV48=null;throw e});
  return spinSetupPromiseV48;
}

async function spinSettingsV48(){
  const x=(await pool.query(`select spin_enabled,spin_free_daily,spin_ad_daily_limit,spin_ton_daily_budget,spin_ton_withdraw_min,adsgram_block_id from public.app_settings where id=true limit 1`)).rows[0]||{};
  return{enabled:x.spin_enabled!==false,free_daily:Math.max(0,Math.min(5,Number(x.spin_free_daily||1))),ad_daily:Math.max(0,Math.min(10,Number(x.spin_ad_daily_limit||3))),ton_budget:Math.max(0,Math.min(10,Number(x.spin_ton_daily_budget||.1))),withdraw_min:Math.max(.001,Number(x.spin_ton_withdraw_min||.02)),block_id:String(x.adsgram_block_id||'')};
}
async function spinStateV48(id){
  await pool.query(`insert into public.wiener_spin_state(telegram_id) values($1) on conflict(telegram_id) do nothing`,[id]);
  await pool.query(`update public.wiener_spin_state set spin_day=current_date,free_used=0,ad_used=0,updated_at=now() where telegram_id=$1 and spin_day<>current_date`,[id]);
  return (await pool.query(`select * from public.wiener_spin_state where telegram_id=$1`,[id])).rows[0];
}
async function spinStatusV48(id){
  const [cfg,st,h,w]=await Promise.all([
    spinSettingsV48(),spinStateV48(id),
    pool.query(`select id,reward_type,reward_amount::float8 reward_amount,segment_index as index,created_at from public.wiener_spin_events where telegram_id=$1 order by created_at desc limit 12`,[id]),
    pool.query(`select id,amount_ton::float8 amount_ton,wallet_address,status,tx_hash,created_at,processed_at from public.wiener_spin_withdrawals where telegram_id=$1 order by created_at desc limit 8`,[id])
  ]);
  const freeLeft=Math.max(0,cfg.free_daily-Number(st.free_used||0)),adLeft=Math.max(0,cfg.ad_daily-Number(st.ad_used||0)),bonus=Math.max(0,Number(st.bonus_spins||0));
  return{enabled:cfg.enabled,free_left:freeLeft,ad_left:adLeft,bonus_spins:bonus,available_spins:freeLeft+bonus,ton_balance:Number(st.spin_ton_balance||0),withdraw_min_ton:cfg.withdraw_min,history:h.rows,withdrawals:w.rows};
}
const prizesV48=[
  {type:'wiener',amount:5,index:0,weight:24000},{type:'wiener',amount:10,index:2,weight:20000},{type:'wiener',amount:20,index:4,weight:15000},
  {type:'wiener',amount:30,index:6,weight:10000},{type:'wiener',amount:50,index:8,weight:6000},{type:'spin',amount:1,index:3,weight:12000},
  {type:'spin',amount:2,index:7,weight:4000},{type:'ton',amount:.0001,index:1,weight:5000},{type:'ton',amount:.0003,index:5,weight:2000},
  {type:'ton',amount:.001,index:9,weight:1500},{type:'ton',amount:.005,index:11,weight:500}
];
function chooseSpinV48(){let r=crypto.randomInt(0,100000);for(const p of prizesV48){if(r<p.weight)return p;r-=p.weight}return prizesV48[0]}
async function tonWonTodayV48(){return Number((await pool.query(`select coalesce(sum(reward_amount),0)::float8 v from public.wiener_spin_events where reward_type='ton' and created_at>=date_trunc('day',now() at time zone 'utc')`)).rows[0]?.v||0)}

app.post('/functions/v1/wiener-spin',async(req,res)=>{
  try{
    await spinSetupV48();
    const b=req.body||{}, {id}=await edgeUser(b),action=String(b.action||'status'),cfg=await spinSettingsV48();
    if(action==='status')return res.json({ok:true,data:await spinStatusV48(id)});
    if(!cfg.enabled)return res.status(503).json({ok:false,error:'spin_disabled',message:'Spin & Earn is temporarily unavailable.'});
    if(action==='ad_start'){
      const st=await spinStateV48(id);if(Number(st.ad_used||0)>=cfg.ad_daily)throw new Error('Daily ad spin limit reached');if(!cfg.block_id)throw new Error('Ads are temporarily unavailable');
      const recent=(await pool.query(`select created_at from public.wiener_spin_ad_sessions where telegram_id=$1 order by created_at desc limit 1`,[id])).rows[0];
      if(recent&&Date.now()-new Date(recent.created_at).getTime()<8000)return res.status(429).json({ok:false,error:'spin_ad_cooldown',message:'Please wait a few seconds before opening another spin ad.'});
      const sid=crypto.randomBytes(18).toString('hex');await pool.query(`insert into public.wiener_spin_ad_sessions(session_id,telegram_id) values($1,$2)`,[sid,id]);
      return res.json({ok:true,data:{session_id:sid,block_id:cfg.block_id}});
    }
    if(action==='ad_complete'){
      const sid=String(b.session_id||'');if(!/^[a-f0-9]{36}$/.test(sid))throw new Error('invalid_spin_ad_session');
      const c=await pool.connect();try{await c.query('begin');const q=await c.query(`select * from public.wiener_spin_ad_sessions where session_id=$1 and telegram_id=$2 for update`,[sid,id]),a=q.rows[0];if(!a)throw new Error('spin_ad_session_not_found');if(a.status==='completed'){await c.query('commit');return res.json({ok:true,data:await spinStatusV48(id),already_completed:true})}const age=Date.now()-new Date(a.created_at).getTime();if(age<2500)throw new Error('spin_ad_too_fast');if(age>20*60*1000)throw new Error('spin_ad_session_expired');await c.query(`insert into public.wiener_spin_state(telegram_id) values($1) on conflict(telegram_id) do nothing`,[id]);await c.query(`update public.wiener_spin_state set spin_day=current_date,free_used=case when spin_day=current_date then free_used else 0 end,ad_used=case when spin_day=current_date then ad_used else 0 end,spin_day=current_date where telegram_id=$1`,[id]);const locked=(await c.query(`select * from public.wiener_spin_state where telegram_id=$1 for update`,[id])).rows[0];if(Number(locked.ad_used||0)>=cfg.ad_daily)throw new Error('Daily ad spin limit reached');await c.query(`update public.wiener_spin_ad_sessions set status='completed',completed_at=now() where session_id=$1`,[sid]);await c.query(`update public.wiener_spin_state set ad_used=ad_used+1,bonus_spins=bonus_spins+1,updated_at=now() where telegram_id=$1`,[id]);await c.query('commit')}catch(e){await c.query('rollback');throw e}finally{c.release()}return res.json({ok:true,data:await spinStatusV48(id)});
    }
    if(action==='spin'){
      const key=String(b.idempotency_key||'').slice(0,100);if(!key||key.length<8)throw new Error('invalid_spin_id');const old=(await pool.query(`select id,reward_type reward_type,reward_amount::float8 reward_amount,segment_index as index from public.wiener_spin_events where idempotency_key=$1 and telegram_id=$2 limit 1`,[key,id])).rows[0];if(old)return res.json({ok:true,data:{type:old.reward_type,amount:Number(old.reward_amount),index:Number(old.index),spin_id:String(old.id),duplicate:true}});
      const c=await pool.connect();try{await c.query('begin');await c.query(`insert into public.wiener_spin_state(telegram_id) values($1) on conflict(telegram_id) do nothing`,[id]);await c.query(`update public.wiener_spin_state set spin_day=current_date,free_used=case when spin_day=current_date then free_used else 0 end,ad_used=case when spin_day=current_date then ad_used else 0 end,spin_day=current_date where telegram_id=$1`,[id]);const st=(await c.query(`select * from public.wiener_spin_state where telegram_id=$1 for update`,[id])).rows[0],freeLeft=Math.max(0,cfg.free_daily-Number(st.free_used||0));if(freeLeft<=0&&Number(st.bonus_spins||0)<=0)throw new Error('No spins available');if(freeLeft>0)await c.query(`update public.wiener_spin_state set free_used=free_used+1,updated_at=now() where telegram_id=$1`,[id]);else await c.query(`update public.wiener_spin_state set bonus_spins=greatest(0,bonus_spins-1),updated_at=now() where telegram_id=$1`,[id]);let prize=chooseSpinV48();if(prize.type==='ton'){const used=await tonWonTodayV48();if(used+prize.amount>cfg.ton_budget)prize={type:'wiener',amount:20,index:4,weight:0}}if(prize.type==='wiener')await c.query(`update public.users set balance=coalesce(balance,0)+$2 where telegram_id=$1`,[id,prize.amount]);else if(prize.type==='ton')await c.query(`update public.wiener_spin_state set spin_ton_balance=spin_ton_balance+$2,total_ton_earned=total_ton_earned+$2,updated_at=now() where telegram_id=$1`,[id,prize.amount]);else await c.query(`update public.wiener_spin_state set bonus_spins=bonus_spins+$2,updated_at=now() where telegram_id=$1`,[id,prize.amount]);const ev=(await c.query(`insert into public.wiener_spin_events(telegram_id,idempotency_key,reward_type,reward_amount,segment_index) values($1,$2,$3,$4,$5) returning id`,[id,key,prize.type,prize.amount,prize.index])).rows[0];await c.query('commit');return res.json({ok:true,data:{type:prize.type,amount:prize.amount,index:prize.index,spin_id:String(ev.id)}})}catch(e){await c.query('rollback');throw e}finally{c.release()}
    }
    if(action==='withdraw'){
      const amount=Number(b.amount_ton||0),wallet=String(b.wallet_address||'').trim();if(!Number.isFinite(amount)||amount<cfg.withdraw_min)throw new Error(`Minimum withdrawal is ${cfg.withdraw_min} TON`);if(amount>100)throw new Error('invalid_withdraw_amount');if(wallet.length<40||wallet.length>80||!/^[A-Za-z0-9_:-]+$/.test(wallet))throw new Error('invalid_ton_wallet');const c=await pool.connect();try{await c.query('begin');await c.query(`insert into public.wiener_spin_state(telegram_id) values($1) on conflict(telegram_id) do nothing`,[id]);const st=(await c.query(`select * from public.wiener_spin_state where telegram_id=$1 for update`,[id])).rows[0];if(Number(st.spin_ton_balance||0)+1e-12<amount)throw new Error('Insufficient Spin TON balance');const pending=(await c.query(`select id from public.wiener_spin_withdrawals where telegram_id=$1 and status='pending' limit 1`,[id])).rows[0];if(pending)throw new Error('You already have a pending Spin TON withdrawal');await c.query(`update public.wiener_spin_state set spin_ton_balance=spin_ton_balance-$2,total_ton_withdrawn=total_ton_withdrawn+$2,updated_at=now() where telegram_id=$1`,[id,amount]);const w=(await c.query(`insert into public.wiener_spin_withdrawals(telegram_id,amount_ton,wallet_address) values($1,$2,$3) returning id,amount_ton::float8 amount_ton,wallet_address,status,created_at`,[id,amount,wallet])).rows[0];await c.query('commit');return res.json({ok:true,data:{withdrawal:w,...await spinStatusV48(id)}})}catch(e){await c.query('rollback');throw e}finally{c.release()}
    }
    throw new Error('unsupported_spin_action');
  }catch(e){return edgeFail(res,e)}
});
'''

if marker.startswith('\napp.use((_req,res)=>'):
    s=s.replace(marker,code+marker,1)
else:
    pos=s.rfind('app.use((_req,res)=>')
    if pos<0: raise SystemExit('ERROR: fallback insertion failed')
    s=s[:pos]+code+s[pos:]
p.write_text(s)
print('V48 installed: secure Spin & Earn backend')
