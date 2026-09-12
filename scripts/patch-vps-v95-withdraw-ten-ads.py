#!/usr/bin/env python3
from pathlib import Path
import os, re, sys

p=Path(os.environ.get('WIENER_BACKEND_FILE','/opt/wiener-backend/server.js'))
original_text=p.read_text()
s=original_text
marker='// === WIENER WITHDRAW AD UNLOCK V24 ==='
start=s.find(marker)
if start < 0:
    raise SystemExit('ERROR: V24 withdrawal ad gate marker not found')

# Limit edits to the V24 withdrawal gate and the withdraw handler immediately after it.
amount_pos=s.find('const amount=num(b.amount_wiener);', start)
if amount_pos < 0:
    raise SystemExit('ERROR: withdrawal amount anchor not found after V24 marker')
window_end=amount_pos+len('const amount=num(b.amount_wiener);')
block=s[start:window_end]

# Upgrade all V24 status/start/credit response thresholds from 5 -> 10.
block=block.replace('required:5','required:10')
block=block.replace('count>=5','count>=10')
block=block.replace('before>=5','before>=10')

# Live backend has changed formatting across later patches, so match the guard semantically.
block,n_guard=re.subn(r'(withdrawAdCount\s*<\s*)5\b',r'\g<1>10',block,count=1)
if n_guard == 0 and not re.search(r'withdrawAdCount\s*<\s*10\b',block):
    raise SystemExit('ERROR: withdrawal enforcement guard not found in live V24 block')

# Upgrade user/admin error text regardless of whitespace/minification differences.
block=block.replace('Withdrawal ads: ${withdrawAdCount}/5','Withdrawal ads: ${withdrawAdCount}/10')
block=block.replace('withdraw_ads_required_${withdrawAdCount}_of_5','withdraw_ads_required_${withdrawAdCount}_of_10')

# Some live revisions stringify the error with a different quote style; catch the stable suffix.
block=block.replace('_of_5`','_of_10`')
block=block.replace('_of_5\'','_of_10\'')
block=block.replace('_of_5"','_of_10"')

s=s[:start]+block+s[window_end:]

# Strong validation before touching disk.
check=s[start:start+len(block)]
required_tokens=['required:10','count>=10','before>=10']
missing=[x for x in required_tokens if x not in check]
if missing:
    raise SystemExit('ERROR: V95 validation failed, missing: '+', '.join(missing))
if not re.search(r'withdrawAdCount\s*<\s*10\b',check):
    raise SystemExit('ERROR: V95 validation failed: server-side withdraw guard is not 10')
if re.search(r'withdrawAdCount\s*<\s*5\b',check):
    raise SystemExit('ERROR: V95 validation failed: old 5-ad server guard still present')

if s == original_text:
    print('V95 already installed: withdrawal requirement is 10 ads')
    sys.exit(0)

p.write_text(s)
print('Installed V95: withdrawal unlock requirement changed from 5 to 10 ads')
