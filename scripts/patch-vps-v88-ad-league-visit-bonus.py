#!/usr/bin/env python3
from pathlib import Path
import os

p=Path(os.environ.get('WIENER_BACKEND_FILE','/opt/wiener-backend/server.mjs'))
if not p.exists():
    alt=Path('/opt/wiener-backend/server.js')
    if alt.exists(): p=alt
if not p.exists(): raise SystemExit('ERROR: Wiener backend file not found')
s=p.read_text()
TAG='// === WIENER WEEKLY AD LEAGUE V88 VISIT BONUS ==='
if TAG in s:
    print('V88 visit bonus already installed')
    raise SystemExit(0)
if '// === WIENER WEEKLY AD LEAGUE V86 ===' not in s:
    raise SystemExit('ERROR: V86 league backend missing')

route="app.post('/functions/v1/wiener-ad-league',async(req,res)=>{"
if route not in s: raise SystemExit('ERROR: league route anchor missing')

helper=r'''

// === WIENER WEEKLY AD LEAGUE V88 VISIT BONUS ===
async function finalizePreviousAdLeagueV88(){
  const current=await ensureAdLeagueV86();
  const prev=(await pool.query(`select week_start from public.wiener_ad_leagues where week_start<$1::date and status='active' order by week_start desc limit 1`,[current])).rows[0];
  if(!prev)return;
  const c=await pool.connect();
  try{
    await c.query('begin');
    await c.query(`select pg_advisory_xact_lock(hashtext('wiener-ad-league-v88-'||$1::text))`,[prev.week_start]);
    const l=(await c.query(`select * from public.wiener_ad_leagues where week_start=$1 for update`,[prev.week_start])).rows[0];
    if(!l||l.status!=='active'){await c.query('commit');return}
    const ranked=await c.query(`with daily as (
      select telegram_id,event_day,count(*)::int ads from public.wiener_ad_league_events where week_start=$1 group by telegram_id,event_day
    ), agg as (
      select e.telegram_id,count(*)::int valid_ads,coalesce(sum(e.bonus_points),0)::int visit_bonus_points,
        count(distinct d.event_day) filter(where d.ads>=coalesce($2,10))::int bonus_days
      from public.wiener_ad_league_events e
      left join daily d on d.telegram_id=e.telegram_id and d.event_day=e.event_day
      join public.users u on u.telegram_id=e.telegram_id
      where e.week_start=$1 and coalesce(u.is_banned,false)=false
      group by e.telegram_id
    ), scored as (
      select telegram_id,valid_ads,visit_bonus_points,least(bonus_days,7)::int bonus_days,
        (valid_ads + visit_bonus_points + least(bonus_days,7)*coalesce($3,5) + case when bonus_days>=7 then coalesce($4,25) else 0 end)::int points
      from agg
    ) select telegram_id,valid_ads,visit_bonus_points,bonus_days,points,row_number() over(order by points desc,valid_ads desc,telegram_id asc)::int rank from scored order by rank asc limit 30`,[prev.week_start,Number(l.daily_target||10),Number(l.daily_bonus||5),Number(l.streak_bonus||25)]);
    for(const r of ranked.rows){
      const prize=adLeaguePrizeV86(Number(r.rank),Number(l.prize_pool||50000));
      if(prize<=0)continue;
      const ins=await c.query(`insert into public.wiener_ad_league_rewards(week_start,telegram_id,rank,points,prize,status,credited_at)
        values($1,$2,$3,$4,$5,'credited',now()) on conflict(week_start,telegram_id) do nothing returning telegram_id`,[prev.week_start,r.telegram_id,r.rank,r.points,prize]);
      if(ins.rows.length)await c.query(`update public.users set balance=coalesce(balance,0)+$2,total_earned=coalesce(total_earned,0)+$2 where telegram_id=$1`,[r.telegram_id,prize]);
    }
    await c.query(`update public.wiener_ad_leagues set status='completed',finalized_at=now() where week_start=$1`,[prev.week_start]);
    await c.query('commit');
  }catch(e){await c.query('rollback');throw e}finally{c.release()}
}
async function adLeagueStatusV88(uid){
  await finalizePreviousAdLeagueV88();
  const week=await ensureAdLeagueV86();
  const league=(await pool.query(`select * from public.wiener_ad_leagues where week_start=$1`,[week])).rows[0];
  const args=[week,Number(league?.daily_target||10),Number(league?.daily_bonus||5),Number(league?.streak_bonus||25)];
  const base=`with daily as (
      select telegram_id,event_day,count(*)::int ads from public.wiener_ad_league_events where week_start=$1 group by telegram_id,event_day
    ), agg as (
      select e.telegram_id,count(*)::int valid_ads,coalesce(sum(e.bonus_points),0)::int visit_bonus_points,
        count(distinct d.event_day) filter(where d.ads>=coalesce($2,10))::int bonus_days
      from public.wiener_ad_league_events e
      left join daily d on d.telegram_id=e.telegram_id and d.event_day=e.event_day
      join public.users u on u.telegram_id=e.telegram_id
      where e.week_start=$1 and coalesce(u.is_banned,false)=false
      group by e.telegram_id
    ), scored as (
      select telegram_id,valid_ads,visit_bonus_points,least(bonus_days,7)::int bonus_days,
        (valid_ads + visit_bonus_points + least(bonus_days,7)*coalesce($3,5) + case when bonus_days>=7 then coalesce($4,25) else 0 end)::int points
      from agg
    ), ranked as (
      select s.*,row_number() over(order by points desc,valid_ads desc,telegram_id asc)::int rank from scored s
    ) `;
  const top=(await pool.query(base+`select r.rank,r.telegram_id,r.valid_ads,r.visit_bonus_points,r.bonus_days,r.points,u.username,u.first_name,u.photo_url from ranked r join public.users u on u.telegram_id=r.telegram_id order by r.rank asc limit 30`,args)).rows;
  const me=(await pool.query(base+`select * from ranked where telegram_id=$5 limit 1`,[...args,uid])).rows[0]||null;
  const today=Number((await pool.query(`select count(*)::int c from public.wiener_ad_league_events where week_start=$1 and telegram_id=$2 and event_day=(now() at time zone 'utc')::date`,[week,uid])).rows[0]?.c||0);
  const qualifiedToday=Number((await pool.query(`select count(*)::int c from public.wiener_ad_league_events where week_start=$1 and telegram_id=$2 and event_day=(now() at time zone 'utc')::date and interaction_qualified=true`,[week,uid])).rows[0]?.c||0);
  const rows=top.map(r=>({...r,prize:adLeaguePrizeV86(Number(r.rank),Number(league?.prize_pool||50000))}));
  return {week_start:week,week_end:league?.week_end,enabled:league?.enabled!==false,prize_pool:Number(league?.prize_pool||50000),daily_target:Number(league?.daily_target||10),daily_bonus:Number(league?.daily_bonus||5),streak_bonus:Number(league?.streak_bonus||25),visit_bonus:2,visit_seconds:5,today_ads:today,qualified_visits_today:qualifiedToday,me:me?{...me,prize:adLeaguePrizeV86(Number(me.rank),Number(league?.prize_pool||50000))}:{rank:null,valid_ads:0,visit_bonus_points:0,bonus_days:0,points:0,prize:0},top:rows};
}
'''
s=s.replace(route,helper+'\n'+route,1)
s=s.replace("if(action==='status')return res.json({ok:true,data:await adLeagueStatusV86(id)});","if(action==='status')return res.json({ok:true,data:await adLeagueStatusV88(id)});",1)

