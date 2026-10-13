#!/usr/bin/env bash
set -Eeuo pipefail

BACKEND_DIR="${BACKEND_DIR:-/opt/wiener-backend}"
SERVER="$BACKEND_DIR/server.mjs"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/root/server.mjs.before-bsc-removal-$STAMP"

if [[ ! -f "$SERVER" ]]; then
  echo "ERROR: backend file not found: $SERVER" >&2
  exit 1
fi
command -v node >/dev/null
command -v python3 >/dev/null
command -v pm2 >/dev/null

cp -a "$SERVER" "$BACKUP"
echo "Backup: $BACKUP"

python3 - "$SERVER" <<'PY'
from pathlib import Path
import re, sys
p = Path(sys.argv[1])
s = p.read_text()

def replace_once(pattern, replacement, label, flags=re.S):
    global s
    new, n = re.subn(pattern, replacement, s, count=1, flags=flags)
    if n != 1:
        raise SystemExit(f"ABORT: expected exactly one match for {label}; found {n}. No file written.")
    s = new
    print(f"Patched: {label}")

# Remove BSC treasury scanner/worker definitions, preserving surrounding TON/Polygon code.
replace_once(
    r"/\* WIENER_BSC_TREASURY_V1 \*/.*?/\* END WIENER_BSC_TREASURY_V1 \*/",
    "/* WIENER_BSC_TREASURY_V1 removed: BSC/USDT payout disabled. */",
    "BSC treasury scanner and worker block"
)

# Remove BSC payout implementation only, preserving the endpoint position.
replace_once(
    r"/\* WIENER_BSC_PAYOUT_V1 \*/.*?(?=app\.post\(['\"]\/functions\/v1\/wiener-bsc-payout['\"])",
    "/* WIENER_BSC_PAYOUT_V1 removed: BSC/USDT payout disabled. */\n",
    "BSC payout implementation"
)

# Replace the full BSC HTTP endpoint with a clear disabled response.
replace_once(
    r"app\.post\(['\"]\/functions\/v1\/wiener-bsc-payout['\"].*?(?=/\* BSC routing for the generic admin payout helper\. \*/)",
    """app.post('/functions/v1/wiener-bsc-payout', (_req,res) => res.status(410).json({ error:'bsc_payout_disabled', message:'USDT BEP20 withdrawals are no longer supported.' }));

""",
    "BSC payout HTTP endpoint"
)

# Replace the generic admin payout router so BSC can never be selected.
replace_once(
    r"/\* BSC routing for the generic admin payout helper\. \*/\s*async function performPayV10B\(admin,wid,confirm=false\)\s*\{.*?\n\}",
    """/* Generic admin payout helper: TON/Gram and Polygon only; BSC/USDT disabled. */
async function performPayV10B(admin,wid,confirm=false){
 const w=(await pool.query('select * from public.withdrawals where id=$1',[wid])).rows[0];
 if(!w) throw new Error('withdrawal_not_found');
 if(w.method_key==='usdt_bep20'||w.network==='BEP20') throw new Error('bsc_payout_disabled');
 const fn=w.network==='TON'&&w.method_key==='gram_ton'
   ?'wiener-ton-payout'
   :w.network==='Polygon'
     ?'wiener-payout'
     :null;
 if(!fn) throw new Error('unsupported_withdrawal_network');
 return postLocalV10B(fn,{action:'pay',admin_id:admin,withdrawal_id:wid,confirm_high_value:confirm,confirm_risk:confirm});
}""",
    "generic payout router"
)

# Ensure user withdrawal creation cannot accept USDT BEP20 even if a stale method remains in the DB.
# This is a narrow guard added inside the generic request route only when its known request path exists.
request_markers = [
    "app.post('/functions/v1/wiener-withdraw',",
    'app.post("/functions/v1/wiener-withdraw",',
    "app.post('/functions/v1/wiener-withdraw-request',",
    'app.post("/functions/v1/wiener-withdraw-request",'
]
found = [m for m in request_markers if m in s]
if len(found) == 1:
    marker = found[0]
    # Insert a request-level guard immediately after the route callback opens, only if its syntax matches.
    pat = re.escape(marker) + r"(\s*async\s*\([^)]*\)\s*=>\s*\{)"
    new, n = re.subn(pat, r"\1\n if(String(req.body?.method_key||'')==='usdt_bep20') return res.status(410).json({error:'bsc_payout_disabled'});", s, count=1)
    if n == 1:
        s = new
        print("Patched: withdrawal request guard")
    else:
        print("Notice: generic withdrawal route found but its signature differs; payout router and endpoint are still disabled.")
elif len(found) > 1:
    raise SystemExit("ABORT: multiple possible withdrawal request routes; refusing ambiguous edit.")
else:
    print("Notice: no matching generic withdrawal request route name; BSC payout endpoint and admin router are disabled.")

p.write_text(s)
PY

# Syntax-check before touching the running process.
if ! node --check "$SERVER"; then
  echo "ERROR: syntax check failed; restoring backup." >&2
  cp -a "$BACKUP" "$SERVER"
  node --check "$SERVER"
  exit 1
fi

echo "Syntax check: PASS"
pm2 restart wiener-api
pm2 save
sleep 2
pm2 status wiener-api
echo
echo "Recent BSC-related logs (informational; old log entries may remain):"
pm2 logs wiener-api --lines 30 --nostream 2>&1 | grep -Ei 'bsc|syntaxerror|error' | tail -20 || true
echo
echo "Completed. Backup retained at: $BACKUP"
