#!/usr/bin/env bash
set -euo pipefail

cd /opt/wiener-code
BACKEND=/opt/wiener-backend/server.mjs
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${BACKEND}.bak-v66-${STAMP}"

echo '=== V66 GIVEAWAY WALLET PARAM CAST SAFE INSTALL ==='
[[ -f "$BACKEND" ]] || { echo 'ERROR: backend server.mjs not found' >&2; exit 1; }
node --check "$BACKEND"

cp -a "$BACKEND" "$BACKUP"
rollback(){
  echo 'ERROR: V66 install failed; restoring backend backup.' >&2
  cp -a "$BACKUP" "$BACKEND"
  node --check "$BACKEND" >/dev/null 2>&1 && pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
}
trap rollback ERR

cat >/tmp/patch-v66-giveaway-param-cast.py <<'PY'
from pathlib import Path
p=Path('/opt/wiener-backend/server.mjs')
s=p.read_text()
marker='// === WIENER GIVEAWAY WALLET PARAM CAST V66 ==='
if marker in s:
    print('V66 already installed')
    raise SystemExit(0)

old="wallet_network,wallet_linked_at,checked_at) values($1,$2,$3,$4,$5,'entered',true,null,$6::jsonb,$7::jsonb,$8,$9,$10,case when $8 is null then null else now() end,now())"
new="wallet_network,wallet_linked_at,checked_at) values($1,$2,$3,$4,$5,'entered',true,null,$6::jsonb,$7::jsonb,$8::text,$9::text,$10::text,case when $8::text is null then null else now() end,now())"
if old not in s:
    raise SystemExit('ERROR: g60finishEntry SQL pattern not found; backend changed')
s=s.replace(old,new,1)

route="\napp.use((_req,res)=>\n  res.status(404).json({ok:false,error:'route_not_enabled_yet'})\n);\n"
if route not in s:
    raise SystemExit('ERROR: final route marker missing')
s=s.replace(route,"\n// === WIENER GIVEAWAY WALLET PARAM CAST V66 ===\n"+route,1)

p.write_text(s)
print('V66 parameter cast patch installed')
PY

python3 /tmp/patch-v66-giveaway-param-cast.py
node --check "$BACKEND"

echo '=== RESTART ==='
pm2 restart wiener-api --update-env
sleep 3
pm2 status wiener-api
curl -fsS http://127.0.0.1:3000/health || curl -fsS http://127.0.0.1:3000/
echo
pm2 save >/dev/null

echo '=== VERIFY ==='
grep -q 'WIENER GIVEAWAY WALLET PARAM CAST V66' "$BACKEND"
grep -q 'case when \$8::text is null' "$BACKEND"
echo 'g60finishEntry_param8_cast=fixed'
echo 'save_participate_stuck_checking=fixed'
echo '=== V66 READY ==='
trap - ERR