anchor="    if(action==='history'){"
bonus=r'''    if(action==='visit_bonus'){
      const session=String(b.session_id||'').trim();
      const visitMs=Math.max(0,Number(b.visit_ms||0));
      if(!session)throw new Error('session_required');
      if(visitMs<5000)return res.json({ok:true,data:{qualified:false,awarded_points:0,reason:'visit_too_short'}});
      const week=await ensureAdLeagueV86();
      const q=await pool.query(`update public.wiener_ad_league_events set interaction_qualified=true,bonus_points=2
        where week_start=$1 and telegram_id=$2 and session_key=$3 and coalesce(interaction_qualified,false)=false
        returning id`,[week,id,session]);
      if(q.rows.length)return res.json({ok:true,data:{qualified:true,awarded_points:2}});
      const exists=(await pool.query(`select interaction_qualified,bonus_points from public.wiener_ad_league_events where week_start=$1 and telegram_id=$2 and session_key=$3 limit 1`,[week,id,session])).rows[0];
      if(exists)return res.json({ok:true,data:{qualified:!!exists.interaction_qualified,awarded_points:0,already_awarded:!!exists.interaction_qualified}});
      return res.json({ok:true,data:{qualified:false,awarded_points:0,reason:'credited_session_not_found'}});
    }
'''
if anchor not in s: raise SystemExit('ERROR: history action anchor missing')
s=s.replace(anchor,bonus+anchor,1)
p.write_text(s)
print('V88 installed: 5-second visit bonus (+2 points) + live scoring')
