#!/usr/bin/env python3
from pathlib import Path
import os

p=Path(os.environ.get('WIENER_BACKEND_FILE','/opt/wiener-backend/server.mjs'))
if not p.exists():
    alt=Path('/opt/wiener-backend/server.js')
    if alt.exists(): p=alt
if not p.exists(): raise SystemExit('ERROR: Wiener backend file not found')

s=p.read_text()
TAG='// === WIENER WEEKLY AD LEAGUE V86 ==='
if TAG in s:
    print('V86 weekly ad league backend already installed')
    raise SystemExit(0)

marker="\napp.use((_req,res)=>\n  res.status(404).json({ok:false,error:'route_not_enabled_yet'})\n);\n"
if marker not in s:
    raise SystemExit('ERROR: final 404 insertion marker not found; refusing unsafe patch')

code=r'''

// === WIENER WEEKLY AD LEAGUE V86 ===
const adLeaguePrizeV86=(rank)=>rank===1?10000:rank===2?7000:rank===3?5000:rank===4?3500:rank===5?3000:(rank>=6&&rank<=10)?2000:(rank>=11&&rank<=20)?750:(rank>=21&&rank<=30)?400:0;
const adLeagueWeekV86=()=>new Date(Date.now()-((new Date().getUTCDay()+6)%7)*86400000).toISOString().slice(0,10);
async function ensureAdLeagueV86(){
  const week=adLeagueWeekV86();
  await pool.query(`insert into public.wiener_ad_leagues(week_start,week_end,status,prize_pool,daily_target,daily_bonus,streak_bonus,enabled)
    values($1,$1::date+7,'active',50000,10,5,25,true) on conflict(week_start) do nothing`,[week]);
  return week;
}
async function finalizePreviousAdLeagueV86(){
  const current=await ensureAdLeagueV86();
  const prev=(await pool.query(`select week_start from public.wiener_ad_leagues where week_start<$1::date and status='active' order by week_start desc limit 1`,[current])).rows[0];
  if(!prev)return;
  const c=await pool.connect();
  try{
    await c.query('begin');
    await c.query(`select pg_advisory_xact_lock(hashtext('wiener-ad-league-'||$1::text))`,[prev.week_start]);
    const l=(await c.query(`select * from public.wiener_ad_leagues where week_start=$1 for update`,[prev.week_start])).rows[0];
    if(!l||l.status!=='active'){await c.query('commit');return}
    const ranked=await c.query(`with daily as (
      select telegram_id,event_day,count(*)::int ads from public.wiener_ad_league_events where week_start=$1 group by telegram_id,event_day
    ), agg as (
      select e.telegram_id,count(*)::int valid_ads,
        count(distinct d.event_day) filter(where d.ads>=coalesce($2,10))::int bonus_days
      from public.wiener_ad_league_events e
      left join daily d on d.telegram_id=e.telegram_id and d.event_day=e.event_day
      join public.users u on u.telegram_id=e.telegram_id
      where e.week_start=$1 and coalesce(u.is_banned,false)=false
      group by e.telegram_id
    ), scored as (
      select telegram_id,valid_ads,least(bonus_days,7)::int bonus_days,
        (valid_ads + least(bonus_days,7)*coalesce($3,5) + case when bonus_days>=7 then coalesce($4,25) else 0 end)::int points
      from agg
    ) select telegram_id,valid_ads,bonus_days,points,row_number() over(order by points desc,valid_ads desc,telegram_id asc)::int rank from scored order by rank asc limit 30`,[prev.week_start,Number(l.daily_target||10),Number(l.daily_bonus||5),Number(l.streak_bonus||25)]);
    for(const r of ranked.rows){
      const prize=adLeaguePrizeV86(Number(r.rank));
      if(prize<=0)continue;
      const ins=await c.query(`insert into public.wiener_ad_league_rewards(week_start,telegram_id,rank,points,prize,status,credited_at)
        values($1,$2,$3,$4,$5,'credited',now()) on conflict(week_start,telegram_id) do nothing returning telegram_id`,[prev.week_start,r.telegram_id,r.rank,r.points,prize]);
      if(ins.rows.length)await c.query(`update public.users set balance=coalesce(balance,0)+$2,total_earned=coalesce(total_earned,0)+$2 where telegram_id=$1`,[r.telegram_id,prize]);
    }
    await c.query(`update public.wiener_ad_leagues set status='completed',finalized_at=now() where week_start=$1`,[prev.week_start]);
    await c.query('commit');
  }catch(e){await c.query('rollback');throw e}finally{c.release()}
}
async function adLeagueStatusV86(uid){
  await finalizePreviousAdLeagueV86();
  const week=await ensureAdLeagueV86();
  const league=(await pool.query(`select * from public.wiener_ad_leagues where week_start=$1`,[week])).rows[0];
  const q=await pool.query(`with daily as (
      select telegram_id,event_day,count(*)::int ads from public.wiener_ad_league_events where week_start=$1 group by telegram_id,event_day
    ), agg as (
      select e.telegram_id,count(*)::int valid_ads,
        count(distinct d.event_day) filter(where d.ads>=coalesce($2,10))::int bonus_days
      from public.wiener_ad_league_events e
      left join daily d on d.telegram_id=e.telegram_id and d.event_day=e.event_day
      join public.users u on u.telegram_id=e.telegram_id
      where e.week_start=$1 and coalesce(u.is_banned,false)=false
      group by e.telegram_id
    ), scored as (
      select telegram_id,valid_ads,least(bonus_days,7)::int bonus_days,
        (valid_ads + least(bonus_days,7)*coalesce($3,5) + case when bonus_days>=7 then coalesce($4,25) else 0 end)::int points
      from agg
    ), ranked as (
      select s.*,row_number() over(order by points desc,valid_ads desc,telegram_id asc)::int rank from scored s
    ) select r.rank,r.telegram_id,r.valid_ads,r.bonus_days,r.points,u.username,u.first_name,u.photo_url
      from ranked r join public.users u on u.telegram_id=r.telegram_id order by r.rank asc limit 30`,[week,Number(league?.daily_target||10),Number(league?.daily_bonus||5),Number(league?.streak_bonus||25)]);
  const me=(await pool.query(`with daily as (
      select telegram_id,event_day,count(*)::int ads from public.wiener_ad_league_events where week_start=$1 group by telegram_id,event_day
    ), agg as (
      select e.telegram_id,count(*)::int valid_ads,count(distinct d.event_day) filter(where d.ads>=coalesce($2,10))::int bonus_days
      from public.wiener_ad_league_events e left join daily d on d.telegram_id=e.telegram_id and d.event_day=e.event_day
      join public.users u on u.telegram_id=e.telegram_id where e.week_start=$1 and coalesce(u.is_banned,false)=false group by e.telegram_id
    ), scored as (
      select telegram_id,valid_ads,least(bonus_days,7)::int bonus_days,
      (valid_ads + least(bonus_days,7)*coalesce($3,5) + case when bonus_days>=7 then coalesce($4,25) else 0 end)::int points from agg
    ), ranked as (select s.*,row_number() over(order by points desc,valid_ads desc,telegram_id asc)::int rank from scored s)
    select * from ranked where telegram_id=$5 limit 1`,[week,Number(league?.daily_target||10),Number(league?.daily_bonus||5),Number(league?.streak_bonus||25),uid])).rows[0]||null;
  const today=(await pool.query(`select count(*)::int c from public.wiener_ad_league_events where week_start=$1 and telegram_id=$2 and event_day=(now() at time zone 'utc')::date`,[week,uid])).rows[0]?.c||0;
  const top=q.rows.map(r=>({...r,prize:adLeaguePrizeV86(Number(r.rank))}));
  return {week_start:week,week_end:league?.week_end,enabled:league?.enabled!==false,prize_pool:Number(league?.prize_pool||50000),daily_target:Number(league?.daily_target||10),daily_bonus:Number(league?.daily_bonus||5),streak_bonus:Number(league?.streak_bonus||25),today_ads:Number(today),me:me?{...me,prize:adLeaguePrizeV86(Number(me.rank))}:{rank:null,valid_ads:0,bonus_days:0,points:0,prize:0},top};
}
app.post('/functions/v1/wiener-ad-league',async(req,res)=>{
  try{
    const b=req.body||{}, {id}=await edgeUser(b),action=String(b.action||'status');
    if(action==='status')return res.json({ok:true,data:await adLeagueStatusV86(id)});
    if(action==='history'){
      const rows=(await pool.query(`select r.week_start,r.rank,r.points,r.prize,r.status,r.credited_at from public.wiener_ad_league_rewards r where r.telegram_id=$1 order by r.week_start desc limit 12`,[id])).rows;
      return res.json({ok:true,data:rows});
    }
    throw new Error('unsupported_action');
  }catch(e){return edgeFail(res,e)}
});
'''

s=s.replace(marker,code+marker,1)
p.write_text(s)
print('V86 backend route installed: /functions/v1/wiener-ad-league')
