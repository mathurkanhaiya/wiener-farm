// Server time and a single active proof per referred user prevent instant/replayed claims.
export function advanceHomeProof(proof, sequence, now) {
  const gap=now-new Date(proof.last_seen_at).getTime();
  const elapsed=now-new Date(proof.started_at).getTime();
  if(!Number.isInteger(sequence)||sequence!==proof.sequence+1)throw Error('home_sequence_invalid');
  if(gap<1800)throw Error('home_pulse_too_early');
  if(gap>6000||elapsed>120000)throw Error('home_session_expired');
  return {sequence,ready:sequence>=5&&elapsed>=10000};
}

export function createReferralHomeHandler({pool,edgeUser,refUser,refReconcile,mandatoryCheck,randomToken}) {
  const eligible=async(id)=>{
    const u=await refUser(id);
    if(!u?.referred_by)return null;
    if(u.is_banned||u.device_blocked||u.referral_reward_eligible===false||String(u.referred_by)===String(id))throw Error('referral_ineligible');
    const r=(await pool.query('select * from public.referral_v2 where referred_user_id=$1',[id])).rows[0];
    if(!r)throw Error('device_check_required');
    if(r.vpn_blocked||r.status==='banned')throw Error('referral_ineligible');
    return r;
  };
  return async function(req,res,next){
    const b=req.body||{};
    if(!['home_start','home_pulse','home_cancel'].includes(b.action))return next();
    let c;
    try{
      const {id}=await edgeUser(b);
      if(b.action==='home_cancel'){
        await pool.query('delete from public.referral_home_v112 where referred_user_id=$1 and token=$2',[id,String(b.token||'')]);
        return res.json({ok:true,data:{cancelled:true}});
      }
      const row=await eligible(id);
      if(!row||row.join_rewarded_at)return res.json({ok:true,data:{done:true}});
      if(b.action==='home_start'){
        await mandatoryCheck(b);
        const token=randomToken();
        await pool.query(`insert into public.referral_home_v112(referred_user_id,token,started_at,last_seen_at,sequence)
          values($1,$2,clock_timestamp(),clock_timestamp(),0) on conflict(referred_user_id) do update
          set token=excluded.token,started_at=excluded.started_at,last_seen_at=excluded.last_seen_at,sequence=0`,[id,token]);
        return res.json({ok:true,data:{token,sequence:0}});
      }
      if(!/^[a-f0-9]{64}$/.test(String(b.token||'')))throw Error('home_token_invalid');
      c=await pool.connect();await c.query('begin');
      const proof=(await c.query('select *,clock_timestamp() as server_now from public.referral_home_v112 where referred_user_id=$1 and token=$2 for update',[id,b.token])).rows[0];
      if(!proof)throw Error('home_session_expired');
      const step=advanceHomeProof(proof,b.sequence,new Date(proof.server_now).getTime());
      if(step.ready){
        // Fresh server-side join check; a client all_joined flag is never accepted.
        await mandatoryCheck(b);
        await eligible(id);
        await c.query('update public.referral_v2 set join_home_verified_at=coalesce(join_home_verified_at,clock_timestamp()) where referred_user_id=$1',[id]);
        await c.query('delete from public.referral_home_v112 where referred_user_id=$1',[id]);
      }else await c.query('update public.referral_home_v112 set sequence=$2,last_seen_at=clock_timestamp() where referred_user_id=$1',[id,step.sequence]);
      await c.query('commit');c.release();c=null;
      if(step.ready){await refReconcile(id,{});return res.json({ok:true,data:{done:true}})}
      return res.json({ok:true,data:{sequence:step.sequence}});
    }catch(e){
      if(c){await c.query('rollback').catch(()=>{});c.release()}
      console.error('referral_home_v112',String(e?.message||e));
      return res.status(409).json({ok:false,error:'home_verification_pending'});
    }
  };
}
