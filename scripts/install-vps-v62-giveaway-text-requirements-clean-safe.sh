#!/usr/bin/env bash
set -euo pipefail

cd /opt/wiener-code
DB=wiener_farm_final
BACKEND=/opt/wiener-backend/server.mjs
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${BACKEND}.bak-v62-${STAMP}"

echo '=== V62 GIVEAWAY TEXT REQUIREMENTS CLEAN SAFE INSTALL ==='
[[ -f "$BACKEND" ]] || { echo 'ERROR: backend server.mjs not found' >&2; exit 1; }
node --check "$BACKEND"

ACTIVE_BC="$(runuser -u postgres -- psql -d "$DB" -Atqc "select count(*) from public.admin_broadcast_sessions where step='media_sending'" 2>/dev/null || echo 0)"
if [[ "${ACTIVE_BC:-0}" != "0" ]]; then
  echo 'ERROR: active V57 media broadcast detected; wait for it to finish before installing V62.' >&2
  exit 1
fi

if ! grep -q 'WIENER GIVEAWAY PARTICIPATION UX V60' "$BACKEND"; then
  echo 'ERROR: V60 giveaway UX missing' >&2
  exit 1
fi
if ! grep -q 'WIENER GIVEAWAY DEEPLINK BUTTON V61' "$BACKEND"; then
  echo 'ERROR: V61 giveaway deep-link patch missing. Install V61 first.' >&2
  exit 1
fi

cp -a "$BACKEND" "$BACKUP"
rollback(){
  echo 'ERROR: V62 install failed; restoring backend backup.' >&2
  cp -a "$BACKUP" "$BACKEND"
  node --check "$BACKEND" >/dev/null 2>&1 && pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
}
trap rollback ERR

echo '=== NORMALIZE EXISTING REQUIREMENTS ==='
runuser -u postgres -- psql -d "$DB" -v ON_ERROR_STOP=1 <<'SQL'
update public.wiener_giveaway_requirements
set requirement_type='name_contains'
where requirement_type='name_text';

update public.wiener_giveaway_requirements
set requirement_type='bio_contains'
where requirement_type='bio_text';
SQL

echo '=== BACKEND PATCH ==='
cat >/tmp/patch-v62-giveaway-text.py <<'PY'
from pathlib import Path
p=Path('/opt/wiener-backend/server.mjs')
s=p.read_text()
marker='// === WIENER GIVEAWAY TEXT REQUIREMENTS V62 ==='
if marker in s:
    print('V62 already installed')
    raise SystemExit(0)

# 1) Future admin-created requirements use the canonical names V60 verifies.
s=s.replace("g59:req:name_text", "g59:req:name_contains")
s=s.replace("g59:req:bio_text", "g59:req:bio_contains")

# 2) Remove OPEN WIENER FARM from future V59 publish markup.
old="g59kb([[g59url('🎁 PARTICIPATE',`https://t.me/WienerDogeFarmBot?start=${encodeURIComponent(g.public_id)}`)],[g59url('🌭 OPEN WIENER FARM',G59_APP)]])"
new="g59kb([[g59url('🎁 PARTICIPATE',`https://t.me/WienerDogeFarmBot?start=${encodeURIComponent(g.public_id)}`)]])"
if old in s:
    s=s.replace(old,new,1)

# 3) Remove OPEN WIENER FARM from V61 post/repost helper.
old61="""reply_markup:g59kb([\n      [g59url('🎁 PARTICIPATE',g61deepLink(g))],\n      [g59url('🌭 OPEN WIENER FARM',G59_APP)]\n    ]),"""
new61="""reply_markup:g59kb([\n      [g59url('🎁 PARTICIPATE',g61deepLink(g))]\n    ]),"""
if old61 not in s:
    raise SystemExit('ERROR: V61 public button markup anchor not found')
s=s.replace(old61,new61,1)

# 4) Remove OPEN WIENER FARM from the private giveaway card too.
oldcard="rows.push([g60url('🌭 OPEN WIENER FARM',G59_APP)]);return {text,markup:g60kb(rows)};"
newcard="return {text,markup:g60kb(rows)};"
if oldcard not in s:
    raise SystemExit('ERROR: V60 private card OPEN button anchor not found')
s=s.replace(oldcard,newcard,1)

# 5) V61 public text must show canonical + legacy text requirements clearly.
s=s.replace("if(t==='name_contains')return `• Name must contain: ${r.target_text||''}`;", "if(t==='name_contains'||t==='name_text')return `• Name must contain: <code>${g60esc(r.target_text||'')}</code>`;")
s=s.replace("if(t==='bio_contains')return `• Bio must contain: ${r.target_text||''}`;", "if(t==='bio_contains'||t==='bio_text')return `• Bio must contain: <code>${g60esc(r.target_text||'')}</code>`;")

