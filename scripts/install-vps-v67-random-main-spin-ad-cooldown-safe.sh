#!/usr/bin/env bash
set -euo pipefail

cd /opt/wiener-code
DB=wiener_farm_final
BACKEND=/opt/wiener-backend/server.mjs
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${BACKEND}.bak-v67-${STAMP}"

echo '=== V67 RANDOM MAIN + SPIN AD COOLDOWN SAFE INSTALL ==='
[[ -f "$BACKEND" ]] || { echo 'ERROR: backend server.mjs not found' >&2; exit 1; }
node --check "$BACKEND"

ACTIVE_BC="$(runuser -u postgres -- psql -d "$DB" -Atqc "select count(*) from public.admin_broadcast_sessions where step='media_sending'" 2>/dev/null || echo 0)"
if [[ "${ACTIVE_BC:-0}" != "0" ]]; then
  echo 'ERROR: active media broadcast detected; wait for it to finish before installing V67.' >&2
  exit 1
fi

# These columns live on the existing ad-session tables, so the runtime keeps its
# existing table permissions and no new runtime-DDL path is introduced.
runuser -u postgres -- psql -d "$DB" -v ON_ERROR_STOP=1 <<'SQL'
ALTER TABLE public.ad_sessions
  ADD COLUMN IF NOT EXISTS random_cooldown_until timestamptz;
ALTER TABLE public.wiener_spin_ad_sessions
  ADD COLUMN IF NOT EXISTS random_cooldown_until timestamptz;
CREATE INDEX IF NOT EXISTS ad_sessions_random_cooldown_user_idx
  ON public.ad_sessions(telegram_id, random_cooldown_until DESC)
  WHERE random_cooldown_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS spin_ad_sessions_random_cooldown_user_idx
  ON public.wiener_spin_ad_sessions(telegram_id, random_cooldown_until DESC)
  WHERE random_cooldown_until IS NOT NULL;
SQL

cp -a "$BACKEND" "$BACKUP"
rollback(){
  echo 'ERROR: V67 install failed; restoring backend backup.' >&2
  cp -a "$BACKUP" "$BACKEND"
  node --check "$BACKEND" >/dev/null 2>&1 && pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
}
trap rollback ERR

cat >/tmp/patch-v67-random-ad-cooldown.py <<'PY'
from pathlib import Path

p=Path('/opt/wiener-backend/server.mjs')
s=p.read_text()
marker='// === WIENER RANDOM MAIN + SPIN AD COOLDOWN V67 ==='
if marker in s:
    print('V67 already installed')
    raise SystemExit(0)

main_route="app.post('/functions/v1/wiener-ad'"
usage_route="app.post('/functions/v1/wiener-ad-usage'"
spin_route="app.post('/functions/v1/wiener-spin'"
for label,needle in [('main AdsGram',main_route),('main ad usage',usage_route),('Spin AdsGram',spin_route)]:
    if needle not in s:
        raise SystemExit(f'ERROR: {label} route anchor missing; refusing partial patch')

