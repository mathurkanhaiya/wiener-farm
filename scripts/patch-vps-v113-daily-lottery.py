#!/usr/bin/env python3
from pathlib import Path
import os
p=Path(os.environ.get('WIENER_BACKEND_FILE','/opt/wiener-backend/server.mjs'))
if not p.exists():
    q=Path('/opt/wiener-backend/server.js')
    if q.exists(): p=q
s=p.read_text()
TAG='WIENER DAILY LOTTERY V113'
if TAG in s:
    print('V113 already installed'); raise SystemExit(0)
for need in ['edgeUser','edgeFail','const pool','app.use((_req,res)=>']:
    if need not in s: raise SystemExit('ERROR: required backend primitive missing: '+need)
code=r'''
// === WIENER DAILY LOTTERY V113 ===
let lotterySetupV113=null;
async function lotterySetup(){
 if(lotterySetupV113)return lotterySetupV113;
 lotterySetupV113=(async()=>{
  await pool.query(`create table if not exists public.wiener_lottery_rounds(id bigserial primary key,round_day date not null unique,status text not null default 'open',ticket_price integer not null default 100,fee_bps integer not null default 2000,total_tickets integer not null default 0,total_pot numeric(24,6) not null default 0,winner_pool numeric(24,6) not null default 0,platform_pool numeric(24,6) not null default 0,winner_user_id bigint references public.users(telegram_id),winning_ticket_id bigint,seed_hash text not null,revealed_seed text,opened_at timestamptz not null default now(),draw_at timestamptz not null,drawn_at timestamptz)`);
  await pool.query(`create table if not exists public.wiener_lottery_tickets(id bigserial primary key,round_id bigint not null references public.wiener_lottery_rounds(id) on delete cascade,telegram_id bigint not null references public.users(telegram_id) on delete cascade,created_at timestamptz not null default now())`);
  await pool.query(`create index if not exists wiener_lottery_tickets_round_idx on public.wiener_lottery_tickets(round_id,id)`);
  await pool.query(`create index if not exists wiener_lottery_tickets_user_idx on public.wiener_lottery_tickets(telegram_id,round_id)`);
  await pool.query(`create table if not exists public.wiener_lottery_purchases(id bigserial primary key,telegram_id bigint not null references public.users(telegram_id) on delete cascade,round_id bigint not null references public.wiener_lottery_rounds(id) on delete cascade,idempotency_key text not null unique,quantity integer not null,cost numeric(24,6) not null,created_at timestamptz not null default now())`);
 })().catch(e=>{lotterySetupV113=null;throw e}); return lotterySetupV113;
}
function lotteryDayV113(){return new Date().toISOString().slice(0,10)}
async function lotteryRoundV113(){
 await lotterySetup();
 const day=lotteryDayV113(),draw=new Date(day+'T23:59:59.999Z'),seed=crypto.randomBytes(32).toString('hex'),hash=crypto.createHash('sha256').update(seed).digest('hex');
 await pool.query(`insert into public.wiener_lottery_rounds(round_day,draw_at,seed_hash,revealed_seed) values($1,$2,$3,$4) on conflict(round_day) do nothing`,[day,draw,hash,seed]);
 return (await pool.query(`select * from public.wiener_lottery_rounds where round_day=$1`,[day])).rows[0];
}
async function lotteryFinalizeV113(){
 await lotterySetup();
 const rows=(await pool.query(`select * from public.wiener_lottery_rounds where status='open' and draw_at<=now() order by id for update skip locked`)).rows;
 for(const r of rows){
  const c=await pool.connect();try{await c.query('begin');const rr=(await c.query(`select * from public.wiener_lottery_rounds where id=$1 for update`,[r.id])).rows[0];if(!rr||rr.status!=='open'){await c.query('rollback');continue}
   const players=Number((await c.query(`select count(distinct telegram_id)::int n from public.wiener_lottery_tickets where round_id=$1`,[r.id])).rows[0]?.n||0);
   if(players<2){
    const refunds=(await c.query(`select telegram_id,count(*)::int n from public.wiener_lottery_tickets where round_id=$1 group by telegram_id`,[r.id])).rows;
    for(const x of refunds)await c.query(`update public.users set balance=coalesce(balance,0)+$2 where telegram_id=$1`,[x.telegram_id,Number(x.n)*Number(rr.ticket_price)]);
    await c.query(`update public.wiener_lottery_rounds set status='refunded',drawn_at=now(),winner_pool=0,platform_pool=0 where id=$1`,[r.id]);await c.query('commit');continue;
   }
   const count=Number(rr.total_tickets||0),digest=crypto.createHash('sha256').update(String(rr.revealed_seed)+':'+String(rr.id)+':'+String(count)).digest('hex'),idx=Number(BigInt('0x'+digest.slice(0,16))%BigInt(count));
   const win=(await c.query(`select id,telegram_id from public.wiener_lottery_tickets where round_id=$1 order by id offset $2 limit 1`,[r.id,idx])).rows[0];if(!win)throw Error('lottery_winner_missing');
   const prize=Math.floor(Number(rr.total_pot)*0.8*1e6)/1e6,fee=Number(rr.total_pot)-prize;
   await c.query(`update public.users set balance=coalesce(balance,0)+$2 where telegram_id=$1`,[win.telegram_id,prize]);
   await c.query(`update public.wiener_lottery_rounds set status='drawn',winner_user_id=$2,winning_ticket_id=$3,winner_pool=$4,platform_pool=$5,drawn_at=now() where id=$1`,[r.id,win.telegram_id,win.id,prize,fee]);
   await c.query('commit');
  }catch(e){await c.query('rollback');throw e}finally{c.release()}
 }
}
async function lotteryStatusV113(id){
 await lotteryFinalizeV113();const r=await lotteryRoundV113();
 const q=await pool.query(`select count(*)::int tickets,count(distinct telegram_id)::int players,count(*) filter(where telegram_id=$2)::int mine from public.wiener_lottery_tickets where round_id=$1`,[r.id,id]);
 const z=q.rows[0]||{},gross=Number(r.total_pot||0),winner=Math.floor(gross*.8*1e6)/1e6;
 const last=(await pool.query(`select r.round_day,r.winner_pool::float8 amount,u.username from public.wiener_lottery_rounds r left join public.users u on u.telegram_id=r.winner_user_id where r.status='drawn' order by r.id desc limit 1`)).rows[0]||null;
 return{draw_id:String(r.id),status:r.status,ticket_price:Number(r.ticket_price),pot:gross,winner_pool:winner,platform_pool:gross-winner,players:Number(z.players||0),tickets:Number(z.tickets||0),my_tickets:Number(z.mine||0),draw_at:r.draw_at,winner:last};
}
app.post('/functions/v1/wiener-daily-lottery',async(req,res)=>{
 try{
  await lotterySetup();const b=req.body||{}, {id}=await edgeUser(b),action=String(b.action||'status');
  if(action==='status')return res.json({ok:true,data:await lotteryStatusV113(id)});
  if(action==='buy'){
   await lotteryFinalizeV113();const qty=Math.max(1,Math.min(100,Math.floor(Number(b.quantity||1)))),key=String(b.idempotency_key||'').slice(0,100);if(key.length<8)throw Error('invalid_purchase_id');
   const old=(await pool.query(`select id from public.wiener_lottery_purchases where idempotency_key=$1 and telegram_id=$2`,[key,id])).rows[0];if(old)return res.json({ok:true,data:await lotteryStatusV113(id),duplicate:true});
   const r=await lotteryRoundV113();if(r.status!=='open'||new Date(r.draw_at).getTime()<=Date.now())throw Error('Lottery entries are closed');
   const cost=qty*Number(r.ticket_price),c=await pool.connect();try{await c.query('begin');const u=(await c.query(`select balance,is_banned,device_blocked from public.users where telegram_id=$1 for update`,[id])).rows[0];if(!u||u.is_banned||u.device_blocked)throw Error('Account is not eligible');if(Number(u.balance||0)<cost)throw Error('Insufficient WIENER balance');
    await c.query(`update public.users set balance=balance-$2 where telegram_id=$1`,[id,cost]);await c.query(`insert into public.wiener_lottery_purchases(telegram_id,round_id,idempotency_key,quantity,cost) values($1,$2,$3,$4,$5)`,[id,r.id,key,qty,cost]);
    await c.query(`insert into public.wiener_lottery_tickets(round_id,telegram_id) select $1,$2 from generate_series(1,$3)`,[r.id,id,qty]);await c.query(`update public.wiener_lottery_rounds set total_tickets=total_tickets+$2,total_pot=total_pot+$3 where id=$1`,[r.id,qty,cost]);await c.query('commit');
   }catch(e){await c.query('rollback');throw e}finally{c.release()}
   return res.json({ok:true,data:await lotteryStatusV113(id)});
  }
  throw Error('unsupported_lottery_action');
 }catch(e){return edgeFail(res,e)}
});
// === END WIENER DAILY LOTTERY V113 ===
'''
pos=s.rfind('app.use((_req,res)=>')
if pos<0: raise SystemExit('ERROR: final fallback not found')
s=s[:pos]+code+'\n'+s[pos:]
p.write_text(s)
print('V113 installed: Daily Lottery backend')
