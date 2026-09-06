#!/usr/bin/env python3
from pathlib import Path
import os

p=Path(os.environ.get('WIENER_BACKEND_FILE','/opt/wiener-backend/server.mjs'))
if not p.exists():
    q=Path('/opt/wiener-backend/server.js')
    if q.exists(): p=q
s=p.read_text()
TAG='WIENER SPIN SHARE BONUS V50'
if TAG in s:
    print('V50 spinner share bonus already installed')
    raise SystemExit(0)
if 'WIENER SPIN SECURITY V49' not in s:
    raise SystemExit('ERROR: V49 spinner security must be installed first')

# 1 free + 14 ad-earned regular spins per day. Bonus spins remain separate.
s=s.replace("ad_daily:Math.max(0,Math.min(10,Number(x.spin_ad_daily_limit||3)))","ad_daily:Math.max(0,Math.min(20,Number(x.spin_ad_daily_limit||14)))",1)

# Updated reward economy. 5-WIENER appears on two wheel segments, split equally.
start=s.find("const prizesV48=[")
end=s.find("];\nfunction chooseSpinV48",start)
if start<0 or end<0:
    raise SystemExit('ERROR: prizesV48 block not found')
new_prizes="""const prizesV48=[
  {type:'wiener',amount:5,index:0,weight:14000},{type:'wiener',amount:5,index:10,weight:14000},
  {type:'wiener',amount:10,index:2,weight:23000},{type:'wiener',amount:20,index:4,weight:15000},
  {type:'wiener',amount:30,index:6,weight:8000},{type:'wiener',amount:50,index:8,weight:4000},
  {type:'spin',amount:1,index:3,weight:10000},{type:'spin',amount:2,index:7,weight:3000},
  {type:'ton',amount:.0001,index:1,weight:5000},{type:'ton',amount:.0003,index:5,weight:2000},
  {type:'ton',amount:.001,index:9,weight:1500},{type:'ton',amount:.005,index:11,weight:500}
"""
s=s[:start]+new_prizes+s[end:]

# Keep stored bonus spins bounded to stop recursive reward loops from growing without limit.
s=s.replace("bonus_spins=bonus_spins+$2,updated_at=now()", "bonus_spins=least(5,bonus_spins+$2),updated_at=now()", 1)

# Add secure share-bonus actions inside the existing authenticated Spinner route.
needle="if(!cfg.enabled)return res.status(503).json({ok:false,error:'spin_disabled',message:'Spin & Earn is temporarily unavailable.'});\n"
if needle not in s:
    raise SystemExit('ERROR: spinner action insertion point not found')
