#!/usr/bin/env python3
from pathlib import Path
import os,re

p=Path(os.environ.get('WIENER_BACKEND_FILE','/opt/wiener-backend/server.mjs'))
if not p.exists():
    alt=Path('/opt/wiener-backend/server.js')
    if alt.exists(): p=alt
if not p.exists(): raise SystemExit('ERROR: Wiener backend not found')
s=p.read_text()
if 'WIENER DAILY GRAM QUEST V79' not in s:
    raise SystemExit('ERROR: V79 GRAM quest not installed')
TAG='WIENER DAILY GRAM QUEST V79B OWNER FIX'
if TAG in s:
    print('V79B already installed')
    raise SystemExit(0)

pat=re.compile(r"let gramQuestSetupPromiseV79=null;\nfunction gramQuestSetupV79\(\)\{.*?\n\}\nasync function gramQuestConfigV79",re.S)
m=pat.search(s)
if not m:
    raise SystemExit('ERROR: V79 setup function not found')
replacement="""// WIENER DAILY GRAM QUEST V79B OWNER FIX\n// Schema migration is installer-only. Runtime DB user must never ALTER/CREATE tables.\nlet gramQuestSetupPromiseV79=Promise.resolve();\nfunction gramQuestSetupV79(){ return gramQuestSetupPromiseV79; }\nasync function gramQuestConfigV79"""
s=s[:m.start()]+replacement+s[m.end():]
p.write_text(s)
print('V79B runtime DDL removed; app DB user no longer needs table ownership')
