#!/usr/bin/env python3
from pathlib import Path
import os

p=Path(os.environ.get('WIENER_BACKEND_FILE','/opt/wiener-backend/server.mjs'))
if not p.exists():
    q=Path('/opt/wiener-backend/server.js')
    if q.exists(): p=q
s=p.read_text()
TAG='WIENER SPIN CREDIT FIX V51'
if TAG in s:
    print('V51 spinner credit fix already installed')
    raise SystemExit(0)
if 'WIENER SPIN EARN V48' not in s:
    raise SystemExit('ERROR: Spin & Earn V48 route is not installed')

# Keep the runtime cap high enough for 14 rewarded-ad spins/day.
s=s.replace("ad_daily:Math.max(0,Math.min(10,Number(x.spin_ad_daily_limit||3)))","ad_daily:Math.max(0,Math.min(20,Number(x.spin_ad_daily_limit||14)))")

# Reset the separate ad-credit bucket when the spin day changes.
s=s.replace(
"update public.wiener_spin_state set spin_day=current_date,free_used=0,ad_used=0,updated_at=now() where telegram_id=$1 and spin_day<>current_date",
"update public.wiener_spin_state set spin_day=current_date,free_used=0,ad_used=0,ad_spin_credits=0,updated_at=now() where telegram_id=$1 and spin_day<>current_date"
)

# Status: ad-earned spins are separate from prize bonus spins so watching an ad always grants +1.
old="const freeLeft=Math.max(0,cfg.free_daily-Number(st.free_used||0)),adLeft=Math.max(0,cfg.ad_daily-Number(st.ad_used||0)),bonus=Math.max(0,Number(st.bonus_spins||0));\n  return{enabled:cfg.enabled,free_left:freeLeft,ad_left:adLeft,bonus_spins:bonus,available_spins:freeLeft+bonus,ton_balance:Number(st.spin_ton_balance||0),withdraw_min_ton:cfg.withdraw_min,history:h.rows,withdrawals:w.rows};"
new="const freeLeft=Math.max(0,cfg.free_daily-Number(st.free_used||0)),adLeft=Math.max(0,cfg.ad_daily-Number(st.ad_used||0)),adCredits=Math.max(0,Number(st.ad_spin_credits||0)),bonus=Math.max(0,Number(st.bonus_spins||0));\n  return{enabled:cfg.enabled,free_left:freeLeft,ad_left:adLeft,ad_spin_credits:adCredits,bonus_spins:bonus,available_spins:freeLeft+adCredits+bonus,ton_balance:Number(st.spin_ton_balance||0),withdraw_min_ton:cfg.withdraw_min,history:h.rows,withdrawals:w.rows};"
if old in s:
    s=s.replace(old,new,1)
elif 'ad_spin_credits:adCredits' not in s:
    raise SystemExit('ERROR: spinStatusV48 status block not found')

# Both ad-complete and spin paths normalize the daily state. Add ad credit reset there too.
s=s.replace(
"ad_used=case when spin_day=current_date then ad_used else 0 end,spin_day=current_date where telegram_id=$1",
"ad_used=case when spin_day=current_date then ad_used else 0 end,ad_spin_credits=case when spin_day=current_date then ad_spin_credits else 0 end,spin_day=current_date where telegram_id=$1"
)

# Rewarded ad completion: do not put ad credits into bonus_spins (which is capped for wheel rewards).
s=s.replace(
"update public.wiener_spin_state set ad_used=ad_used+1,bonus_spins=bonus_spins+1,updated_at=now() where telegram_id=$1",
"update public.wiener_spin_state set ad_used=ad_used+1,ad_spin_credits=ad_spin_credits+1,updated_at=now() where telegram_id=$1"
)
s=s.replace(
"update public.wiener_spin_state set ad_used=ad_used+1,bonus_spins=least(5,bonus_spins+1),updated_at=now() where telegram_id=$1",
"update public.wiener_spin_state set ad_used=ad_used+1,ad_spin_credits=ad_spin_credits+1,updated_at=now() where telegram_id=$1"
)

# Consume free spin first, then ad-earned credit, then wheel bonus spin.
old_consume="const st=(await c.query(`select * from public.wiener_spin_state where telegram_id=$1 for update`,[id])).rows[0],freeLeft=Math.max(0,cfg.free_daily-Number(st.free_used||0));if(freeLeft<=0&&Number(st.bonus_spins||0)<=0)throw new Error('No spins available');if(freeLeft>0)await c.query(`update public.wiener_spin_state set free_used=free_used+1,updated_at=now() where telegram_id=$1`,[id]);else await c.query(`update public.wiener_spin_state set bonus_spins=greatest(0,bonus_spins-1),updated_at=now() where telegram_id=$1`,[id]);let prize=chooseSpinV48();"
new_consume="const st=(await c.query(`select * from public.wiener_spin_state where telegram_id=$1 for update`,[id])).rows[0],freeLeft=Math.max(0,cfg.free_daily-Number(st.free_used||0)),adCredits=Math.max(0,Number(st.ad_spin_credits||0)),bonus=Math.max(0,Number(st.bonus_spins||0));if(freeLeft<=0&&adCredits<=0&&bonus<=0)throw new Error('No spins available');if(freeLeft>0)await c.query(`update public.wiener_spin_state set free_used=free_used+1,updated_at=now() where telegram_id=$1`,[id]);else if(adCredits>0)await c.query(`update public.wiener_spin_state set ad_spin_credits=greatest(0,ad_spin_credits-1),updated_at=now() where telegram_id=$1`,[id]);else await c.query(`update public.wiener_spin_state set bonus_spins=greatest(0,bonus_spins-1),updated_at=now() where telegram_id=$1`,[id]);let prize=chooseSpinV48();"
if old_consume in s:
    s=s.replace(old_consume,new_consume,1)
elif 'adCredits=Math.max(0,Number(st.ad_spin_credits||0))' not in s:
    raise SystemExit('ERROR: spin consumption block not found')

# Make sure prize bonus spins remain capped at 5, but never cap ad-earned credits.
s=s.replace("bonus_spins=bonus_spins+$2,updated_at=now()","bonus_spins=least(5,bonus_spins+$2),updated_at=now()")

# Marker for installer verification.
s=s.replace('// === WIENER SPIN EARN V48 ===','// === WIENER SPIN EARN V48 ===\n// === WIENER SPIN CREDIT FIX V51 ===',1)
p.write_text(s)
print('V51 spinner schema/ad-credit patch applied to',p)
