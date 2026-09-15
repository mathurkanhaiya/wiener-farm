#!/usr/bin/env bash
set -Eeuo pipefail

ENV=/opt/wiener-backend/.env
[[ -f "$ENV" ]] || { echo "ERROR: $ENV not found"; exit 1; }
STAMP="$(date +%Y%m%d-%H%M%S)"
cp -a "$ENV" "${ENV}.v96-provider-backup-${STAMP}"

echo '=== WIENER V96 PROVIDER SETUP ==='
echo 'Nothing typed here is committed to GitHub. Secrets stay in the VPS .env file.'
echo
read -r -p 'Lootably Integration/Direct Link (must contain USER_ID placeholder, or userID will be appended): ' LOOT_URL
read -r -s -p 'Lootably Postback Secret: ' LOOT_SECRET; echo
read -r -p 'BitLabs App Token: ' BIT_TOKEN
read -r -s -p 'BitLabs App Secret: ' BIT_SECRET; echo

[[ "$LOOT_URL" == https://* ]] || { echo 'ERROR: Lootably URL must start with https://'; exit 1; }
[[ -n "$LOOT_SECRET" ]] || { echo 'ERROR: Lootably secret is required'; exit 1; }
[[ -n "$BIT_TOKEN" ]] || { echo 'ERROR: BitLabs token is required'; exit 1; }
[[ -n "$BIT_SECRET" ]] || { echo 'ERROR: BitLabs secret is required'; exit 1; }

python3 - "$ENV" "$LOOT_URL" "$LOOT_SECRET" "$BIT_TOKEN" "$BIT_SECRET" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1])
vals={
 'LOOTABLY_OFFERWALL_URL':sys.argv[2],
 'LOOTABLY_POSTBACK_SECRET':sys.argv[3],
 'BITLABS_APP_TOKEN':sys.argv[4],
 'BITLABS_APP_SECRET':sys.argv[5],
 'WIENER_OFFERS_USER_SHARE':'0.70',
 'WIENER_PER_USD':'20000',
 'WIENER_OFFERS_MAX_PAYOUT_USD':'100',
}
lines=p.read_text().splitlines()
for k,v in vals.items():
    repl=f'{k}={v}'
    found=False
    for i,line in enumerate(lines):
        if line.startswith(k+'='):
            lines[i]=repl; found=True; break
    if not found: lines.append(repl)
p.write_text('\n'.join(lines)+'\n')
print('Provider environment saved.')
PY

pm2 restart wiener-api --update-env
pm2 save >/dev/null
sleep 2
curl -fsS http://127.0.0.1:3000/health
printf '\n'

echo '=== PROVIDERS CONFIGURED ==='
echo 'Lootably callback:'
echo 'https://api.viralaitools.xyz/functions/v1/wiener-offers/lootably-callback'
echo
echo 'BitLabs callback:'
echo 'https://api.viralaitools.xyz/functions/v1/wiener-offers/bitlabs-callback'
echo
echo 'Default economics: user 70% / Wiener gross margin 30%; 20,000 WIENER = $1.'
echo 'Configure both callbacks in the provider dashboards before enabling traffic.'