insert=r'''if(action==='share_status'){
      const st=await spinStateV48(id);
      const q=(await pool.query(`select completed_shares,rewarded from public.wiener_spin_share_bonus where telegram_id=$1`,[id])).rows[0]||{};
      return res.json({ok:true,data:{eligible:Number(st.total_ton_earned||0)>0,completed_shares:Number(q.completed_shares||0),required_shares:5,rewarded:q.rewarded===true,reward_ton:.0025}});
    }
    if(action==='share_start'){
      const st=await spinStateV48(id);
      if(Number(st.total_ton_earned||0)<=0)return res.status(403).json({ok:false,error:'share_bonus_locked',message:'Win TON from Spin & Earn first to unlock this bonus.'});
      const q=(await pool.query(`select completed_shares,rewarded from public.wiener_spin_share_bonus where telegram_id=$1`,[id])).rows[0]||{};
      if(q.rewarded===true)return res.json({ok:true,data:{already_rewarded:true,completed_shares:5,required_shares:5,reward_ton:.0025}});
      const recent=(await pool.query(`select created_at from public.wiener_spin_share_sessions where telegram_id=$1 order by created_at desc limit 1`,[id])).rows[0];
      if(recent&&Date.now()-new Date(recent.created_at).getTime()<3500)return res.status(429).json({ok:false,error:'share_cooldown',message:'Please wait a moment before sharing again.'});
      const sid=crypto.randomBytes(18).toString('hex');
      await pool.query(`insert into public.wiener_spin_share_sessions(session_id,telegram_id) values($1,$2)`,[sid,id]);
      return res.json({ok:true,data:{session_id:sid,completed_shares:Number(q.completed_shares||0),required_shares:5,reward_ton:.0025}});
    }
    if(action==='share_complete'){
      const sid=String(b.session_id||'');const hiddenMs=Math.max(0,Math.min(600000,Number(b.hidden_ms||0)));
      if(!/^[a-f0-9]{36}$/.test(sid))throw new Error('invalid_share_session');
      const c=await pool.connect();try{
        await c.query('begin');
        const sess=(await c.query(`select * from public.wiener_spin_share_sessions where session_id=$1 and telegram_id=$2 for update`,[sid,id])).rows[0];
        if(!sess)throw new Error('share_session_not_found');
        if(sess.status==='completed'){
          const q=(await c.query(`select completed_shares,rewarded from public.wiener_spin_share_bonus where telegram_id=$1`,[id])).rows[0]||{};
          await c.query('commit');
          return res.json({ok:true,data:{detected:true,duplicate:true,completed_shares:Number(q.completed_shares||0),required_shares:5,rewarded:q.rewarded===true,reward_ton:.0025}});
        }
        const age=Date.now()-new Date(sess.created_at).getTime();
        if(age<2500||hiddenMs<2500){
          await c.query(`update public.wiener_spin_share_sessions set status='failed',completed_at=now() where session_id=$1`,[sid]);
          await c.query('commit');
          return res.status(409).json({ok:false,error:'share_not_detected',message:'Share not detected — send again.'});
        }
        if(age>10*60*1000)throw new Error('share_session_expired');
        await c.query(`insert into public.wiener_spin_share_bonus(telegram_id) values($1) on conflict(telegram_id) do nothing`,[id]);
        const bonus=(await c.query(`select * from public.wiener_spin_share_bonus where telegram_id=$1 for update`,[id])).rows[0];
        if(bonus.rewarded===true){
          await c.query(`update public.wiener_spin_share_sessions set status='completed',completed_at=now() where session_id=$1`,[sid]);
          await c.query('commit');
          return res.json({ok:true,data:{detected:true,completed_shares:5,required_shares:5,rewarded:true,reward_ton:.0025}});
        }
        const next=Math.min(5,Number(bonus.completed_shares||0)+1);
        let rewarded=false;
        await c.query(`update public.wiener_spin_share_bonus set completed_shares=$2,updated_at=now() where telegram_id=$1`,[id,next]);
        if(next>=5){
          const spin=(await c.query(`select total_ton_earned from public.wiener_spin_state where telegram_id=$1 for update`,[id])).rows[0];
          if(Number(spin?.total_ton_earned||0)<=0)throw new Error('share_bonus_locked');
          await c.query(`update public.wiener_spin_state set spin_ton_balance=spin_ton_balance+0.0025,total_ton_earned=total_ton_earned+0.0025,updated_at=now() where telegram_id=$1`,[id]);
          await c.query(`update public.wiener_spin_share_bonus set rewarded=true,rewarded_at=now(),updated_at=now() where telegram_id=$1`,[id]);
          rewarded=true;
        }
        await c.query(`update public.wiener_spin_share_sessions set status='completed',completed_at=now() where session_id=$1`,[sid]);
        await c.query('commit');
        return res.json({ok:true,data:{detected:true,completed_shares:next,required_shares:5,rewarded,reward_ton:.0025}});
      }catch(e){await c.query('rollback');throw e}finally{c.release()}
    }
    '''
s=s.replace(needle,needle+insert,1)
s=s.replace('// === WIENER SPIN SECURITY V49 ===','// === WIENER SPIN SECURITY V49 ===\n// === WIENER SPIN SHARE BONUS V50 ===',1)
p.write_text(s)
print('V50 spinner 15/day + share bonus patch applied to',p)
