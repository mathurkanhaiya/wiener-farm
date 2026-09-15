#!/usr/bin/env bash
set -euo pipefail

cd /opt/wiener-code
DB=wiener_farm_final
BACKEND=/opt/wiener-backend/server.mjs
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${BACKEND}.bak-v64-${STAMP}"

echo '=== V64 GIVEAWAY REQUIREMENT PROMPTS SAFE INSTALL ==='
[[ -f "$BACKEND" ]] || { echo 'ERROR: backend server.mjs not found' >&2; exit 1; }
node --check "$BACKEND"

a="$(runuser -u postgres -- psql -d "$DB" -Atqc "select count(*) from public.admin_broadcast_sessions where step='media_sending'" 2>/dev/null || echo 0)"
if [[ "${a:-0}" != "0" ]]; then
  echo 'ERROR: active V57 media broadcast detected; wait for it to finish before installing V64.' >&2
  exit 1
fi

grep -q 'WIENER GIVEAWAY TEXT REQUIREMENTS V62' "$BACKEND" || { echo 'ERROR: V62 giveaway text-requirement patch missing' >&2; exit 1; }

cp -a "$BACKEND" "$BACKUP"
rollback(){
  echo 'ERROR: V64 install failed; restoring backend backup.' >&2
  cp -a "$BACKUP" "$BACKEND"
  node --check "$BACKEND" >/dev/null 2>&1 && pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
}
trap rollback ERR

cat >/tmp/patch-v64-giveaway-req-prompts.py <<'PY'
from pathlib import Path
p=Path('/opt/wiener-backend/server.mjs')
s=p.read_text()
marker='// === WIENER GIVEAWAY REQUIREMENT PROMPTS V64 ==='
if marker in s:
    print('V64 already installed')
    raise SystemExit(0)

# Show actual text requirements in the admin requirement summary.
old="function g59reqText(d){const r=d.requirements||[];return r.length?r.map((x,i)=>`${i+1}. ${x.label||x.type}${x.value!=null?` · ${x.value}`:''}${x.chat?` · ${x.chat}`:''}`).join('\\n'):'No requirements — open participation.'}"
new="function g59reqText(d){const r=d.requirements||[];return r.length?r.map((x,i)=>`${i+1}. ${x.label||x.type}${x.value!=null?` · ${x.value}`:''}${x.chat?` · ${x.chat}`:''}${x.text?` · ${x.text}`:''}`).join('\\n'):'No requirements — open participation.'}"
if old not in s:
    raise SystemExit('ERROR: g59reqText anchor changed')
s=s.replace(old,new,1)

# Canonical name/bio requirement callbacks (V62 renamed buttons) must go to text input,
# never the generic numeric-input fallback.
old_branch="if(['name_text','bio_text'].includes(type)){await g59set(uid,`req_text:${type}`,d);await g59edit(q,`Send required ${type==='name_text'?'name':'bio'} text.`,g59kb([[g59cb('❌ CANCEL','g59:cancel')]]));return true}await g59set(uid,`req_value:${type}`,d);await g59edit(q,'Send required number.',g59kb([[g59cb('❌ CANCEL','g59:cancel')]]));return true"
new_branch="if(['name_contains','name_text','bio_contains','bio_text'].includes(type)){const isName=type==='name_contains'||type==='name_text';await g59set(uid,`req_text:${isName?'name_contains':'bio_contains'}`,d);await g59edit(q,`${isName?'📝 NAME REQUIREMENT':'📄 BIO REQUIREMENT'}\\n\\nSend the exact text users must add to their Telegram ${isName?'Name':'Bio'}.\\n\\nExample: @WienerDogeFarmBot or @WienerFarm or 🌭`,g59kb([[g59cb('❌ CANCEL','g59:cancel')]]));return true}const prompts={ads:'📺 How many ads must the user watch?\\n\\nSend a number, e.g. 10',tasks:'✅ How many tasks must the user complete?\\n\\nSend a number, e.g. 3',referrals:'👥 How many valid referrals are required?\\n\\nSend a number, e.g. 2',spins:'🎡 How many spins are required?\\n\\nSend a number, e.g. 5',account_age:'🕒 Minimum account age in days?\\n\\nSend a number, e.g. 7'};if(!Object.prototype.hasOwnProperty.call(prompts,type)){await g59answer(q,'Unsupported requirement',true);return true}await g59set(uid,`req_value:${type}`,d);await g59edit(q,prompts[type],g59kb([[g59cb('❌ CANCEL','g59:cancel')]]));return true"
if old_branch not in s:
    raise SystemExit('ERROR: requirement callback branch anchor changed')
s=s.replace(old_branch,new_branch,1)

# Store canonical text requirement types and label them correctly.
old_text="if(us.step?.startsWith('req_text:')){const type=us.step.split(':')[1];d.requirements=d.requirements||[];d.requirements.push({type,label:type==='name_text'?'📝 Name contains text':'📄 Bio contains text',text:String(text).slice(0,80),verification:type==='bio_text'?'manual':'automatic'});await g59set(uid,'requirements',d);await g59send(uid,`✅ Added.\\n\\n${g59reqText(d)}`,g59reqMarkup());return true}"
new_text="if(us.step?.startsWith('req_text:')){const raw=us.step.split(':')[1],type=(raw==='name_text'?'name_contains':raw==='bio_text'?'bio_contains':raw),v=String(text||'').trim().slice(0,80);if(!v)return g59send(uid,'❌ Send the required text.');const isName=type==='name_contains';d.requirements=d.requirements||[];d.requirements.push({type,label:isName?'📝 Name contains':'📄 Bio contains',text:v,verification:'automatic'});await g59set(uid,'requirements',d);await g59send(uid,`✅ Added: ${v}\\n\\n${g59reqText(d)}`,g59reqMarkup());return true}"
if old_text not in s:
    raise SystemExit('ERROR: req_text handler anchor changed')
s=s.replace(old_text,new_text,1)

route="\napp.use((_req,res)=>\n  res.status(404).json({ok:false,error:'route_not_enabled_yet'})\n);\n"
if route not in s:
    raise SystemExit('ERROR: final route marker missing')
s=s.replace(route,"\n// === WIENER GIVEAWAY REQUIREMENT PROMPTS V64 ===\n"+route,1)

p.write_text(s)
print('V64 giveaway requirement prompts patch installed')
PY

python3 /tmp/patch-v64-giveaway-req-prompts.py
node --check "$BACKEND"

echo '=== RESTART ==='
pm2 restart wiener-api --update-env
sleep 3
pm2 status wiener-api
curl -fsS http://127.0.0.1:3000/health || curl -fsS http://127.0.0.1:3000/
echo
pm2 save >/dev/null

echo '=== VERIFY ==='
grep -q 'WIENER GIVEAWAY REQUIREMENT PROMPTS V64' "$BACKEND"
grep -q "NAME REQUIREMENT" "$BACKEND"
grep -q "Minimum account age in days" "$BACKEND"
echo 'name_text_prompt=text_not_number'
echo 'bio_text_prompt=text_not_number'
echo 'numeric_prompts=type_specific'
echo '=== V64 READY ==='
trap - ERR
