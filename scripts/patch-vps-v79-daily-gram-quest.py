#!/usr/bin/env python3
from pathlib import Path
import os

p=Path(os.environ.get('WIENER_BACKEND_FILE','/opt/wiener-backend/server.mjs'))
if not p.exists():
    alt=Path('/opt/wiener-backend/server.js')
    if alt.exists(): p=alt
s=p.read_text()
TAG='WIENER DAILY GRAM QUEST V79'
if TAG in s:
    print('V79 daily GRAM quest already installed')
    raise SystemExit(0)
for need in ['edgeUser','const pool','WIENER SPIN EARN V48','app.use((_req,res)=>']:
    if need not in s: raise SystemExit('ERROR: required backend primitive missing: '+need)

pos=s.rfind('app.use((_req,res)=>')
if pos<0: raise SystemExit('ERROR: final fallback route missing')
line=s.rfind('\n',0,pos)

code=r'''

// === WIENER DAILY GRAM QUEST V79 ===
let gramQuestSetupPromiseV79=null;
function gramQuestSetupV79(){
  if(gramQuestSetupPromiseV79)return gramQuestSetupPromiseV79;
  gramQuestSetupPromiseV79=(async()=>{
    await pool.query(`alter table public.app_settings add column if not exists gram_quest_enabled boolean not null default true`);
    await pool.query(`alter table public.app_settings add column if not exists gram_quest_required_ads integer not null default 50`);
    await pool.query(`alter table public.app_settings add column if not exists gram_quest_reward numeric(24,9) not null default 0.03`);
    await pool.query(`create table if not exists public.wiener_gram_daily_quest_claims(
      telegram_id bigint not null references public.users(telegram_id) on delete cascade,
      quest_day date not null,
      verified_main_ads integer not null,
      reward_gram numeric(24,9) not null,
      claimed_at timestamptz not null default now(),
      primary key(telegram_id,quest_day)
    )`);
    await pool.query(`create index if not exists wiener_gram_daily_quest_claims_day_idx on public.wiener_gram_daily_quest_claims(quest_day,claimed_at desc)`);
  })().catch(e=>{gramQuestSetupPromiseV79=null;throw e});
  return gramQuestSetupPromiseV79;
}
async function gramQuestConfigV79(){
  const x=(await pool.query(`select gram_quest_enabled,gram_quest_required_ads,gram_quest_reward from public.app_settings where id=true limit 1`)).rows[0]||{};
  return{enabled:x.gram_quest_enabled!==false,required:Math.max(1,Math.min(500,Number(x.gram_quest_required_ads||50))),reward:Math.max(0,Math.min(10,Number(x.gram_quest_reward||.03)))};
}
async function gramQuestStatusV79(id){
  await gramQuestSetupV79();
  const cfg=await gramQuestConfigV79();
  const [u,c,b]=await Promise.all([
    pool.query(`select case when ads_day=current_date then greatest(0,coalesce(ads_watched_today,0)) else 0 end::int used from public.users where telegram_id=$1`,[id]),
    pool.query(`select reward_gram::float8 reward_gram,claimed_at from public.wiener_gram_daily_quest_claims where telegram_id=$1 and quest_day=current_date limit 1`,[id]),
    pool.query(`select coalesce(spin_ton_balance,0)::float8 balance from public.wiener_spin_state where telegram_id=$1 limit 1`,[id])
  ]);
  const used=Math.max(0,Number(u.rows[0]?.used||0)),claim=c.rows[0]||null;
  return{enabled:cfg.enabled,day:new Date().toISOString().slice(0,10),used,required:cfg.required,remaining:Math.max(0,cfg.required-used),reward_gram:cfg.reward,claimed:!!claim,claimed_at:claim?.claimed_at||null,gram_balance:Number(b.rows[0]?.balance||0)};
}
app.post('/functions/v1/wiener-gram-quest',async(req,res)=>{
  try{
    await gramQuestSetupV79();
    const b=req.body||{}, {id}=await edgeUser(b),action=String(b.action||'status');
    if(action==='status')return res.json({ok:true,data:await gramQuestStatusV79(id)});
    if(action!=='claim')return res.status(400).json({ok:false,error:'invalid_action'});
    const cfg=await gramQuestConfigV79();
    if(!cfg.enabled)return res.status(503).json({ok:false,error:'gram_quest_disabled',message:'Daily GRAM quest is temporarily unavailable.'});
    const c=await pool.connect();
    try{
      await c.query('begin');
      const u=(await c.query(`select telegram_id,case when ads_day=current_date then greatest(0,coalesce(ads_watched_today,0)) else 0 end::int used from public.users where telegram_id=$1 for update`,[id])).rows[0];
      if(!u)throw new Error('user_not_found');
      const old=(await c.query(`select * from public.wiener_gram_daily_quest_claims where telegram_id=$1 and quest_day=current_date`,[id])).rows[0];
      if(old){await c.query('commit');return res.json({ok:true,data:await gramQuestStatusV79(id),already_claimed:true})}
      const used=Number(u.used||0);
      if(used<cfg.required)throw new Error(`Complete ${cfg.required-used} more main ads first`);
      await c.query(`insert into public.wiener_spin_state(telegram_id) values($1) on conflict(telegram_id) do nothing`,[id]);
      await c.query(`insert into public.wiener_gram_daily_quest_claims(telegram_id,quest_day,verified_main_ads,reward_gram) values($1,current_date,$2,$3)`,[id,used,cfg.reward]);
      await c.query(`update public.wiener_spin_state set spin_ton_balance=coalesce(spin_ton_balance,0)+$2,total_ton_earned=coalesce(total_ton_earned,0)+$2,updated_at=now() where telegram_id=$1`,[id,cfg.reward]);
      await c.query('commit');
      return res.json({ok:true,data:await gramQuestStatusV79(id)});
    }catch(e){await c.query('rollback');throw e}finally{c.release()}
  }catch(e){
    const msg=String(e?.message||e||'gram_quest_failed');
    const status=/Complete \d+ more main ads/.test(msg)?409:400;
    return res.status(status).json({ok:false,error:msg.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,''),message:msg});
  }
});
'''

s=s[:line]+code+s[line:]
p.write_text(s)
print('V79 daily GRAM quest patch installed')
