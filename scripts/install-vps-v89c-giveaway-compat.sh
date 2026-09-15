#!/usr/bin/env bash
set -Eeuo pipefail
CODE=/opt/wiener-code
SERVER=/opt/wiener-backend/server.mjs
[ -f "$SERVER" ] || SERVER=/opt/wiener-backend/server.js
[ -f "$SERVER" ] || { echo 'ERROR: backend file not found'; exit 1; }
cd "$CODE"

echo '=== V89C COMPATIBILITY FIX ==='

# Current live V18/V76 backend has tgV10/edit18 but may not include the optional
# answer18 convenience helper. V89 only needs answerCallbackQuery, so provide a
# private giveaway helper instead of requiring/modifying the legacy bot helper set.
python3 - <<'PY'
from pathlib import Path

installer=Path('scripts/install-vps-v89-giveaway-studio.sh')
s=installer.read_text()
s=s.replace(" 'async function answer18'", "")
installer.write_text(s)

patch=Path('scripts/patch-vps-v89-giveaway-studio.py')
s=patch.read_text()
# Make the patch self-contained on older/current V18 bot builds.
if "async function gw89answer" not in s:
    needle="const gw89now=()=>new Date();"
    helper="""const gw89now=()=>new Date();\nasync function gw89answer(q,text='Updated',alert=false){return tgV10('answerCallbackQuery',{callback_query_id:q.id,text,show_alert:alert}).catch(()=>null)}"""
    if needle not in s:
        raise SystemExit('ERROR: V89 helper insertion anchor missing')
    s=s.replace(needle,helper,1)
    s=s.replace('await answer18(', 'await gw89answer(')
patch.write_text(s)
PY

# Confirm only helpers actually required by the giveaway module.
for x in 'async function handleBotFullV18' 'async function adm18' 'const kb18=' 'const cb18=' 'const web18=' 'const url18=' 'async function st18' 'async function edit18' 'async function safeTg18' 'async function register18' 'async function tgV10'; do
  grep -q "$x" "$SERVER" || { echo "ERROR: live backend is missing required helper: $x"; exit 1; }
done

echo 'Compatibility precheck passed.'

bash scripts/install-vps-v89b-giveaway-studio.sh
