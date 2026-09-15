#!/usr/bin/env bash
set -euo pipefail

cd /opt/wiener-code
DB=wiener_farm_final
BACKEND=/opt/wiener-backend/server.mjs
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${BACKEND}.bak-v68-${STAMP}"

echo '=== V68 DAILY REFERRAL BIO GATE SAFE INSTALL ==='
[[ -f "$BACKEND" ]] || { echo 'ERROR: backend server.mjs not found' >&2; exit 1; }
node --check "$BACKEND"

ACTIVE_BC="$(runuser -u postgres -- psql -d "$DB" -Atqc "select count(*) from public.admin_broadcast_sessions where step='media_sending'" 2>/dev/null || echo 0)"
if [[ "${ACTIVE_BC:-0}" != "0" ]]; then
  echo 'ERROR: active media broadcast detected; wait for it to finish before installing V68.' >&2
  exit 1
fi

cp -a "$BACKEND" "$BACKUP"
rollback(){
  echo 'ERROR: V68 install failed; restoring backend backup.' >&2
  cp -a "$BACKUP" "$BACKEND"
  node --check "$BACKEND" >/dev/null 2>&1 && pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
}
trap rollback ERR

cat >/tmp/patch-v68-daily-bio-gate.py <<'PY'
from pathlib import Path
p=Path('/opt/wiener-backend/server.mjs')
s=p.read_text()
marker='// === WIENER DAILY REFERRAL BIO GATE V68 ==='
if marker in s:
    print('V68 already installed')
    raise SystemExit(0)

anchors=["app.post('/functions/v1/wiener-api'", 'app.post("/functions/v1/wiener-api"', "app.all('/functions/v1/wiener-api'", 'app.all("/functions/v1/wiener-api"']
found=[a for a in anchors if a in s]
if len(found)!=1:
    raise SystemExit(f'ERROR: expected exactly one wiener-api route anchor, found {len(found)}')
anchor=found[0]

code=r'''
// === WIENER DAILY REFERRAL BIO GATE V68 ===
async function dailyBioCheckV68(id){
  const st=(await pool.query(`select bot_username from public.app_settings where id=true limit 1`)).rows[0]||{};
  const bot=String(st.bot_username||'@WienerDogeFarmBot').replace(/^@/,'').trim();
  const referral=`https://t.me/${bot}?startapp=ref_${id}`;
  let chat;
  try{chat=await telegramApi('getChat',{chat_id:id})}catch(e){
    const err=new Error('daily_bio_check_unavailable');
    err.cause=e;
    throw err;
  }
  const bio=String(chat?.bio||'').replace(/\s+/g,'').toLowerCase();
  const path=`t.me/${bot}?startapp=ref_${id}`.toLowerCase();
  return {verified:bio.includes(path),referral_link:referral,bio_present:bio.length>0};
}
app.use('/functions/v1/wiener-api',async(req,res,next)=>{
  if(req.method!=='POST')return next();
  const b=req.body||{},action=String(b.action||'');
  if(action!=='daily_claim'&&action!=='daily_bio_check')return next();
  try{
    const {id}=await edgeUser(b);
    const check=await dailyBioCheckV68(id);
    if(!check.verified)return res.status(412).json({ok:false,error:'daily_bio_required',message:'Add your personal WIENER Farm referral link to your Telegram bio, then tap Check & claim.',data:check});
    if(action==='daily_bio_check')return res.json({ok:true,data:check});
    return next();
  }catch(e){
    if(String(e?.message||e)==='daily_bio_check_unavailable')return res.status(503).json({ok:false,error:'daily_bio_check_unavailable',message:'Telegram bio verification is temporarily unavailable. Please try again shortly.'});
    return edgeFail(res,e);
  }
});

'''
s=s.replace(anchor,code+anchor,1)
p.write_text(s)
print('V68 daily referral bio gate installed')
PY

python3 /tmp/patch-v68-daily-bio-gate.py
node --check "$BACKEND"

echo '=== RESTART ==='
pm2 restart wiener-api --update-env
sleep 3
pm2 status wiener-api
curl -fsS http://127.0.0.1:3000/healthz || curl -fsS http://127.0.0.1:3000/health || curl -fsS http://127.0.0.1:3000/
echo
pm2 save >/dev/null

echo '=== VERIFY ==='
grep -q 'WIENER DAILY REFERRAL BIO GATE V68' "$BACKEND"
grep -q "action!=='daily_claim'&&action!=='daily_bio_check'" "$BACKEND"
grep -q 'dailyBioCheckV68' "$BACKEND"
echo 'daily_claim_requires_referral_bio=enabled'
echo 'daily_bio_check=enabled'
echo 'other_routes_unchanged=yes'
echo '=== V68 READY ==='
trap - ERR
