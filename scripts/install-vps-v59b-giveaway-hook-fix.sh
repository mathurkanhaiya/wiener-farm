#!/usr/bin/env bash
set -euo pipefail

cd /opt/wiener-code
SRC="scripts/install-vps-v59-advanced-giveaway-admin-safe.sh"
TMP="/tmp/install-vps-v59b-fixed.sh"

[[ -f "$SRC" ]] || { echo "ERROR: $SRC missing" >&2; exit 1; }
cp "$SRC" "$TMP"

python3 - <<'PY'
from pathlib import Path
p=Path('/tmp/install-vps-v59b-fixed.sh')
s=p.read_text()
old='''hook="    try{if(await handleBotParityV18(up,uid,text,m,q)) return done();}catch(e){console.error('v18_bot_parity',String(e?.message||e));}"
if hook not in s:
    raise SystemExit('ERROR: V18 bot parity hook not found')
s=s.replace(hook,"    try{if(await handleGiveawayV59(up,uid,text,m,q)) return done();}catch(e){console.error('v59_giveaway',String(e?.message||e));}\\n"+hook,1)
'''
new='''handler="uid=Number(q?.from?.id||m?.from?.id||uid||0);text=String(m?.text||text||'').trim();\\n  if(!uid&&!q)return false;"
if handler not in s:
    raise SystemExit('ERROR: current V18/V57 bot handler insertion point not found')
replacement=handler+"\\n  try{if(await handleGiveawayV59(up,uid,text,m,q))return true;}catch(e){console.error('v59_giveaway',String(e?.message||e));}"
s=s.replace(handler,replacement,1)
'''
if old not in s:
    raise SystemExit('ERROR: V59 source hook block changed; refusing unsafe rewrite')
s=s.replace(old,new,1)
p.write_text(s)
print('V59B installer hook repaired for current backend')
PY

chmod +x "$TMP"
bash "$TMP"
