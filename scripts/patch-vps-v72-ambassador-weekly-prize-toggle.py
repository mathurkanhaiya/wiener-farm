from pathlib import Path
import os,re

backend=Path(os.environ.get('WIENER_BACKEND_FILE','/opt/wiener-backend/server.mjs'))
if not backend.exists():
    alt=Path('/opt/wiener-backend/server.js')
    if alt.exists(): backend=alt
frontend=Path('/opt/wiener-code/src/Ambassador.tsx')
if not backend.exists(): raise SystemExit('ERROR: live Wiener backend not found')
if not frontend.exists(): raise SystemExit('ERROR: Ambassador.tsx not found')

s=backend.read_text()
MARK='WIENER AMBASSADOR WEEKLY PRIZE TOGGLE V72'

# Allow admin to persist the toggle through the existing ambassador admin_settings action.
old_allowed="const allowed=['enabled','min_subscribers','commission_per_valid_claim_usdt','min_withdraw_usdt','weekly_prize_pool_usdt','subscriber_grace_days'];"
new_allowed="const allowed=['enabled','min_subscribers','commission_per_valid_claim_usdt','min_withdraw_usdt','weekly_prize_pool_usdt','weekly_prizes_enabled','subscriber_grace_days'];"
if old_allowed in s:
    s=s.replace(old_allowed,new_allowed,1)
elif new_allowed not in s:
    raise SystemExit('ERROR: ambassador admin_settings allowlist anchor not found')

# Replace the board route so rankings continue while settlement/prize exposure stop when disabled.
start=s.find("app.post('/functions/v1/wiener-ambassador-board',async(req,res)=>{")
end_anchor="\n\napp.post('/functions/v1/wiener-ambassador-check-all'"
end=s.find(end_anchor,start)
if start<0 or end<0:
    raise SystemExit('ERROR: ambassador board route anchor not found')
new_route=r'''app.post('/functions/v1/wiener-ambassador-board',async(req,res)=>{try{
  const b=req.body||{}, {id}=await edgeUser(b);
  const c=await ambassadorCfgV4();
  const prizesEnabled=c.weekly_prizes_enabled!==false;
  if(prizesEnabled) await rpc('settle_ambassador_weekly_rounds',[]).catch(()=>null);
  const start=c.weekly_round_start_at||new Date().toISOString(),end=c.weekly_round_end_at||new Date(Date.now()+7*86400000).toISOString();
  const q=await pool.query(`select a.id,a.telegram_id,a.channel_username,a.channel_title,u.username,u.first_name,u.last_name,count(ac.id)::int claims,max(ac.created_at) reached_at from public.ambassadors a join public.users u on u.telegram_id=a.telegram_id left join public.ambassador_commissions ac on ac.ambassador_id=a.id and ac.status='credited' and ac.created_at between $1 and $2 where a.status in ('active','approved') group by a.id,u.username,u.first_name,u.last_name order by claims desc,reached_at asc nulls last limit 25`,[start,end]);
  const min=num(c.weekly_min_valid_claims||5);
  const configured=[num(c.weekly_rank_1_usdt),num(c.weekly_rank_2_usdt),num(c.weekly_rank_3_usdt)];
  const prizes=prizesEnabled?configured:[0,0,0];
  const leaderboard=q.rows.map((x,i)=>({...x,rank:i+1,eligible:num(x.claims)>=min,prize_usdt:prizesEnabled&&i<3&&num(x.claims)>=min?prizes[i]:0,user:x.username?'@'+x.username:[x.first_name,x.last_name].filter(Boolean).join(' ')||`UID ${x.telegram_id}`}));
  const me=leaderboard.find(x=>num(x.telegram_id)===id);
  return res.json({ok:true,data:{weekly_prizes_enabled:prizesEnabled,weekly_prize_pool_usdt:prizesEnabled?num(c.weekly_prize_pool_usdt):0,configured_weekly_prize_pool_usdt:num(c.weekly_prize_pool_usdt),weekly_min_valid_claims:min,prizes_usdt:prizes,configured_prizes_usdt:configured,round_start_at:start,round_end_at:end,leaderboard,my_rank:me?.rank||null,my_claims:num(me?.claims),my_eligible:!!me?.eligible,history:[]}})
}catch(e){return edgeFail(res,e)}});'''
s=s[:start]+new_route+s[end:]

if MARK not in s:
    insert="async function ambassadorAdminV4(id){"
    if insert not in s: raise SystemExit('ERROR: ambassador helper anchor not found')
    s=s.replace(insert,"// === "+MARK+" ===\n// Prize toggle intentionally does not disable leaderboard tracking or claim counting.\n// When OFF, weekly settlement is not invoked from the board route and exposed prize values are zero.\n// === END "+MARK+" ===\n"+insert,1)

