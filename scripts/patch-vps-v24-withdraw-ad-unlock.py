#!/usr/bin/env python3
from pathlib import Path
import sys

p=Path('/opt/wiener-backend/server.js')
s=p.read_text()
tag='// === WIENER WITHDRAW AD UNLOCK V24 ==='
if tag in s:
    print('V24 withdraw ad unlock already installed')
    sys.exit(0)

route="app.post('/functions/v1/wiener-ton-wallet'"
start=s.find(route)
if start<0:
    raise SystemExit('ERROR: wiener-ton-wallet route not found')

needle="if(a==='withdraw'){const amount=num(b.amount_wiener);"
pos=s.find(needle,start)
if pos<0:
    raise SystemExit('ERROR: TON withdraw action anchor not found')

insert=r"""// === WIENER WITHDRAW AD UNLOCK V24 ===
const withdrawAdCountV24=async(uid)=>Number((await pool.query(`select count(*)::int c from public.withdraw_ad_sessions where telegram_id=$1 and day=(now() at time zone 'utc')::date and counted=true`,[uid])).rows[0]?.c||0);
if(a==='withdraw_ad_status'){const count=await withdrawAdCountV24(id);return res.json({ok:true,data:{count,required:5,unlocked:count>=5,block_id:'int-44861'}})}
if(a==='withdraw_ad_start'){
 const count=await withdrawAdCountV24(id);
 if(count>=5)return res.json({ok:true,data:{count,required:5,unlocked:true,block_id:'int-44861'}});
 await pool.query(`update public.withdraw_ad_sessions set status='expired' where telegram_id=$1 and status='started' and started_at<now()-interval '5 minutes'`,[id]);
 const existing=(await pool.query(`select id,started_at from public.withdraw_ad_sessions where telegram_id=$1 and status='started' order by started_at desc limit 1`,[id])).rows[0];
 if(existing)return res.json({ok:true,data:{session_id:existing.id,count,required:5,unlocked:false,block_id:'int-44861',resume:true}});
 const q=await pool.query(`insert into public.withdraw_ad_sessions(telegram_id,day,block_id,status,counted) values($1,(now() at time zone 'utc')::date,'int-44861','started',false) returning id,started_at`,[id]);
 return res.json({ok:true,data:{session_id:q.rows[0].id,count,required:5,unlocked:false,block_id:'int-44861'}});
}
if(a==='withdraw_ad_credit'){
 const sid=String(b.session_id||'').trim();
 if(!sid)throw new Error('withdraw_ad_session_required');
 let row=(await pool.query(`select id,telegram_id,status,counted,started_at,day from public.withdraw_ad_sessions where id=$1 and telegram_id=$2 limit 1`,[sid,id])).rows[0];
 if(!row)throw new Error('withdraw_ad_session_invalid');
 if(row.counted===true||row.status==='counted'){const count=await withdrawAdCountV24(id);return res.json({ok:true,data:{count,required:5,unlocked:count>=5,already_counted:true}})}
 const elapsed=Date.now()-new Date(row.started_at).getTime();
 if(elapsed<14000)throw new Error('watch_full_withdraw_ad');
 const before=await withdrawAdCountV24(id);
 if(before>=5){await pool.query(`update public.withdraw_ad_sessions set status='limit_reached' where id=$1 and telegram_id=$2`,[sid,id]);return res.json({ok:true,data:{count:before,required:5,unlocked:true}})}
 const done=(await pool.query(`update public.withdraw_ad_sessions set counted=true,status='counted',completed_at=now() where id=$1 and telegram_id=$2 and counted=false and status='started' and day=(now() at time zone 'utc')::date returning id`,[sid,id])).rows[0];
 if(!done)throw new Error('withdraw_ad_session_expired');
 const count=await withdrawAdCountV24(id);
 return res.json({ok:true,data:{count,required:5,unlocked:count>=5}});
}
"""
guard="if(a==='withdraw'){const withdrawAdCount=await withdrawAdCountV24(id);if(withdrawAdCount<5)throw new Error(`withdraw_ads_required_${withdrawAdCount}_of_5`);const amount=num(b.amount_wiener);"

s=s[:pos]+insert+guard+s[pos+len(needle):]
p.write_text(s)
print('Installed WIENER withdraw ad unlock V24')
