// Fresh isolated Wiener Treasury V3. Inject this after `app` and `pool` exist.
// Uses the existing server-level `crypto` binding; do not import/redeclare crypto here.
const TV3_BLOCK='45064';
function tv3Auth(raw){
  const token=String(process.env.BOT_TOKEN||process.env.TELEGRAM_BOT_TOKEN||process.env.TELEGRAM_TOKEN||'');
  if(!token||!raw)return 0;
  const p=new URLSearchParams(raw), got=p.get('hash')||''; p.delete('hash');
  const check=[...p.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n');
  const key=crypto.createHmac('sha256','WebAppData').update(token).digest();
  const want=crypto.createHmac('sha256',key).update(check).digest('hex');
  try{if(!crypto.timingSafeEqual(Buffer.from(got,'hex'),Buffer.from(want,'hex')))return 0}catch{return 0}
  const auth=Number(p.get('auth_date')||0); if(!auth||Math.abs(Date.now()/1000-auth)>86400)return 0;
  try{return Number(JSON.parse(p.get('user')||'{}').id)||0}catch{return 0}
}
async function tv3Status(uid,db=pool){
  await db.query(`insert into public.treasury_v3_accounts(telegram_id) values($1) on conflict do nothing`,[uid]);
  const a=(await db.query(`select points,keys from public.treasury_v3_accounts where telegram_id=$1`,[uid])).rows[0];
  const views=Number((await db.query(`select count(*) n from public.treasury_v3_sessions where telegram_id=$1 and created_at>=date_trunc('day',now() at time zone 'utc')`,[uid])).rows[0].n||0);
  const keysToday=Number((await db.query(`select count(*) n from public.treasury_v3_events where telegram_id=$1 and key_added=true and created_at>=date_trunc('day',now() at time zone 'utc')`,[uid])).rows[0].n||0);
  const recent=(await db.query(`select reward,created_at from public.treasury_v3_opens where telegram_id=$1 order by created_at desc limit 5`,[uid])).rows;
  return {points:Number(a.points),keys:Number(a.keys),points_per_key:5,keys_today:keysToday,daily_key_limit:5,attempts_today:views,daily_attempt_limit:25,cooldown_seconds:0,block_id:TV3_BLOCK,recent};
}
app.get('/treasury-v3-reward',async(req,res)=>{
  const uid=Number(req.query?.userId||0); if(!Number.isSafeInteger(uid)||uid<=0)return res.status(400).send('bad_user');
  const c=await pool.connect();
  try{await c.query('begin');
    const s=(await c.query(`select id from public.treasury_v3_sessions where telegram_id=$1 and status in ('pending','client_done') and expires_at>now() order by created_at desc limit 1 for update skip locked`,[uid])).rows[0];
    if(!s){await c.query('rollback');return res.status(204).end()}
    await c.query(`insert into public.treasury_v3_accounts(telegram_id) values($1) on conflict do nothing`,[uid]);
    const a=(await c.query(`select points,keys from public.treasury_v3_accounts where telegram_id=$1 for update`,[uid])).rows[0];
    let points=Number(a.points)+1, addKey=false; if(points>=5){points-=5;addKey=true}
    await c.query(`update public.treasury_v3_accounts set points=$2,keys=keys+$3,updated_at=now() where telegram_id=$1`,[uid,points,addKey?1:0]);
    await c.query(`update public.treasury_v3_sessions set status='credited',credited_at=now() where id=$1`,[s.id]);
    await c.query(`insert into public.treasury_v3_events(telegram_id,session_id,points,key_added) values($1,$2,1,$3)`,[uid,s.id,addKey]);
    await c.query('commit'); return res.status(200).send('OK');
  }catch(e){await c.query('rollback').catch(()=>{});console.error('treasury-v3-callback',e);return res.status(500).send('error')}finally{c.release()}
});
app.post('/functions/v1/wiener-treasury-v3',async(req,res)=>{
 try{const b=req.body||{},uid=tv3Auth(String(b.initData||''));if(!uid)return res.status(401).json({ok:false,error:'telegram_required'});const action=String(b.action||'status');
  if(action==='status')return res.json({ok:true,data:await tv3Status(uid)});
  if(action==='ad_start'){
    const st=await tv3Status(uid);if(st.keys_today>=5)return res.status(429).json({ok:false,error:'daily_key_limit'});if(st.attempts_today>=25)return res.status(429).json({ok:false,error:'daily_attempt_limit'});
    await pool.query(`update public.treasury_v3_sessions set status='expired' where telegram_id=$1 and status in ('pending','client_done')`,[uid]);
    const s=(await pool.query(`insert into public.treasury_v3_sessions(telegram_id,block_id,status,expires_at) values($1,$2,'pending',now()+interval '10 minutes') returning id`,[uid,TV3_BLOCK])).rows[0];
    return res.json({ok:true,data:{session_id:s.id,block_id:TV3_BLOCK}})
  }
  if(action==='ad_complete'){
    const sid=String(b.session_id||'');const q=await pool.query(`update public.treasury_v3_sessions set status=case when status='pending' then 'client_done' else status end,client_completed_at=now() where id=$1 and telegram_id=$2 returning status`,[sid,uid]);
    if(!q.rowCount)return res.status(404).json({ok:false,error:'session_not_found'});return res.json({ok:true,data:{status:q.rows[0].status}})
  }
  if(action==='open'){
    const rid=String(b.request_id||'');if(!/^[0-9a-f-]{36}$/i.test(rid))return res.status(400).json({ok:false,error:'invalid_request_id'});const c=await pool.connect();
    try{await c.query('begin');const old=(await c.query(`select reward from public.treasury_v3_opens where request_id=$1 and telegram_id=$2`,[rid,uid])).rows[0];if(old){await c.query('commit');return res.json({ok:true,data:{reward:Number(old.reward)}})}
      await c.query(`insert into public.treasury_v3_accounts(telegram_id) values($1) on conflict do nothing`,[uid]);const a=(await c.query(`select keys from public.treasury_v3_accounts where telegram_id=$1 for update`,[uid])).rows[0];if(Number(a.keys)<1){await c.query('rollback');return res.status(409).json({ok:false,error:'no_keys'})}
      const n=crypto.randomInt(1000);let reward=n<500?5:n<750?10:n<900?25:n<970?50:n<995?100:500;await c.query(`update public.treasury_v3_accounts set keys=keys-1,updated_at=now() where telegram_id=$1`,[uid]);await c.query(`insert into public.treasury_v3_opens(request_id,telegram_id,reward) values($1,$2,$3)`,[rid,uid,reward]);const u=await c.query(`update public.users set balance=coalesce(balance,0)+$2,total_earned=coalesce(total_earned,0)+$2 where telegram_id=$1`,[uid,reward]);if(!u.rowCount)throw Error('user_not_found');await c.query('commit');return res.json({ok:true,data:{reward}})
    }catch(e){await c.query('rollback').catch(()=>{});throw e}finally{c.release()}
  }
  return res.status(400).json({ok:false,error:'invalid_action'});
 }catch(e){console.error('treasury-v3',e);return res.status(500).json({ok:false,error:'temporary_error'})}
});
