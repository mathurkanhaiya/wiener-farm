#!/usr/bin/env bash
set -euo pipefail

cd /opt/wiener-code
DB=wiener_farm_final
BACKEND=/opt/wiener-backend/server.mjs
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${BACKEND}.bak-v69-${STAMP}"

echo '=== V69 SPIN & EARN DAILY REPORT SAFE INSTALL ==='
[[ -f "$BACKEND" ]] || { echo 'ERROR: backend server.mjs not found' >&2; exit 1; }
node --check "$BACKEND"

grep -q 'WIENER SPIN EARN V48' "$BACKEND" || { echo 'ERROR: Spin & Earn V48 is not installed.' >&2; exit 1; }

ACTIVE_BC="$(runuser -u postgres -- psql -d "$DB" -Atqc "select count(*) from public.admin_broadcast_sessions where step='media_sending'" 2>/dev/null || echo 0)"
if [[ "${ACTIVE_BC:-0}" != "0" ]]; then
  echo 'ERROR: active media broadcast detected; wait for it to finish before installing V69.' >&2
  exit 1
fi

cp -a "$BACKEND" "$BACKUP"
rollback(){
  echo 'ERROR: V69 install failed; restoring backend backup.' >&2
  cp -a "$BACKUP" "$BACKEND"
  node --check "$BACKEND" >/dev/null 2>&1 && pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
}
trap rollback ERR

cat >/tmp/patch-v69-spin-daily-report.py <<'PY'
from pathlib import Path
import re

p=Path('/opt/wiener-backend/server.mjs')
s=p.read_text()
TAG='WIENER SPIN DAILY REPORT V69'
if TAG in s:
    print('V69 already installed')
    raise SystemExit(0)

# Disable only an old scheduled Treasury statistics-report function if one is present.
# Treasury gameplay, deposits, payouts and admin treasury tools are intentionally untouched.
def disable_treasury_report_function(src):
    needles=['WIENER Treasury — Daily Report','WIENER Treasury - Daily Report','Yesterday\'s Top WIENER Winners']
    positions=[src.find(n) for n in needles if src.find(n)>=0]
    if not positions:
        return src, []
    disabled=[]
    for pos in sorted(positions, reverse=True):
        # Find nearest async/function declaration before the report text.
        start=max(src.rfind('async function ',0,pos),src.rfind('function ',0,pos))
        if start<0: continue
        m=re.match(r'(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\([^)]*\)\s*\{',src[start:])
        if not m: continue
        name=m.group(1)
        brace=start+m.end()-1
        depth=0; quote=None; esc=False; end=None
        for i in range(brace,len(src)):
            ch=src[i]
            if quote:
                if esc: esc=False
                elif ch=='\\': esc=True
                elif ch==quote: quote=None
                continue
            if ch in ('\"',"'",'`'):
                quote=ch; continue
            if ch=='{': depth+=1
            elif ch=='}':
                depth-=1
                if depth==0:
                    end=i+1; break
        if not end: continue
        old=src[start:end]
        if not any(n in old for n in needles): continue
        repl=f"async function {name}(..._args){{/* V69: legacy Treasury daily stats report disabled; Treasury itself remains unchanged. */return false}}"
        src=src[:start]+repl+src[end:]
        disabled.append(name)
    return src,disabled

s,disabled=disable_treasury_report_function(s)
print('Legacy Treasury daily report functions disabled:', ', '.join(disabled) if disabled else 'none found in backend source')

marker="\napp.use((_req,res)=>\n  res.status(404).json({ok:false,error:'route_not_enabled_yet'})\n);\n"
if marker not in s:
    raise SystemExit('ERROR: final route marker not found')