backend.write_text(s)

f=frontend.read_text()
# Board response shape.
f=f.replace(
"type Board={weekly_prize_pool_usdt:number;round_start_at:string;round_end_at:string;leaderboard:any[];my_rank:number|null;my_claims:number};",
"type Board={weekly_prizes_enabled?:boolean;weekly_prize_pool_usdt:number;configured_weekly_prize_pool_usdt?:number;round_start_at:string;round_end_at:string;leaderboard:any[];my_rank:number|null;my_claims:number};"
)
old="const league=board?.leaderboard||o?.leaderboard||[],prize=board?.weekly_prize_pool_usdt??c?.weekly_prize_pool_usdt??2.5,roundEnd=board?.round_end_at||c?.weekly_round_end_at;"
new="const league=board?.leaderboard||o?.leaderboard||[],prizesEnabled=(board?.weekly_prizes_enabled??c?.weekly_prizes_enabled)!==false,prize=prizesEnabled?(board?.weekly_prize_pool_usdt??c?.weekly_prize_pool_usdt??2.5):0,roundEnd=board?.round_end_at||c?.weekly_round_end_at;"
if old in f: f=f.replace(old,new,1)
elif new not in f: raise SystemExit('ERROR: Ambassador league state anchor not found')

f=f.replace("<span>🏆 ${usd(prize,2)} weekly pool</span>","<span>{prizesEnabled?`🏆 $${usd(prize,2)} weekly pool`:'🏆 Weekly leaderboard active'}</span>",1)

old_league='<p className="amb-money-inline"><UsdtIcon size={16}/><b>${usd(prize,2)} USDT</b> prize pool · ends Sunday</p>'
new_league='<p className="amb-money-inline">{prizesEnabled?<><UsdtIcon size={16}/><b>${usd(prize,2)} USDT</b> prize pool · ends Sunday</>:<><b>Leaderboard active</b> · weekly prizes paused</>}</p>'
if old_league in f: f=f.replace(old_league,new_league,1)

old_prizes='<div className="amb-prizes"><div><RankIcon rank={1} size={28}/><span>1st Prize</span><b><UsdtIcon size={14}/>$1.25</b></div><div><RankIcon rank={2} size={28}/><span>2nd Prize</span><b><UsdtIcon size={14}/>$0.75</b></div><div><RankIcon rank={3} size={28}/><span>3rd Prize</span><b><UsdtIcon size={14}/>$0.50</b></div></div>'
new_prizes='{prizesEnabled?<div className="amb-prizes"><div><RankIcon rank={1} size={28}/><span>1st Prize</span><b><UsdtIcon size={14}/>$1.25</b></div><div><RankIcon rank={2} size={28}/><span>2nd Prize</span><b><UsdtIcon size={14}/>$0.75</b></div><div><RankIcon rank={3} size={28}/><span>3rd Prize</span><b><UsdtIcon size={14}/>$0.50</b></div></div>:<div className="amb-alert"><b>Weekly prizes are paused</b><p>Leaderboard, ranks and valid-claim tracking continue normally.</p></div>}'
if old_prizes in f: f=f.replace(old_prizes,new_prizes,1)
elif 'Weekly prizes are paused' not in f: raise SystemExit('ERROR: Ambassador prize cards anchor not found')

admin_anchor='<div className="amb-publisher">'
admin_toggle='''<div className="amb-publisher"><div className="amb-publish-head"><div><h4>Weekly League Prizes</h4><p>Turn off prizes without disabling rankings, claim counts or the leaderboard.</p></div><span className={`amb-pill ${data?.settings?.weekly_prizes_enabled!==false?'good':''}`}>{data?.settings?.weekly_prizes_enabled!==false?'ON':'OFF'}</span></div><button className={data?.settings?.weekly_prizes_enabled!==false?'secondary':'primary'} disabled={busy} onClick={()=>action(()=>ambassadorApi('admin_settings',{weekly_prizes_enabled:data?.settings?.weekly_prizes_enabled===false} ),data?.settings?.weekly_prizes_enabled===false?'Weekly League prizes enabled':'Weekly League prizes disabled')}>{data?.settings?.weekly_prizes_enabled!==false?'TURN WEEKLY PRIZES OFF':'TURN WEEKLY PRIZES ON'}</button><div className="tiny center">Leaderboard always stays active. Disabled weeks are not paid from the leaderboard route.</div></div>\n    <div className="amb-publisher">'''
if 'TURN WEEKLY PRIZES OFF' not in f:
    if admin_anchor not in f: raise SystemExit('ERROR: Ambassador admin publisher anchor not found')
    f=f.replace(admin_anchor,admin_toggle,1)

frontend.write_text(f)
print('V72 installed: Ambassador weekly prize ON/OFF toggle added; leaderboard stays active')