# V61 sender now contains HTML <code> tags.
oldsend="""text,\n    reply_markup:g59kb([\n      [g59url('🎁 PARTICIPATE',g61deepLink(g))]\n    ]),\n    disable_web_page_preview:true"""
newsend="""text,\n    parse_mode:'HTML',\n    reply_markup:g59kb([\n      [g59url('🎁 PARTICIPATE',g61deepLink(g))]\n    ]),\n    disable_web_page_preview:true"""
if oldsend not in s:
    raise SystemExit('ERROR: V61 sender anchor not found')
s=s.replace(oldsend,newsend,1)

# 6) Make checker accept both canonical and legacy names and use fresh Telegram profile data.
s=s.replace("if(t==='name_contains'){const name=", "if(t==='name_contains'||t==='name_text'){const name=")
s=s.replace("if(t==='bio_contains'){const bio=", "if(t==='bio_contains'||t==='bio_text'){const bio=")
s=s.replace("if(t==='name_contains')return `Name contains <code>${g60esc(x)}</code>`;", "if(t==='name_contains'||t==='name_text')return `Name contains <code>${g60esc(x)}</code>`;")
s=s.replace("if(t==='bio_contains')return `Bio contains <code>${g60esc(x)}</code>`;", "if(t==='bio_contains'||t==='bio_text')return `Bio contains <code>${g60esc(x)}</code>`;")

# 7) Add CopyText helper and clean missing-requirement buttons.
anchor="const g60url=(text,url)=>({text,url});"
if anchor not in s:
    raise SystemExit('ERROR: V60 helper anchor missing')
s=s.replace(anchor,anchor+"\nconst g62copy=(text,value)=>({text,copy_text:{text:String(value||'')}});",1)

old="""if(bad.some(x=>['name_contains','bio_contains','username','profile_photo'].includes(x.r.requirement_type)))rows.push([g60url('👤 OPEN TELEGRAM PROFILE','tg://settings')]);\n    rows.push([g60cb('🔄 CHECK AGAIN',`g60:join:${g.id}`),g60cb('◀️ GIVEAWAY',`g60:view:${g.id}`)]);"""
new="""const textReqs=bad.filter(x=>['name_contains','name_text','bio_contains','bio_text'].includes(String(x.r.requirement_type))&&String(x.r.target_text||'').trim());\n    for(const x of textReqs.slice(0,4)){const v=String(x.r.target_text||'').trim(),where=String(x.r.requirement_type).startsWith('bio')?'BIO':'NAME';rows.push([g62copy(`📋 COPY FOR ${where}`,v)]);}\n    if(bad.some(x=>['name_contains','name_text','bio_contains','bio_text','username','profile_photo'].includes(String(x.r.requirement_type))))rows.push([g60url('👤 OPEN TELEGRAM PROFILE','tg://settings')]);\n    rows.push([g60cb('🔄 CHECK AGAIN',`g60:join:${g.id}`),g60cb('◀️ GIVEAWAY',`g60:view:${g.id}`)]);"""
if old not in s:
    raise SystemExit('ERROR: V60 missing requirement button block not found')
s=s.replace(old,new,1)

# 8) Add marker near final route.
route="\napp.use((_req,res)=>\n  res.status(404).json({ok:false,error:'route_not_enabled_yet'})\n);\n"
if route not in s:
    raise SystemExit('ERROR: final route marker missing')
s=s.replace(route,"\n// === WIENER GIVEAWAY TEXT REQUIREMENTS V62 ===\n"+route,1)

p.write_text(s)
print('V62 giveaway text requirement patch installed')
PY

python3 /tmp/patch-v62-giveaway-text.py
node --check "$BACKEND"

echo '=== RESTART ==='
pm2 restart wiener-api --update-env
sleep 3
pm2 status wiener-api
curl -fsS http://127.0.0.1:3000/health || curl -fsS http://127.0.0.1:3000/
echo
pm2 save >/dev/null

echo '=== VERIFY ==='
grep -q 'WIENER GIVEAWAY TEXT REQUIREMENTS V62' "$BACKEND"
grep -q "copy_text" "$BACKEND"
runuser -u postgres -- psql -d "$DB" -Atqc "select count(*)||' legacy_text_requirements' from public.wiener_giveaway_requirements where requirement_type in ('name_text','bio_text');"
echo 'open_wiener_public_button=removed'
echo 'name_bio_checker=enabled'
echo 'copy_requirement_button=enabled'
echo '=== V62 READY ==='
trap - ERR
