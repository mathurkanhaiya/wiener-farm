#!/usr/bin/env bash
set -euo pipefail
cd /opt/wiener-code
BACKEND=/opt/wiener-backend/server.mjs
[[ -f "$BACKEND" ]] || BACKEND=/opt/wiener-backend/server.js
STAMP=$(date +%Y%m%d-%H%M%S)
BB="$BACKEND.v113-adsgram-unlimited-$STAMP.bak"
FB="src/AdsPage.tsx.v113-$STAMP.bak"
[[ -f "$BACKEND" && -f src/AdsPage.tsx ]] || { echo "ERROR: required files missing"; exit 1; }
node --check "$BACKEND"
cp -a "$BACKEND" "$BB"; cp -a src/AdsPage.tsx "$FB"
rollback(){ cp -a "$BB" "$BACKEND"; cp -a "$FB" src/AdsPage.tsx; pm2 restart wiener-api --update-env >/dev/null 2>&1 || true; }
trap rollback ERR

python3 - <<'PY'
from pathlib import Path
p=Path('/opt/wiener-backend/server.mjs')
if not p.exists(): p=Path('/opt/wiener-backend/server.js')
s=p.read_text()
# Remove V111 reward reducer middleware only. Original AdsGram start/complete callback route remains untouched.
a=s.find('// === WIENER MAIN AD STRICT DYNAMIC V111 ===')
b=s.find('// === END WIENER MAIN AD STRICT DYNAMIC V111 ===')
if a>=0 and b>=0:
    b += len('// === END WIENER MAIN AD STRICT DYNAMIC V111 ===')
    s=s[:a]+s[b:]
s=s.replace("app.use('/functions/v1/wiener-ad',mainAdStrictV111());\n",'')
p.write_text(s)
print('V113 backend patch applied')
PY

node --check "$BACKEND"
# Frontend is committed directly; verify it before and after build.
grep -Fq "const mainAtLimit=false" src/AdsPage.tsx
grep -Fq "AdsGram — Unlimited" src/AdsPage.tsx
! grep -Fq "Today's progress" src/AdsPage.tsx
! grep -Fq "result.full_reward" src/AdsPage.tsx
! grep -Fq "3-second advertiser visit detected" src/AdsPage.tsx
! grep -Fq "const tracker=trackAdInteraction" src/AdsPage.tsx

npm run build
npm run typecheck
pm2 restart wiener-api --update-env
sleep 3
curl -fsS http://127.0.0.1:3000/health
echo
pm2 save
trap - ERR
echo "=== V113 READY ==="
echo "Main AdsGram: WATCH -> loading -> completed AdsGram callback -> full configured reward."
echo "Main daily limit UI/check removed. Original backend callback route remains."
echo "No visibility-loss reward reduction remains."