code=r'''

// === WIENER SPIN DAILY REPORT V69 ===
const SPIN_REPORT_TZ_V69='Asia/Kolkata';
const SPIN_REPORT_CHANNEL_V69='@WienerFarm';
let spinDailyReportBusyV69=false;

function spinReportNumV69(v,max=2){
  const n=Number(v||0);if(!Number.isFinite(n))return '0';
  return n.toLocaleString('en-US',{maximumFractionDigits:max,minimumFractionDigits:0});
}
function spinReportTonV69(v){
  const n=Number(v||0);if(!Number.isFinite(n)||n===0)return '0';
  return n.toFixed(9).replace(/0+$/,'').replace(/\.$/,'');
}
function spinReportUserV69(r){
  if(r?.username)return '@'+String(r.username).replace(/^@/,'');
  const name=String(r?.first_name||'').trim();
  return name||`UID ${Number(r?.telegram_id||0)}`;
}
function spinReportDateLabelV69(v){
  const d=new Date(String(v)+'T00:00:00+05:30');
  return new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:SPIN_REPORT_TZ_V69}).format(d);
}
async function spinReportTgV69(text){
  const payload={chat_id:SPIN_REPORT_CHANNEL_V69,text,disable_web_page_preview:true,reply_markup:{inline_keyboard:[[{text:'🎡 OPEN SPIN & EARN',url:'https://t.me/WienerDogeFarmBot/app'}]]}};
  const r=await fetch(`https://api.telegram.org/bot${BOT}/sendMessage`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
  const x=await r.json().catch(()=>({ok:false,description:'telegram_error'}));
  if(!x.ok)throw new Error(x.description||'telegram_error');
  return x.result;
}
async function spinReportDateV69(){
  return String((await pool.query(`select ((now() at time zone 'Asia/Kolkata')::date-1)::text d`)).rows[0]?.d||'');
}
async function spinBuildDailyReportV69(reportDate){
  const [all,yday,topW,topT,bigT]=await Promise.all([
    pool.query(`select count(*)::int spins,count(distinct telegram_id)::int players,coalesce(sum(reward_amount) filter(where reward_type='wiener'),0)::float8 wiener,coalesce(sum(reward_amount) filter(where reward_type='ton'),0)::float8 ton from public.wiener_spin_events`),
    pool.query(`select count(*)::int spins,count(distinct telegram_id)::int players,coalesce(sum(reward_amount) filter(where reward_type='wiener'),0)::float8 wiener,coalesce(sum(reward_amount) filter(where reward_type='ton'),0)::float8 ton from public.wiener_spin_events where (created_at at time zone 'Asia/Kolkata')::date=$1::date`,[reportDate]),
    pool.query(`select e.telegram_id,u.username,u.first_name,sum(e.reward_amount)::float8 amount from public.wiener_spin_events e left join public.users u on u.telegram_id=e.telegram_id where e.reward_type='wiener' and (e.created_at at time zone 'Asia/Kolkata')::date=$1::date group by e.telegram_id,u.username,u.first_name order by amount desc,e.telegram_id asc limit 3`,[reportDate]),
    pool.query(`select e.telegram_id,u.username,u.first_name,sum(e.reward_amount)::float8 amount from public.wiener_spin_events e left join public.users u on u.telegram_id=e.telegram_id where e.reward_type='ton' and (e.created_at at time zone 'Asia/Kolkata')::date=$1::date group by e.telegram_id,u.username,u.first_name order by amount desc,e.telegram_id asc limit 3`,[reportDate]),
    pool.query(`select e.telegram_id,u.username,u.first_name,e.reward_amount::float8 amount from public.wiener_spin_events e left join public.users u on u.telegram_id=e.telegram_id where e.reward_type='ton' and (e.created_at at time zone 'Asia/Kolkata')::date=$1::date order by e.reward_amount desc,e.created_at asc limit 1`,[reportDate])
  ]);
  const a=all.rows[0]||{},y=yday.rows[0]||{};
  const medals=['🥇','🥈','🥉'];
  const wLines=topW.rows.length?topW.rows.map((r,i)=>`  ${medals[i]} ${spinReportUserV69(r)} — ${spinReportNumV69(r.amount,2)} WIENER`).join('\n'):'  No Spin & Earn winners yesterday';
  const tLines=topT.rows.length?topT.rows.map((r,i)=>`  ${medals[i]} ${spinReportUserV69(r)} — ${spinReportTonV69(r.amount)} TON`).join('\n'):'  No TON winners yesterday';
  const biggest=bigT.rows[0]?`  ${spinReportUserV69(bigT.rows[0])} — ${spinReportTonV69(bigT.rows[0].amount)} TON`:'  No TON wins yesterday';
  const text=`🎡 WIENER Spin & Earn — Daily Report\n${spinReportDateLabelV69(reportDate)}\n\n📊 All-Time Stats\n  👥 ${spinReportNumV69(a.players,0)} players used Spin & Earn\n  🎡 ${spinReportNumV69(a.spins,0)} total spins\n  🌭 ${spinReportNumV69(a.wiener,2)} WIENER won\n  💎 ${spinReportTonV69(a.ton)} TON won\n\n🔥 Yesterday\n  🎡 ${spinReportNumV69(y.spins,0)} spins by ${spinReportNumV69(y.players,0)} players\n  🌭 ${spinReportNumV69(y.wiener,2)} WIENER given away\n  💎 ${spinReportTonV69(y.ton)} TON given away\n\n🏆 Top WIENER Winners Yesterday\n${wLines}\n\n💎 Top TON Winners Yesterday\n${tLines}\n\n🎯 Biggest Single TON Win\n${biggest}\n\n🚀 Your next spin could be the lucky one — open WIENER Farm and Spin & Earn! 👇`;
  return{text,stats:{all:{players:Number(a.players||0),spins:Number(a.spins||0),wiener:Number(a.wiener||0),ton:Number(a.ton||0)},yesterday:{players:Number(y.players||0),spins:Number(y.spins||0),wiener:Number(y.wiener||0),ton:Number(y.ton||0)}}};
}
async function sendSpinDailyReportV69(force=false){
  if(spinDailyReportBusyV69)return{ok:false,reason:'busy'};
  spinDailyReportBusyV69=true;
  try{
    const reportDate=await spinReportDateV69();
    if(!reportDate)return{ok:false,reason:'date_unavailable'};
    const old=(await pool.query(`select sent_at,message_id from public.wiener_spin_daily_reports where report_date=$1::date limit 1`,[reportDate])).rows[0];
    if(old?.sent_at&&!force)return{ok:true,skipped:true,report_date:reportDate,message_id:old.message_id};
    if(old?.sent_at&&force)return{ok:true,skipped:true,reason:'already_sent',report_date:reportDate,message_id:old.message_id};
    const built=await spinBuildDailyReportV69(reportDate);
    const msg=await spinReportTgV69(built.text);
    await pool.query(`insert into public.wiener_spin_daily_reports(report_date,channel_id,message_id,stats,sent_at,last_error,updated_at) values($1::date,$2,$3,$4::jsonb,now(),null,now()) on conflict(report_date) do update set channel_id=excluded.channel_id,message_id=excluded.message_id,stats=excluded.stats,sent_at=excluded.sent_at,last_error=null,updated_at=now()`,[reportDate,SPIN_REPORT_CHANNEL_V69,Number(msg?.message_id||0),JSON.stringify(built.stats)]);
    console.log('spin_daily_report_v69_sent',reportDate,Number(msg?.message_id||0));
    return{ok:true,report_date:reportDate,message_id:Number(msg?.message_id||0)};
  }catch(e){
    console.error('spin_daily_report_v69',String(e?.message||e));
    try{const d=await spinReportDateV69();if(d)await pool.query(`insert into public.wiener_spin_daily_reports(report_date,channel_id,last_error,updated_at) values($1::date,$2,$3,now()) on conflict(report_date) do update set last_error=excluded.last_error,updated_at=now()`,[d,SPIN_REPORT_CHANNEL_V69,String(e?.message||e).slice(0,500)])}catch{}
    return{ok:false,error:String(e?.message||e)};
  }finally{spinDailyReportBusyV69=false}
}
async function spinDailyScheduleTickV69(){
  try{
    const q=(await pool.query(`select extract(hour from now() at time zone 'Asia/Kolkata')::int h,extract(minute from now() at time zone 'Asia/Kolkata')::int m`)).rows[0]||{};
    const mins=Number(q.h||0)*60+Number(q.m||0);
    if(mins>=390)await sendSpinDailyReportV69(false); // 06:30 IST or later; idempotent once per report date.
  }catch(e){console.error('spin_daily_schedule_v69',String(e?.message||e))}
}
setTimeout(()=>void sendSpinDailyReportV69(false),7000); // Sends yesterday immediately after first install/restart if not already sent.
setTimeout(()=>void spinDailyScheduleTickV69(),12000);
setInterval(()=>void spinDailyScheduleTickV69(),60000);

app.post('/functions/v1/wiener-spin-daily-report-worker',async(req,res)=>{
  try{
    const incoming=String(req.headers['x-wiener-internal-secret']||''),want=String((await pool.query(`select telegram_webhook_secret from public.app_settings where id=true limit 1`)).rows[0]?.telegram_webhook_secret||'');
    if(!incoming||incoming!==want)return res.status(403).send('forbidden');
    const out=await sendSpinDailyReportV69(false);return res.json({ok:true,data:out});
  }catch{return res.status(500).json({ok:false,error:'spin_daily_report_worker_failed'})}
});
// === END WIENER SPIN DAILY REPORT V69 ===
'''

