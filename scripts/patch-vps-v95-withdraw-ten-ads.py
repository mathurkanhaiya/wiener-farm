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

# Limit edits to the V24 gate plus the withdraw handler immediately after it.
amount_anchor='const amount=num(b.amount_wiener);'
amount_pos=s.find(amount_anchor,start)
if amount_pos < 0:
    raise SystemExit('ERROR: withdrawal amount anchor not found after V24 marker')
window_end=amount_pos+len(amount_anchor)
block=s[start:window_end]

# Upgrade V24 status/start/credit response thresholds from 5 -> 10.
block=block.replace('required:5','required:10')
block=block.replace('count>=5','count>=10')
block=block.replace('before>=5','before>=10')

# Upgrade an existing legacy withdraw guard if present. Later live revisions may no
# longer contain that guard, so absence is not fatal; we safely inject our own.
block,n_guard=re.subn(r'(withdrawAdCount\s*<\s*)5\b',r'\g<1>10',block,count=1)
block=block.replace('Withdrawal ads: ${withdrawAdCount}/5','Withdrawal ads: ${withdrawAdCount}/10')
block=block.replace('withdraw_ads_required_${withdrawAdCount}_of_5','withdraw_ads_required_${withdrawAdCount}_of_10')
block=block.replace('_of_5`','_of_10`').replace("_of_5'","_of_10'").replace('_of_5"','_of_10"')

# If no server-side guard exists in the current live handler, inject a compact,
# independent guard immediately before amount parsing. This uses the existing V24
# counted-session function and does not alter balances, fees, cooldowns or history.
if not re.search(r'(?:withdrawAdCount|withdrawAdCountV95)\s*<\s*10\b',block):
    inject=(
        "// === WIENER WITHDRAW 10-AD ENFORCEMENT V95 ===\n"
        "const withdrawAdCountV95=await withdrawAdCountV24(id);"
        "if(withdrawAdCountV95<10){throw new Error(`withdraw_ads_required_${withdrawAdCountV95}_of_10`)}"
    )
    block=block.replace(amount_anchor,inject+amount_anchor,1)

s=s[:start]+block+s[window_end:]

# Strong validation before touching disk.
check=s[start:start+len(block)+300]
required_tokens=['required:10','count>=10','before>=10']
missing=[x for x in required_tokens if x not in check]
if missing:
    raise SystemExit('ERROR: V95 validation failed, missing: '+', '.join(missing))
if not (re.search(r'withdrawAdCount\s*<\s*10\b',check) or re.search(r'withdrawAdCountV95\s*<\s*10\b',check)):
    raise SystemExit('ERROR: V95 validation failed: server-side withdraw guard is not 10')
if re.search(r'withdrawAdCount\s*<\s*5\b',check):
    raise SystemExit('ERROR: V95 validation failed: old 5-ad server guard still present')

if s == original_text:
    print('V95 already installed: withdrawal requirement is 10 ads')
    sys.exit(0)

p.write_text(s)
print('Installed V95: withdrawal unlock requirement is 10 ads with server-side enforcement')
