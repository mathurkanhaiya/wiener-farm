#!/usr/bin/env python3
from pathlib import Path
import os

p=Path(os.environ.get('WIENER_BACKEND_FILE','/opt/wiener-backend/server.mjs'))
if not p.exists():
    alt=Path('/opt/wiener-backend/server.js')
    if alt.exists(): p=alt
if not p.exists(): raise SystemExit('ERROR: Wiener backend server file not found')
s=p.read_text()
TAG='WIENER REFERRAL COUNTRY REWARDS V98F'
if TAG in s:
    print('V98F referral accounting fix already installed')
    raise SystemExit(0)
if 'WIENER REFERRAL COUNTRY REWARDS V98' not in s:
    raise SystemExit('ERROR: V98 base referral patch is not installed')

old="""const stats=(await pool.query(`select count(*)::int invited,count(*) filter(where r.completion_rewarded_at is not null)::int qualified,count(*) filter(where r.referred_user_id is not null and r.completion_rewarded_at is null and r.status not in ('banned'))::int pending,coalesce(sum(l.amount_wiener),0)::float8 earned from public.users u left join public.referral_v2 r on r.referred_user_id=u.telegram_id left join public.referral_v2_ledger l on l.referred_user_id=u.telegram_id and l.inviter_user_id=$1 where u.referred_by=$1`,[id])).rows[0]||{};"""
new="""const stats=(await pool.query(`select
      (select count(*)::int from public.users u where u.referred_by=$1) invited,
      (select count(*)::int from public.referral_v2 r where r.inviter_user_id=$1 and r.completion_rewarded_at is not null) qualified,
      (select count(*)::int from public.referral_v2 r where r.inviter_user_id=$1 and r.completion_rewarded_at is null and r.status not in ('banned')) pending,
      (select coalesce(sum(l.amount_wiener),0)::float8 from public.referral_v2_ledger l where l.inviter_user_id=$1) earned`,[id])).rows[0]||{};"""
if old not in s:
    raise SystemExit('ERROR: V98 stats anchor not found')
s=s.replace(old,new,1)
end='// === END WIENER REFERRAL COUNTRY REWARDS V98 ==='
if end not in s: raise SystemExit('ERROR: V98 end marker not found')
s=s.replace(end,"// === WIENER REFERRAL COUNTRY REWARDS V98F ===\n// Count referrals independently from the two-stage reward ledger to avoid duplicated totals.\n"+end,1)
p.write_text(s)
print('V98F referral accounting fix installed')