s=s.replace(marker,code+marker,1)
p.write_text(s)
print('Installed Spin & Earn daily report V69')
PY

python3 /tmp/patch-v69-spin-daily-report.py

echo '=== V69 DATABASE ==='
runuser -u postgres -- psql -d "$DB" -v ON_ERROR_STOP=1 <<'SQL'
create table if not exists public.wiener_spin_daily_reports(
  report_date date primary key,
  channel_id text not null default '@WienerFarm',
  message_id bigint,
  stats jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
revoke all on table public.wiener_spin_daily_reports from public;
SQL

node --check "$BACKEND"

echo '=== RESTART ==='
pm2 restart wiener-api --update-env
sleep 10
pm2 status wiener-api
curl -fsS http://127.0.0.1:3000/health || curl -fsS http://127.0.0.1:3000/healthz
printf '\n'

echo '=== REPORT STATUS ==='
runuser -u postgres -- psql -d "$DB" -P pager=off -c "select report_date,channel_id,message_id,sent_at,last_error,stats from public.wiener_spin_daily_reports order by report_date desc limit 3;"

pm2 save >/dev/null

echo '=== VERIFY ==='
grep -q 'WIENER SPIN DAILY REPORT V69' "$BACKEND"
echo 'channel=@WienerFarm'
echo 'schedule=06:30_IST_daily'
echo 'install_send_yesterday=enabled_idempotent'
echo 'top_wiener_winners=top3_grouped'
echo 'top_ton_winners=top3_grouped'
echo 'biggest_single_ton_win=enabled'
echo 'legacy_treasury_daily_stats_report=disabled_if_present'
echo 'treasury_gameplay_and_finance=unchanged'
echo '=== V69 READY ==='
trap - ERR
