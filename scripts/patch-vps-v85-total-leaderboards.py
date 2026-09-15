#!/usr/bin/env python3
from pathlib import Path
import os

p=Path(os.environ.get('WIENER_BACKEND_FILE','/opt/wiener-backend/server.mjs'))
if not p.exists():
    alt=Path('/opt/wiener-backend/server.js')
    if alt.exists(): p=alt
if not p.exists(): raise SystemExit('ERROR: Wiener backend file not found')

s=p.read_text()
TAG='// === WIENER TOTAL LEADERBOARDS V85 ==='
if TAG in s:
    print('V85 total leaderboard fix already installed')
    raise SystemExit(0)

old="let lb=null;try{lb=await rpc('get_wiener_invite_leaderboards',[id])}catch{}"
if old not in s:
    raise SystemExit('ERROR: referral leaderboard RPC anchor not found; refusing unsafe patch')

anchor="// Referral status parity.\n"
if anchor not in s:
    raise SystemExit('ERROR: referral status route anchor not found')

helper=r'''// === WIENER TOTAL LEADERBOARDS V85 ===
// App leaderboard semantics:
// - Inviters: ALL invited users (users.referrals_count), not only active/qualified referrals.
// - Earners: lifetime WIENER earned (users.total_earned), not referral commission only.
async function totalLeaderboardsV85(uid){
  const base=`from public.users where coalesce(is_banned,false)=false`;
  const invSql=`with ranked as (
    select telegram_id,username,first_name,last_name,photo_url,
           coalesce(referrals_count,0)::numeric as value,
           row_number() over(order by coalesce(referrals_count,0) desc, telegram_id asc)::int as rank
    ${base}
  ) select * from ranked order by rank asc limit 50`;
  const earnSql=`with ranked as (
    select telegram_id,username,first_name,last_name,photo_url,
           coalesce(total_earned,0)::numeric as value,
           row_number() over(order by coalesce(total_earned,0) desc, telegram_id asc)::int as rank
    ${base}
  ) select * from ranked order by rank asc limit 50`;
  const meInvSql=`with ranked as (
    select telegram_id,coalesce(referrals_count,0)::numeric as value,
           row_number() over(order by coalesce(referrals_count,0) desc, telegram_id asc)::int as rank
    ${base}
  ) select rank,value from ranked where telegram_id=$1 limit 1`;
  const meEarnSql=`with ranked as (
    select telegram_id,coalesce(total_earned,0)::numeric as value,
           row_number() over(order by coalesce(total_earned,0) desc, telegram_id asc)::int as rank
    ${base}
  ) select rank,value from ranked where telegram_id=$1 limit 1`;
  const [inviters,earners,mi,me]=await Promise.all([
    pool.query(invSql),pool.query(earnSql),pool.query(meInvSql,[uid]),pool.query(meEarnSql,[uid])
  ]);
  return {
    inviters:inviters.rows,
    earners:earners.rows,
    me:{
      inviters:mi.rows[0]||{rank:null,value:0},
      earners:me.rows[0]||{rank:null,value:0}
    }
  };
}
'''

s=s.replace(anchor,helper+'\n'+anchor,1)
s=s.replace(old,"let lb=null;try{lb=await totalLeaderboardsV85(id)}catch(e){console.error('v85_total_leaderboard',String(e?.message||e))}",1)

p.write_text(s)
print('V85 installed: leaderboard now ranks total invited + lifetime total earned')
