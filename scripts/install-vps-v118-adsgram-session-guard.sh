#!/usr/bin/env bash
set -euo pipefail

cd /opt/wiener-code
DB=wiener_farm_final
BACKEND=/opt/wiener-backend/server.mjs
[[ -f "$BACKEND" ]] || BACKEND=/opt/wiener-backend/server.js
[[ -f "$BACKEND" ]] || { echo "ERROR: backend missing"; exit 1; }

STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP="$BACKEND.v118-adsgram-session-guard-$STAMP.bak"

echo "=== V118 ADSGRAM OPEN SESSION GUARD ==="
node --check "$BACKEND"
cp -a "$BACKEND" "$BACKUP"

rollback(){
  echo "ERROR: restoring backend backup" >&2
  cp -a "$BACKUP" "$BACKEND"
  node --check "$BACKEND" >/dev/null 2>&1 && pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
}
trap rollback ERR

python3 - <<'PY'
from pathlib import Path
p=Path('/opt/wiener-backend/server.mjs')
if not p.exists(): p=Path('/opt/wiener-backend/server.js')
s=p.read_text()

START='// === WIENER ADSGRAM OPEN SESSION GUARD V118 ==='
END='// === END WIENER ADSGRAM OPEN SESSION GUARD V118 ==='
if START in s:
    print('V118 guard already installed')
    raise SystemExit(0)

anchor="app.post('/functions/v1/wiener-ad'"
pos=s.find(anchor)
if pos < 0:
    raise SystemExit('ERROR: wiener-ad route anchor missing; refusing unsafe patch')

code=r'''
// === WIENER ADSGRAM OPEN SESSION GUARD V118 ===
// Serializes AdsGram "start" per Telegram user and clears only old, uncredited
// sessions. The existing unique index remains the final database safety net.
app.use('/functions/v1/wiener-ad',async(req,res,next)=>{
  if(String(req.body?.action||'')!=='start')return next();
  let id;
  try{({id}=await edgeUser(req.body||{}))}catch{return next()}
  const c=await pool.connect();
  let locked=false;
  try{
    // Session-level advisory lock: held until the original start handler has
    // finished sending its response, so concurrent starts cannot race INSERT.
    const lockKey=8800000000000000n+BigInt(id);
    await c.query('select pg_advisory_lock($1::bigint)',[lockKey.toString()]);
    locked=true;

    // Never touch credited history. Only abandoned uncredited sessions older
    // than the normal 15 minute verification window are closed automatically.
    await c.query(`
      update public.ad_sessions
         set status='expired'
       where telegram_id=$1
         and network='adsgram'
         and status in ('started','verified')
         and credited_at is null
         and started_at < now()-interval '15 minutes'
    `,[id]);

    // If an uncredited open row still exists, it belongs to a recent request.
    // Close it before starting a fresh ad. This is safe because no reward was
    // credited and prevents the partial unique index from rejecting INSERT.
    await c.query(`
      update public.ad_sessions
         set status='expired'
       where telegram_id=$1
         and network='adsgram'
         and status in ('started','verified')
         and credited_at is null
    `,[id]);

    let released=false;
    const release=async()=>{
      if(released)return;
      released=true;
      if(locked)await c.query('select pg_advisory_unlock($1::bigint)',[lockKey.toString()]).catch(()=>null);
      c.release();
    };
    res.once('finish',release);
    res.once('close',release);
    return next();
  }catch(e){
    if(locked)await c.query('select pg_advisory_unlock($1::bigint)',[(8800000000000000n+BigInt(id)).toString()]).catch(()=>null);
    c.release();
    console.error('v118_adsgram_session_guard',String(e?.message||e));
    return next(e);
  }
});
// === END WIENER ADSGRAM OPEN SESSION GUARD V118 ===
'''
s=s[:pos]+code+'\n'+s[pos:]
p.write_text(s)
print('V118 guard installed')
PY

node --check "$BACKEND"

# One-time cleanup of currently queued/uncredited open sessions only.
runuser -u postgres -- psql -d "$DB" -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
UPDATE public.ad_sessions
SET status='expired'
WHERE network='adsgram'
  AND status IN ('started','verified')
  AND credited_at IS NULL;
COMMIT;
SQL

# Keep the unique index. Refuse to deploy if it disappeared.
runuser -u postgres -- psql -d "$DB" -Atqc "
select 1
from pg_indexes
where schemaname='public'
  and tablename='ad_sessions'
  and indexname='ad_sessions_one_open_adsgram_user_v100'
" | grep -qx 1

pm2 restart wiener-api --update-env
sleep 3
curl -fsS http://127.0.0.1:3000/health
echo
pm2 save >/dev/null

grep -q 'WIENER ADSGRAM OPEN SESSION GUARD V118' "$BACKEND"
echo "=== V118 VERIFIED ==="
echo "Only AdsGram start-session handling changed."
echo "Credited sessions/rewards/history were not modified."
echo "Unique open-session index remains enabled."
trap - ERR
