#!/usr/bin/env python3
from pathlib import Path
import os
p=Path(os.environ.get('WIENER_BACKEND_FILE','/opt/wiener-backend/server.mjs'))
s=p.read_text()
TAG='WIENER LOTTERY STRICT 15S PLAYERS V115'
if TAG in s: print('V115 already installed'); raise SystemExit(0)
if 'WIENER LOTTERY BONUS ENTRIES V114' not in s: raise SystemExit('ERROR: V114 required')
s=s.replace("if(Date.now()-new Date(a.created_at).getTime()<2500)throw Error('Ad completed too quickly');","if(Date.now()-new Date(a.created_at).getTime()<15000)throw Error('Watch the full 15 second ad to earn an entry');",1)
anchor="// === END WIENER LOTTERY BONUS ENTRIES V114 ==="
code=r"""
// === WIENER LOTTERY STRICT 15S PLAYERS V115 ===
app.post('/functions/v1/wiener-lottery-players',async(req,res)=>{
 try{
  await lotterySetup();await lotteryBonusSetupV114();const b=req.body||{};await edgeUser(b);const r=await lotteryRoundV113();
  const rows=(await pool.query(`
   with paid as (select telegram_id,count(*)::int paid from public.wiener_lottery_tickets where round_id=$1 group by telegram_id),
   bonus as (select telegram_id,count(*)::int bonus from public.wiener_lottery_bonus_entries where round_id=$1 group by telegram_id),
   x as (select coalesce(p.telegram_id,b.telegram_id) telegram_id,coalesce(p.paid,0)::int paid,coalesce(b.bonus,0)::int bonus from paid p full join bonus b using(telegram_id)),
   totals as (select coalesce(sum(paid+bonus),0)::int total from x)
   select x.paid,x.bonus,(x.paid+x.bonus)::int entries,
    case when totals.total>0 then round(((x.paid+x.bonus)::numeric/totals.total::numeric)*100,2)::float8 else 0 end chance,
    coalesce(nullif(u.username,''),'Player '||right(u.telegram_id::text,4)) display_name
   from x join public.users u on u.telegram_id=x.telegram_id cross join totals
   order by entries desc,x.telegram_id asc limit 100`,[r.id])).rows;
  const totalBonus=Number((await pool.query(`select count(*)::int n from public.wiener_lottery_bonus_entries where round_id=$1`,[r.id])).rows[0]?.n||0);
  return res.json({ok:true,data:{players:rows,total_bonus:totalBonus,total_entries:Number(r.total_tickets||0)+totalBonus}});
 }catch(e){return edgeFail(res,e)}
});
// === END WIENER LOTTERY STRICT 15S PLAYERS V115 ===
"""
s=s.replace(anchor,anchor+'\n'+code,1)
p.write_text(s)
print('V115 installed: strict 15s Lottery ads + player chances')
