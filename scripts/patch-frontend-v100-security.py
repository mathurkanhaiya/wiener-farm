#!/usr/bin/env python3
from pathlib import Path

# Spin: server issues the authorization token; browser no longer creates idempotency authorization.
p=Path('src/SpinEarn.tsx'); s=p.read_text()
old="const key=crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`;const x:Prize=await spinApi('spin',{idempotency_key:key});"
new="const auth=await spinApi('spin_start');const token=String(auth?.spin_token||'');if(!token)throw new Error('Spin authorization failed');const x:Prize=await spinApi('spin',{spin_token:token});"
if old in s:s=s.replace(old,new,1)
elif "spinApi('spin_start')" not in s:raise SystemExit('SpinEarn V100 anchor missing')
p.write_text(s)

# Main/bonus ad: interaction tracking remains only for League points; never send it as reward authority.
p=Path('src/AdsPage.tsx'); s=p.read_text()
s=s.replace("adApi('complete',{session_id:x.session_id,interacted:visited5s} as any)","adApi('complete',{session_id:x.session_id} as any)")
s=s.replace("secondaryAdApi('reward',{session_id:x.session_id,interacted:visited5s} as any)","secondaryAdApi('reward',{session_id:x.session_id} as any)")
p.write_text(s)

# Sponsored task callback can arrive milliseconds after the SDK reward event. Retry verification briefly;
# backend remains authoritative and never credits without callback_received_at.
p=Path('src/TasksPage.tsx'); s=p.read_text()
old="const x=await adsgramTaskApi('reward',{session_id:session.session_id});if(!active)return;sessionRef.current=null;"
new="let x:any=null,last:any=null;for(let i=0;i<8;i++){try{x=await adsgramTaskApi('reward',{session_id:session.session_id});break}catch(e:any){last=e;const m=String(e?.message||e);if(!/not_verified|not verified/i.test(m))throw e;await new Promise(r=>setTimeout(r,500))}}if(!x)throw last||new Error('Task verification pending');if(!active)return;sessionRef.current=null;"
if old in s:s=s.replace(old,new,1)
elif 'for(let i=0;i<8;i++)' not in s:raise SystemExit('TasksPage V100 anchor missing')
p.write_text(s)
print('V100 frontend patch applied')