helper=r'''
// === WIENER RANDOM MAIN + SPIN AD COOLDOWN V67 ===
// Server-authoritative, cryptographically random 10-20 second cooldown.
// Scope is intentionally limited to main AdsGram and Spin AdsGram only.
async function adCooldownRemainingV67(id,flow){
  const sql=flow==='main'
    ? `select greatest(0,ceil(extract(epoch from (max(random_cooldown_until)-now()))))::int seconds from public.ad_sessions where telegram_id=$1 and random_cooldown_until>now()`
    : `select greatest(0,ceil(extract(epoch from (max(random_cooldown_until)-now()))))::int seconds from public.wiener_spin_ad_sessions where telegram_id=$1 and random_cooldown_until>now()`;
  const q=await pool.query(sql,[id]);
  return Math.max(0,Number(q.rows[0]?.seconds||0));
}
async function setAdCooldownV67(id,flow,sid=''){
  const seconds=crypto.randomInt(10,21);
  let q;
  if(flow==='main'){
    // Main AdsGram's active completion is the newest user session. Only a null
    // cooldown can be filled, so duplicate completion callbacks cannot reroll it.
    q=await pool.query(`with target as (
      select ctid from public.ad_sessions
      where telegram_id=$1
      order by started_at desc
      limit 1
    )
    update public.ad_sessions a
       set random_cooldown_until=now()+($2::int*interval '1 second')
      from target t
     where a.ctid=t.ctid and a.random_cooldown_until is null
    returning 1`,[id,seconds]);
  }else{
    q=await pool.query(`update public.wiener_spin_ad_sessions
       set random_cooldown_until=now()+($3::int*interval '1 second')
     where telegram_id=$1 and session_id=$2 and random_cooldown_until is null
    returning 1`,[id,String(sid||''),seconds]);
  }
  if(q.rowCount>0)return seconds;
  return adCooldownRemainingV67(id,flow);
}
function putCooldownV67(payload,seconds){
  const target=payload&&typeof payload==='object'&&payload.data&&typeof payload.data==='object'?payload.data:payload;
  if(target&&typeof target==='object')target.cooldown_seconds=Math.max(0,Number(seconds||0));
  return payload;
}
function cooldownGuardV67(flow,startAction,completeAction){
  return async function(req,res,next){
    const action=String(req.body?.action||'');
    if(action!==startAction&&action!==completeAction)return next();
    let id;
    try{({id}=await edgeUser(req.body||{}))}catch{return next()}
    if(action===startAction){
      try{
        const left=await adCooldownRemainingV67(id,flow);
        if(left>0)return res.status(429).json({ok:false,error:flow==='spin'?'spin_ad_cooldown':'ad_cooldown',message:`Next ad available in ${left}s`,retry_after:left});
      }catch(e){console.error('v67_cooldown_check',flow,String(e?.message||e))}
      return next();
    }
    const sid=String(req.body?.session_id||'');
    const originalJson=res.json.bind(res);
    res.json=function(payload){
      if(!payload||payload.ok!==true)return originalJson(payload);
      return (async()=>{
        try{
          const seconds=await setAdCooldownV67(id,flow,sid);
          putCooldownV67(payload,seconds);
        }catch(e){console.error('v67_cooldown_set',flow,String(e?.message||e))}
        return originalJson(payload);
      })();
    };
    return next();
  }
}
function cooldownUsageV67(){
  return async function(req,res,next){
    if(String(req.body?.action||'status')!=='status')return next();
    let id;
    try{({id}=await edgeUser(req.body||{}))}catch{return next()}
    const originalJson=res.json.bind(res);
    res.json=function(payload){
      if(!payload||payload.ok!==true)return originalJson(payload);
      return (async()=>{
        try{putCooldownV67(payload,await adCooldownRemainingV67(id,'main'))}
        catch(e){console.error('v67_cooldown_status',String(e?.message||e))}
        return originalJson(payload);
      })();
    };
    return next();
  }
}
// === END WIENER RANDOM MAIN + SPIN AD COOLDOWN V67 ===

'''

positions=[s.index(main_route),s.index(usage_route),s.index(spin_route)]
pos=min(positions)
s=s[:pos]+helper+s[pos:]

# Install guards directly before the existing routes. Existing reward/session
# logic is left untouched.
s=s.replace(main_route,"app.use('/functions/v1/wiener-ad',cooldownGuardV67('main','start','complete'));\n"+main_route,1)
s=s.replace(usage_route,"app.use('/functions/v1/wiener-ad-usage',cooldownUsageV67());\n"+usage_route,1)
s=s.replace(spin_route,"app.use('/functions/v1/wiener-spin',cooldownGuardV67('spin','ad_start','ad_complete'));\n"+spin_route,1)

p.write_text(s)
print('V67 random main/spin ad cooldown patch installed')
PY

python3 /tmp/patch-v67-random-ad-cooldown.py
node --check "$BACKEND"

echo '=== RESTART ==='
pm2 restart wiener-api --update-env
sleep 3
pm2 status wiener-api
curl -fsS http://127.0.0.1:3000/health || curl -fsS http://127.0.0.1:3000/
echo
pm2 save >/dev/null

echo '=== VERIFY ==='
grep -q 'WIENER RANDOM MAIN + SPIN AD COOLDOWN V67' "$BACKEND"
grep -q "cooldownGuardV67('main','start','complete')" "$BACKEND"
grep -q "cooldownGuardV67('spin','ad_start','ad_complete')" "$BACKEND"
runuser -u postgres -- psql -d "$DB" -Atqc "select case when exists(select 1 from information_schema.columns where table_schema='public' and table_name='ad_sessions' and column_name='random_cooldown_until') and exists(select 1 from information_schema.columns where table_schema='public' and table_name='wiener_spin_ad_sessions' and column_name='random_cooldown_until') then 'cooldown_columns=ok' else 'cooldown_columns=missing' end"
echo 'main_adsgram_random_cooldown=10-20s'
echo 'spin_adsgram_random_cooldown=10-20s'
echo 'other_ad_flows=unchanged'
echo '=== V67 READY ==='
trap - ERR
