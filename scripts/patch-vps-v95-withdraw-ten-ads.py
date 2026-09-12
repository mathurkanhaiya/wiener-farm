#!/usr/bin/env python3
from pathlib import Path
import os, sys

p=Path(os.environ.get('WIENER_BACKEND_FILE','/opt/wiener-backend/server.js'))
s=p.read_text()
start=s.find('// === WIENER WITHDRAW AD UNLOCK V24 ===')
if start < 0:
    raise SystemExit('ERROR: V24 withdrawal ad gate marker not found')
end=s.find("if(a==='withdraw'){", start)
if end < 0:
    raise SystemExit('ERROR: withdrawal route after V24 marker not found')

section=s[start:end]
original=section
replacements={
    'required:5':'required:10',
    'count>=5':'count>=10',
    'before>=5':'before>=10',
}
for old,new in replacements.items():
    section=section.replace(old,new)

# Update the server-side withdrawal bypass guard immediately following V24.
guard_old="if(a==='withdraw'){const withdrawAdCount=await withdrawAdCountV24(id);if(withdrawAdCount<5){"
guard_new="if(a==='withdraw'){const withdrawAdCount=await withdrawAdCountV24(id);if(withdrawAdCount<10){"
if guard_old in s:
    s=s.replace(guard_old,guard_new,1)
elif guard_new not in s:
    raise SystemExit('ERROR: V24 withdrawal guard anchor not found')

s=s[:start]+section+s[end:]
s=s.replace('Withdrawal ads: ${withdrawAdCount}/5','Withdrawal ads: ${withdrawAdCount}/10',1)
s=s.replace('withdraw_ads_required_${withdrawAdCount}_of_5','withdraw_ads_required_${withdrawAdCount}_of_10',1)

# Validation: every API response and both enforcement guards must now use 10.
check=s[start:s.find('const amount=num(b.amount_wiener);',start)+len('const amount=num(b.amount_wiener);')]
required_tokens=['required:10','count>=10','before>=10','withdrawAdCount<10','/10','_of_10']
missing=[x for x in required_tokens if x not in check]
if missing:
    raise SystemExit('ERROR: V95 validation failed, missing: '+', '.join(missing))

# Make reruns idempotent; no write if already fully upgraded.
if s == p.read_text():
    print('V95 already installed: withdrawal requirement is 10 ads')
    sys.exit(0)

p.write_text(s)
print('Installed V95: withdrawal unlock requirement changed from 5 to 10 ads')
