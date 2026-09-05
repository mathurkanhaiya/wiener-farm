from pathlib import Path
import os

p=Path(os.environ.get("WIENER_BACKEND_FILE","/opt/wiener-backend/server.mjs"))
if not p.exists():
    p=Path("/opt/wiener-backend/server.js")
s=p.read_text()
TAG="WIENER GROUP GAMES V33B BALANCE AFTER"
if TAG in s:
    print("V33B already installed")
    raise SystemExit(0)
if "WIENER GROUP GAMES V33" not in s:
    raise SystemExit("ERROR: V33 group games not installed")

old_stake='''async function gameStake33(c,uid,amount,mid){
  const q=await c.query("update public.users set balance=balance-$2 where telegram_id=$1 and balance>=$2 and coalesce(is_banned,false)=false and coalesce(device_blocked,false)=false returning balance",[uid,amount]);
  if(!q.rows[0])throw new Error("insufficient_wiener_balance");
  await c.query("insert into public.transactions(telegram_id,amount,kind,description,metadata) values($1,$2,'game_stake','WIENER game stake',$3::jsonb)",[uid,-amount,JSON.stringify({match_id:mid})]);
  return gameN33(q.rows[0].balance)
}'''
new_stake='''async function gameStake33(c,uid,amount,mid){
  const q=await c.query("update public.users set balance=balance-$2 where telegram_id=$1 and balance>=$2 and coalesce(is_banned,false)=false and coalesce(device_blocked,false)=false returning balance",[uid,amount]);
  if(!q.rows[0])throw new Error("insufficient_wiener_balance");
  const bal=gameN33(q.rows[0].balance);
  await c.query("insert into public.transactions(telegram_id,amount,balance_after,kind,description,metadata) values($1,$2,$3,'game_stake','WIENER game stake',$4::jsonb)",[uid,-amount,bal,JSON.stringify({match_id:mid})]);
  return bal
}'''

old_credit='''async function gameCredit33(c,uid,amount,profit,mid,kind,desc){
  await c.query("update public.users set balance=balance+$2,total_earned=total_earned+$3 where telegram_id=$1",[uid,gameR33(amount),Math.max(0,gameR33(profit))]);
  await c.query("insert into public.transactions(telegram_id,amount,kind,description,metadata) values($1,$2,$3,$4,$5::jsonb)",[uid,gameR33(amount),kind,desc,JSON.stringify({match_id:mid})])
}'''
new_credit='''async function gameCredit33(c,uid,amount,profit,mid,kind,desc){
  const q=await c.query("update public.users set balance=balance+$2,total_earned=total_earned+$3 where telegram_id=$1 returning balance",[uid,gameR33(amount),Math.max(0,gameR33(profit))]);
  if(!q.rows[0])throw new Error("user_not_found");
  const bal=gameN33(q.rows[0].balance);
  await c.query("insert into public.transactions(telegram_id,amount,balance_after,kind,description,metadata) values($1,$2,$3,$4,$5,$6::jsonb)",[uid,gameR33(amount),bal,kind,desc,JSON.stringify({match_id:mid})])
}'''

if old_stake not in s:
    raise SystemExit("ERROR: gameStake33 old block not found")
if old_credit not in s:
    raise SystemExit("ERROR: gameCredit33 old block not found")

s=s.replace(old_stake,new_stake,1)
s=s.replace(old_credit,new_credit,1)
s=s.replace("// === END WIENER GROUP GAMES V33 ===","// === WIENER GROUP GAMES V33B BALANCE AFTER ===\n// Transaction rows now store the required post-transaction balance.\n// === END WIENER GROUP GAMES V33B BALANCE AFTER ===\n// === END WIENER GROUP GAMES V33 ===",1)

p.write_text(s)
print("V33B installed: game stake/refund/payout transactions now set balance_after")
