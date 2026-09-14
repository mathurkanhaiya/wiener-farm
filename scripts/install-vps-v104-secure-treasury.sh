#!/usr/bin/env bash
set -euo pipefail
cd /opt/wiener-code
git fetch origin main
git reset --hard origin/main
SERVER=/opt/wiener-backend/server.mjs
[ -f "$SERVER" ] || SERVER=/opt/wiener-backend/server.js
[ -f "$SERVER" ] || { echo 'Wiener backend server not found'; exit 1; }
cp "$SERVER" "$SERVER.v104-$(date +%Y%m%d-%H%M%S).bak"
install -d -m 700 /etc/wiener-farm
SECRET_FILE=/etc/wiener-farm/treasury.env
if [ ! -s "$SECRET_FILE" ]; then
  umask 077
  printf 'TREASURY_SERVER_SECRET=%s\n' "$(openssl rand -hex 48)" > "$SECRET_FILE"
  printf 'TREASURY_ADSGRAM_BLOCK_ID=%s\n' "${TREASURY_ADSGRAM_BLOCK_ID:-int-44228}" >> "$SECRET_FILE"
fi
set -a
. "$SECRET_FILE"
set +a
runuser -u postgres -- psql -d wiener_farm_final -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
CREATE TABLE IF NOT EXISTS public.treasury_accounts(
 telegram_id bigint PRIMARY KEY,
 keys integer NOT NULL DEFAULT 0 CHECK(keys>=0),
 points integer NOT NULL DEFAULT 0 CHECK(points>=0),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.treasury_ad_sessions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 telegram_id bigint NOT NULL,
 status text NOT NULL DEFAULT 'started' CHECK(status IN('started','credited','expired','rejected')),
 started_at timestamptz NOT NULL DEFAULT now(),
 eligible_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL,
 credited_at timestamptz,
 reward_day date NOT NULL DEFAULT (now() at time zone 'utc')::date
);
CREATE UNIQUE INDEX IF NOT EXISTS treasury_one_open_ad ON public.treasury_ad_sessions(telegram_id) WHERE status='started';
CREATE INDEX IF NOT EXISTS treasury_ad_daily_idx ON public.treasury_ad_sessions(telegram_id,reward_day,status);
CREATE TABLE IF NOT EXISTS public.treasury_key_events(
 id bigserial PRIMARY KEY, telegram_id bigint NOT NULL, source text NOT NULL,
 points integer NOT NULL DEFAULT 0, key_added integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS treasury_key_daily_idx ON public.treasury_key_events(telegram_id,created_at);
CREATE TABLE IF NOT EXISTS public.treasury_chest_opens(
 id bigserial PRIMARY KEY, request_id uuid NOT NULL UNIQUE, telegram_id bigint NOT NULL,
 reward numeric NOT NULL CHECK(reward>=0), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS treasury_open_user_idx ON public.treasury_chest_opens(telegram_id,created_at DESC);
COMMIT;
SQL
python3 - <<'PY'
from pathlib import Path
p=Path('/opt/wiener-backend/server.mjs')
if not p.exists(): p=Path('/opt/wiener-backend/server.js')
s=p.read_text()
marker='// V104 SECURE WIENER TREASURY'
if marker not in s:
 code=r'''

// V104 SECURE WIENER TREASURY
app.post('/functions/v1/wiener-treasury',async(req,res)=>{
 try{
  const b=req.body||{}, action=String(b.action||'status');
  const auth=await requireTelegram(req,res); if(!auth)return;
  const uid=Number(auth.id||auth.telegram_id||0); if(!uid)return res.status(401).json({ok:false,error:'telegram_required'});
  if(!['status','ad_start','ad_complete','open'].includes(action))return res.status(400).json({ok:false,error:'invalid_request'});
  const {createHmac,timingSafeEqual,randomInt}=await import('node:crypto');
  const secret=String(process.env.TREASURY_SERVER_SECRET||'');
  if(secret.length<48){console.error('treasury: TREASURY_SERVER_SECRET missing/weak');return res.status(503).json({ok:false,error:'treasury_not_configured'})}
  const blockId=String(process.env.TREASURY_ADSGRAM_BLOCK_ID||'int-44228');
  const pointsPerKey=5,dailyKeyLimit=5,dailyAttemptLimit=25,cooldownSeconds=20;
  const daySql=`(now() at time zone 'utc')::date`;
  const sign=(sid,exp)=>createHmac('sha256',secret).update(`${sid}:${uid}:${exp}`).digest('hex');
  const safeEq=(a,b)=>{try{const x=Buffer.from(String(a),'hex'),y=Buffer.from(String(b),'hex');return x.length===y.length&&x.length===32&&timingSafeEqual(x,y)}catch{return false}};
  const status=async()=>{
   await pool.query(`insert into public.treasury_accounts(telegram_id) values($1) on conflict do nothing`,[uid]);
   const a=(await pool.query(`select keys,points from public.treasury_accounts where telegram_id=$1`,[uid])).rows[0]||{};
   const keysToday=Number((await pool.query(`select coalesce(sum(key_added),0) n from public.treasury_key_events where telegram_id=$1 and created_at>=date_trunc('day',now() at time zone 'utc') at time zone 'utc'`,[uid])).rows[0]?.n||0);
   const attempts=Number((await pool.query(`select count(*) n from public.treasury_ad_sessions where telegram_id=$1 and reward_day=${daySql}`,[uid])).rows[0]?.n||0);
   const last=(await pool.query(`select credited_at from public.treasury_ad_sessions where telegram_id=$1 and status='credited' order by credited_at desc limit 1`,[uid])).rows[0];
   const cd=last?.credited_at?Math.max(0,Math.ceil((new Date(last.credited_at).getTime()+cooldownSeconds*1000-Date.now())/1000)):0;
   const recent=(await pool.query(`select reward,created_at from public.treasury_chest_opens where telegram_id=$1 order by created_at desc limit 5`,[uid])).rows;
   return {keys:Number(a.keys||0),points:Number(a.points||0),points_per_key:pointsPerKey,keys_today:keysToday,daily_key_limit:dailyKeyLimit,attempts_today:attempts,daily_attempt_limit:dailyAttemptLimit,cooldown_seconds:cd,block_id:blockId,recent};
  };
  if(action==='status')return res.json({ok:true,data:await status()});
  if(action==='ad_start'){
   const st=await status();
   if(st.keys_today>=dailyKeyLimit)return res.status(429).json({ok:false,error:'daily_key_limit'});
   if(st.attempts_today>=dailyAttemptLimit)return res.status(429).json({ok:false,error:'daily_attempt_limit'});
   if(st.cooldown_seconds>0)return res.status(429).json({ok:false,error:'cooldown',message:`Next Treasury ad in ${st.cooldown_seconds}s`});
   await pool.query(`update public.treasury_ad_sessions set status='expired' where telegram_id=$1 and status='started' and expires_at<=now()`,[uid]);
   let q=(await pool.query(`select id,extract(epoch from expires_at)::bigint exp from public.treasury_ad_sessions where telegram_id=$1 and status='started' limit 1`,[uid])).rows[0];
   if(!q){q=(await pool.query(`insert into public.treasury_ad_sessions(telegram_id,eligible_at,expires_at) values($1,now()+interval '12 seconds',now()+interval '10 minutes') returning id,extract(epoch from expires_at)::bigint exp`,[uid])).rows[0]}
   const exp=Number(q.exp);return res.json({ok:true,data:{session_id:q.id,proof:sign(q.id,exp),block_id:blockId}});
  }
  if(action==='ad_complete'){
   const sid=String(b.session_id||''),proof=String(b.proof||'');
   if(!/^[0-9a-f-]{36}$/i.test(sid)||!/^[0-9a-f]{64}$/i.test(proof))return res.status(400).json({ok:false,error:'invalid_proof'});
   const c=await pool.connect();try{
    await c.query('begin');
    const q=(await c.query(`select *,extract(epoch from expires_at)::bigint exp from public.treasury_ad_sessions where id=$1 and telegram_id=$2 for update`,[sid,uid])).rows[0];
    if(!q){await c.query('rollback');return res.status(404).json({ok:false,error:'session_not_found'})}
    if(!safeEq(proof,sign(sid,Number(q.exp)))){await c.query('rollback');return res.status(403).json({ok:false,error:'invalid_proof'})}
    if(q.status==='credited'){await c.query('commit');return res.json({ok:true,data:{status:'credited',key_added:0,cooldown_seconds:cooldownSeconds}})}
    if(q.status!=='started'||new Date(q.expires_at)<=new Date()){await c.query(`update public.treasury_ad_sessions set status='expired' where id=$1 and status='started'`,[sid]);await c.query('commit');return res.status(409).json({ok:false,error:'session_expired'})}
    if(new Date(q.eligible_at)>new Date()){await c.query('rollback');return res.status(409).json({ok:false,error:'verification_pending',message:'Ad completion is still verifying.'})}
    const kt=Number((await c.query(`select coalesce(sum(key_added),0) n from public.treasury_key_events where telegram_id=$1 and created_at>=date_trunc('day',now() at time zone 'utc') at time zone 'utc'`,[uid])).rows[0]?.n||0);
    if(kt>=dailyKeyLimit){await c.query('rollback');return res.status(429).json({ok:false,error:'daily_key_limit'})}
    await c.query(`insert into public.treasury_accounts(telegram_id) values($1) on conflict do nothing`,[uid]);
    const a=(await c.query(`select keys,points from public.treasury_accounts where telegram_id=$1 for update`,[uid])).rows[0];
    const before=Number(a.points||0),total=before+1,keyAdded=total>=pointsPerKey?1:0,after=keyAdded?total-pointsPerKey:total;
    await c.query(`update public.treasury_accounts set points=$2,keys=keys+$3,updated_at=now() where telegram_id=$1`,[uid,after,keyAdded]);
    await c.query(`insert into public.treasury_key_events(telegram_id,source,points,key_added) values($1,'treasury_ad',1,$2)`,[uid,keyAdded]);
    await c.query(`update public.treasury_ad_sessions set status='credited',credited_at=now() where id=$1`,[sid]);
    await c.query('commit');return res.json({ok:true,data:{status:'credited',points:after,key_added:keyAdded,cooldown_seconds:cooldownSeconds}});
   }catch(e){await c.query('rollback').catch(()=>{});throw e}finally{c.release()}
  }
  const rid=String(b.request_id||'');if(!/^[0-9a-f-]{36}$/i.test(rid))return res.status(400).json({ok:false,error:'invalid_request_id'});
  const c=await pool.connect();try{
   await c.query('begin');
   const old=(await c.query(`select reward from public.treasury_chest_opens where request_id=$1 and telegram_id=$2`,[rid,uid])).rows[0];
   if(old){await c.query('commit');return res.json({ok:true,data:{reward:Number(old.reward),idempotent:true}})}
   await c.query(`insert into public.treasury_accounts(telegram_id) values($1) on conflict do nothing`,[uid]);
   const a=(await c.query(`select keys from public.treasury_accounts where telegram_id=$1 for update`,[uid])).rows[0];
   if(Number(a.keys||0)<1){await c.query('rollback');return res.status(409).json({ok:false,error:'no_keys'})}
   const roll=randomInt(1000);let reward=5;if(roll>=500)reward=10;if(roll>=750)reward=25;if(roll>=900)reward=50;if(roll>=970)reward=100;if(roll>=995)reward=500;
   await c.query(`update public.treasury_accounts set keys=keys-1,updated_at=now() where telegram_id=$1`,[uid]);
   await c.query(`insert into public.treasury_chest_opens(request_id,telegram_id,reward) values($1,$2,$3)`,[rid,uid,reward]);
   const u=await c.query(`update public.users set balance=coalesce(balance,0)+$2,total_earned=coalesce(total_earned,0)+$2 where telegram_id=$1`,[uid,reward]);
   if(!u.rowCount)throw new Error('user_not_found');
   await c.query(`insert into public.transactions(telegram_id,type,amount,description) values($1,'treasury_reward',$2,'Wiener Treasury chest')`,[uid,reward]).catch(()=>{});
   await c.query('commit');return res.json({ok:true,data:{reward}});
  }catch(e){await c.query('rollback').catch(()=>{});throw e}finally{c.release()}
 }catch(e){console.error('treasury-v104',e);return res.status(500).json({ok:false,error:'temporary_error'})}
});
'''
 pos=-1
 for needle in ['app.listen(','server.listen(']:
  pos=s.rfind(needle)
  if pos>=0: break
 s=s[:pos]+code+'\n'+s[pos:] if pos>=0 else s+code
 p.write_text(s)
PY
node --check "$SERVER"
npm run build
pm2 restart wiener-api --update-env
pm2 save >/dev/null 2>&1 || true
sleep 2
curl -fsS http://127.0.0.1:3000/health
echo
echo 'V104 secure Wiener Treasury installed.'
echo 'Server secret: /etc/wiener-farm/treasury.env (root-only; never expose it to frontend).'
