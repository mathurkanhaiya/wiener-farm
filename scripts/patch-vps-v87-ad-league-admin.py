#!/usr/bin/env python3
from pathlib import Path
import os,re

p=Path(os.environ.get('WIENER_BACKEND_FILE','/opt/wiener-backend/server.mjs'))
if not p.exists():
    alt=Path('/opt/wiener-backend/server.js')
    if alt.exists(): p=alt
if not p.exists(): raise SystemExit('ERROR: Wiener backend file not found')
s=p.read_text()
TAG='// === WIENER WEEKLY AD LEAGUE V87 ADMIN ==='
if TAG in s:
    print('V87 ad league admin backend already installed')
    raise SystemExit(0)
if '// === WIENER WEEKLY AD LEAGUE V86 ===' not in s:
    raise SystemExit('ERROR: V86 backend not installed; install V86 first')

old="const adLeaguePrizeV86=(rank)=>rank===1?10000:rank===2?7000:rank===3?5000:rank===4?3500:rank===5?3000:(rank>=6&&rank<=10)?2000:(rank>=11&&rank<=20)?750:(rank>=21&&rank<=30)?400:0;"
new="const adLeaguePrizeV86=(rank,pool=50000)=>{const base=rank===1?10000:rank===2?7000:rank===3?5000:rank===4?3500:rank===5?3000:(rank>=6&&rank<=10)?2000:(rank>=11&&rank<=20)?750:(rank>=21&&rank<=30)?400:0;return Math.round(base*(Number(pool||50000)/50000)*100)/100};\n// === WIENER WEEKLY AD LEAGUE V87 ADMIN ==="
if old not in s:
    raise SystemExit('ERROR: V86 prize function anchor not found')
s=s.replace(old,new,1)

s=s.replace('const prize=adLeaguePrizeV86(Number(r.rank));','const prize=adLeaguePrizeV86(Number(r.rank),Number(l.prize_pool||50000));',1)
s=s.replace('const top=q.rows.map(r=>({...r,prize:adLeaguePrizeV86(Number(r.rank))}));','const top=q.rows.map(r=>({...r,prize:adLeaguePrizeV86(Number(r.rank),Number(league?.prize_pool||50000))}));',1)
s=s.replace("me:me?{...me,prize:adLeaguePrizeV86(Number(me.rank))}:{rank:null,valid_ads:0,bonus_days:0,points:0,prize:0}","me:me?{...me,prize:adLeaguePrizeV86(Number(me.rank),Number(league?.prize_pool||50000))}:{rank:null,valid_ads:0,bonus_days:0,points:0,prize:0}",1)

needle="    if(action==='history'){\n      const rows=(await pool.query(`select r.week_start,r.rank,r.points,r.prize,r.status,r.credited_at from public.wiener_ad_league_rewards r where r.telegram_id=$1 order by r.week_start desc limit 12`,[id])).rows;\n      return res.json({ok:true,data:rows});\n    }\n"
if needle not in s:
    raise SystemExit('ERROR: V86 history action anchor not found')
admin=r'''    if(action==='admin_status'){
      const a=await isAdmin(id);if(!a)throw new Error('admin_required');
      const week=await ensureAdLeagueV86();
      const league=(await pool.query(`select * from public.wiener_ad_leagues where week_start=$1`,[week])).rows[0];
      const participants=Number((await pool.query(`select count(distinct telegram_id)::int c from public.wiener_ad_league_events where week_start=$1`,[week])).rows[0]?.c||0);
      const events=Number((await pool.query(`select count(*)::int c from public.wiener_ad_league_events where week_start=$1`,[week])).rows[0]?.c||0);
      return res.json({ok:true,data:{league,participants,events,next_prize_pool:50000}});
    }
    if(action==='admin_update'){
      const a=await isAdmin(id);if(!a)throw new Error('admin_required');
      const week=await ensureAdLeagueV86();
      const enabled=typeof b.enabled==='boolean'?b.enabled:null;
      const prize=b.prize_pool==null?null:Math.max(0,Math.min(1000000,Number(b.prize_pool)));
      const target=b.daily_target==null?null:Math.max(1,Math.min(100,Math.floor(Number(b.daily_target))));
      const daily=b.daily_bonus==null?null:Math.max(0,Math.min(1000,Math.floor(Number(b.daily_bonus))));
      const streak=b.streak_bonus==null?null:Math.max(0,Math.min(5000,Math.floor(Number(b.streak_bonus))));
      const q=await pool.query(`update public.wiener_ad_leagues set
        enabled=coalesce($2,enabled),prize_pool=coalesce($3,prize_pool),daily_target=coalesce($4,daily_target),daily_bonus=coalesce($5,daily_bonus),streak_bonus=coalesce($6,streak_bonus)
        where week_start=$1 returning *`,[week,enabled,prize,target,daily,streak]);
      return res.json({ok:true,data:q.rows[0]});
    }
'''
s=s.replace(needle,needle+admin,1)

p.write_text(s)
print('V87 installed: dynamic pool prizes + admin league controls')
