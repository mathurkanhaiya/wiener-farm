#!/usr/bin/env python3
from pathlib import Path
import os

p=Path(os.environ.get('WIENER_BACKEND_FILE','/opt/wiener-backend/server.mjs'))
if not p.exists():
    q=Path('/opt/wiener-backend/server.js')
    if q.exists(): p=q
s=p.read_text()
TAG='WIENER SPIN DAY FIX V52'
if TAG in s:
    print('V52 spin_day fix already installed')
    raise SystemExit(0)
if 'WIENER SPIN EARN V48' not in s:
    raise SystemExit('ERROR: Spin & Earn V48 route is not installed')

# V48 accidentally assigned spin_day twice in the same UPDATE used by ad_complete and spin.
# PostgreSQL rejects that with: multiple assignments to same column "spin_day".
old="set spin_day=current_date,free_used=case when spin_day=current_date then free_used else 0 end,ad_used=case when spin_day=current_date then ad_used else 0 end,spin_day=current_date where telegram_id=$1"
new="set free_used=case when spin_day=current_date then free_used else 0 end,ad_used=case when spin_day=current_date then ad_used else 0 end,spin_day=current_date where telegram_id=$1"
s=s.replace(old,new)

# Same repair for V51 form with separate ad credits.
old2="set spin_day=current_date,free_used=case when spin_day=current_date then free_used else 0 end,ad_used=case when spin_day=current_date then ad_used else 0 end,ad_spin_credits=case when spin_day=current_date then ad_spin_credits else 0 end,spin_day=current_date where telegram_id=$1"
new2="set free_used=case when spin_day=current_date then free_used else 0 end,ad_used=case when spin_day=current_date then ad_used else 0 end,ad_spin_credits=case when spin_day=current_date then ad_spin_credits else 0 end,spin_day=current_date where telegram_id=$1"
s=s.replace(old2,new2)

# Guard against any remaining duplicate assignment in Spinner state normalization.
needle="spin_day=current_date,free_used=case when spin_day=current_date then free_used else 0 end"
if needle in s:
    raise SystemExit('ERROR: duplicate spin_day assignment pattern still present')

s=s.replace('// === WIENER SPIN EARN V48 ===','// === WIENER SPIN EARN V48 ===\n// === WIENER SPIN DAY FIX V52 ===',1)
p.write_text(s)
print('V52 duplicate spin_day assignment fix applied to',p)
