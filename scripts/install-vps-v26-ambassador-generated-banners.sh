#!/usr/bin/env bash
set -Eeuo pipefail

CODE=/opt/wiener-code
BACKEND=/opt/wiener-backend
SERVER="$BACKEND/server.mjs"
HOSTDIR=/opt/wiener-host-assets
TEMPLATE="$HOSTDIR/ambassador-promo-template"
FALLBACK="$HOSTDIR/promo-code"
SOURCE_URL='https://pixlinkhost.vercel.app/i/n5ni34AOgQ'
STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP="$SERVER.v26-amb-banner-$STAMP.bak"
OLD_APP=$(readlink -f /opt/wiener-app/current 2>/dev/null || true)
NEW_RELEASE=''

rollback(){
  rc=$?
  echo "V26 failed; restoring backend." >&2
  cp -f "$BACKUP" "$SERVER" 2>/dev/null || true
  pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
  if [[ -n "$OLD_APP" && -e "$OLD_APP" ]]; then ln -sfn "$OLD_APP" /opt/wiener-app/current || true; fi
  exit "$rc"
}
trap rollback ERR

cd "$CODE"
git pull --ff-only
mkdir -p "$HOSTDIR"
cp "$SERVER" "$BACKUP"

echo '=== AMBASSADOR PROMO TEMPLATE ==='
if [[ ! -s "$TEMPLATE" ]]; then
  tmp="$TEMPLATE.download"
  if curl -fsSL --max-time 30 "$SOURCE_URL" -o "$tmp"; then
    mv "$tmp" "$TEMPLATE"
    echo 'Downloaded requested Ambassador template.'
  elif [[ -s "$FALLBACK" ]]; then
    rm -f "$tmp"
    cp "$FALLBACK" "$TEMPLATE"
    echo 'Template URL unavailable; copied existing promo-code asset as fallback.'
  else
    rm -f "$tmp"
    echo 'Ambassador template unavailable.' >&2
    exit 1
  fi
fi

echo '=== SHARP RENDERER ==='
cd "$BACKEND"
if ! node -e "import('sharp').then(()=>process.exit(0)).catch(()=>process.exit(1))"; then
  npm install --no-save --no-audit --no-fund sharp@0.33.5
fi
if ! node --input-type=module <<'NODE'
import sharp from 'sharp';
const p='/opt/wiener-host-assets/ambassador-promo-template';
const m=await sharp(p).metadata();
if(!m.width||!m.height||m.width<900||m.height<450) throw new Error('invalid ambassador template dimensions');
console.log(`Template: ${m.width}x${m.height} ${m.format}`);
NODE
then
  if [[ -s "$FALLBACK" && "$FALLBACK" != "$TEMPLATE" ]]; then
    echo 'Downloaded template was invalid; using existing promo-code asset fallback.'
    cp "$FALLBACK" "$TEMPLATE"
    node --input-type=module <<'NODE'
import sharp from 'sharp';
const p='/opt/wiener-host-assets/ambassador-promo-template';
const m=await sharp(p).metadata();
if(!m.width||!m.height||m.width<900||m.height<450) throw new Error('invalid fallback template dimensions');
console.log(`Fallback template: ${m.width}x${m.height} ${m.format}`);
NODE
  else
    exit 1
  fi
fi

echo '=== DATABASE COMPATIBILITY ==='
runuser -u postgres -- psql -d wiener_farm_final -v ON_ERROR_STOP=1 <<'SQL'
alter table public.ambassador_broadcast_items
  add column if not exists banner_asset_name text,
  add column if not exists banner_url text;
SQL

echo '=== PATCH BACKEND ==='
cd "$CODE"
python3 scripts/patch-vps-v26-ambassador-generated-banners.py
node --check "$SERVER"

echo '=== BUILD MINI APP ==='
npm run build
[[ -f dist/index.html ]]
NEW_RELEASE="/opt/wiener-app/releases/$(date +%Y%m%d-%H%M%S)-v26-amb-banner"
mkdir -p "$NEW_RELEASE"
cp -a dist/. "$NEW_RELEASE/"

echo '=== RESTART + SWITCH ==='
pm2 restart wiener-api --update-env
sleep 2
pm2 save >/dev/null
ln -sfn "$NEW_RELEASE" /opt/wiener-app/current

echo '=== SAFE SMOKE TESTS ==='
code=$(curl -sS -o /tmp/wiener-v26-amb.json -w '%{http_code}' -X POST -H 'content-type: application/json' --data '{}' http://127.0.0.1:3000/functions/v1/wiener-ambassador-publish || true)
if [[ "$code" == "000" || "$code" == "404" || "$code" == "502" ]]; then
  cat /tmp/wiener-v26-amb.json 2>/dev/null || true
  echo "Ambassador route smoke failed: HTTP $code" >&2
  exit 1
fi
asset_code=$(curl -sS -o /dev/null -w '%{http_code}' https://api.viralaitools.xyz/host/promo-code || true)
echo "Ambassador route protected smoke: HTTP $code"
echo "Existing promo template public smoke: HTTP $asset_code"
echo 'V26 installed. Next Ambassador publish will generate one unique AMB banner per active channel.'

trap - ERR
