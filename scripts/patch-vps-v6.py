from pathlib import Path

p=Path('/opt/wiener-backend/server.mjs')
s=p.read_text()
if 'WIENER VPS ROUTES V6' in s:
    print('V6 already installed')
    raise SystemExit(0)

stub="""app.post('/functions/v1/wiener-ambassador-publish',async(req,res)=>{try{const b=req.body||{}, {id}=await edgeUser(b);if(String(b.action||'publish')!=='publish')throw new Error('unknown_action');if(!await ambassadorAdminV4(id))throw new Error('admin_forbidden');/* keep provider-side posting on Supabase until bot broadcast worker is ported */return res.status(503).json({ok:false,error:'vps_publish_worker_pending'})}catch(e){return edgeFail(res,e)}});"""

publisher=r"""app.post('/functions/v1/wiener-ambassador-publish',async(req,res)=>{
  try{
    const b=req.body||{}, {id}=await edgeUser(b);
    if(String(b.action||'publish')!=='publish') throw new Error('unknown_action');
    if(!await ambassadorAdminV4(id)) throw new Error('admin_forbidden');

    const settings=(await pool.query(`select commission_per_valid_claim_usdt,min_subscribers,promo_reward_wiener from public.ambassador_settings where id=true limit 1`)).rows[0];
    await rpc('expire_ambassador_promos',[]).catch(()=>null);
    const broadcastId=String(await rpc('reserve_ambassador_broadcast',[id]));
    const targets=(await pool.query(`select * from public.ambassadors where status in ('active','approved') and bot_is_admin=true and bot_can_post=true and subscriber_count >= $1 order by approved_at`,[num(settings?.min_subscribers)])).rows;
    const reward=num(settings?.promo_reward_wiener)||10;
    await pool.query(`update public.ambassador_broadcasts set channels_targeted=$2,codes_per_channel=1,reward_wiener=$3 where id=$1`,[broadcastId,targets.length,reward]);
    const me=await telegramApi('getMe',{});

    async function uniqueCodeV6(){
      for(let i=0;i<8;i++){
        const c='AMB'+crypto.randomUUID().replace(/-/g,'').slice(0,7).toUpperCase();
        const q=await pool.query(`select code from public.promo_codes where code=$1 limit 1`,[c]);
        if(!q.rows.length) return c;
      }
      throw new Error('promo_code_generation_failed');
    }

    async function makeCodeV6(a){
      const c=await uniqueCodeV6();
      const exp=new Date(Date.now()+24*60*60*1000).toISOString();
      await pool.query(`insert into public.promo_codes(code,reward,max_claims,claims_count,expires_at,enabled,created_by,note,reward_type) values($1,$2,100,0,$3,true,null,$4,'wiener')`,[c,reward,exp,`ambassador:${a.id}:broadcast:${broadcastId}`]);
      try{
        await pool.query(`insert into public.ambassador_promos(ambassador_id,code,reward_wiener,max_claims,commission_per_claim_usdt,expires_at,status) values($1,$2,$3,100,$4,$5,'active')`,[a.id,c,reward,num(settings?.commission_per_valid_claim_usdt),exp]);
      }catch(e){await pool.query(`delete from public.promo_codes where code=$1`,[c]);throw e}
      return {code:c,expires_at:exp};
    }

    const rows=[];
    for(const a of targets){
      let made=null;
      try{
        const bm=await telegramApi('getChatMember',{chat_id:a.channel_id,user_id:me.id});
        if(!['creator','administrator'].includes(bm?.status)||(bm.status==='administrator'&&bm.can_post_messages!==true)) throw new Error('bot_post_permission_missing');
        made=await makeCodeV6(a);
        const caption=`👤 First 100 Active Users Only!\n🎁 Reward: ${reward} WIENER\n\n🎟 Claim Code: <code>${made.code}</code>\n\n⏳ Expires in 24 hours\n🔥 Redeem your code before all rewards are claimed!`;
        const msg=await telegramApi('sendPhoto',{chat_id:a.channel_id,photo:'https://wiener-farm.vercel.app/api/host/promo-code',caption,parse_mode:'HTML',reply_markup:{inline_keyboard:[[{text:'🚀 OPEN WIENER FARM',url:'https://t.me/WienerDogeFarmBot/app'}]]}});
        await pool.query(`insert into public.ambassador_broadcast_items(broadcast_id,ambassador_id,channel_id,channel_username,channel_title,code_1,code_2,message_id,status,posted_at) values($1,$2,$3,$4,$5,$6,null,$7,'posted',now())`,[broadcastId,a.id,a.channel_id,a.channel_username,a.channel_title,made.code,msg.message_id]);
        await pool.query(`update public.ambassadors set bot_is_admin=true,bot_can_post=true,last_channel_check_at=now(),updated_at=now() where id=$1`,[a.id]);
        rows.push({ok:true,channel:a.channel_username,codes:1});
      }catch(e){
        const reason=String(e?.message||e).slice(0,500);
        if(made?.code){await pool.query(`update public.promo_codes set enabled=false where code=$1`,[made.code]);await pool.query(`update public.ambassador_promos set status='paused' where code=$1`,[made.code])}
        if(/not enough rights|administrator|chat not found|kicked|forbidden|bot_post_permission_missing/i.test(reason)) await pool.query(`update public.ambassadors set bot_is_admin=false,bot_can_post=false,last_channel_check_at=now(),updated_at=now() where id=$1`,[a.id]);
        await pool.query(`insert into public.ambassador_broadcast_items(broadcast_id,ambassador_id,channel_id,channel_username,channel_title,code_1,code_2,status,error) values($1,$2,$3,$4,$5,$6,null,'failed',$7)`,[broadcastId,a.id,a.channel_id,a.channel_username,a.channel_title,made?.code||null,reason]).catch(()=>null);
        rows.push({ok:false,channel:a.channel_username||String(a.channel_id),reason,codes:0});
      }
    }
    const posted=rows.filter(x=>x.ok).length,failed=rows.length-posted,codesCreated=rows.reduce((z,x)=>z+num(x.codes),0),failures=rows.filter(x=>!x.ok).map(x=>`${x.channel}: ${x.reason}`).slice(0,20);
    const status=targets.length===0?'failed':failed===0?'completed':posted>0?'partial':'failed';
    await pool.query(`update public.ambassador_broadcasts set status=$2,channels_posted=$3,channels_failed=$4,codes_created=$5,error_summary=$6,completed_at=now() where id=$1`,[broadcastId,status,posted,failed,codesCreated,failures.join('\n')||null]);
    return res.json({ok:true,data:{broadcast_id:broadcastId,status,channels_targeted:targets.length,channels_posted:posted,channels_failed:failed,codes_created:codesCreated,failures}});
  }catch(e){return edgeFail(res,e)}
});"""

if stub not in s:
    raise SystemExit('ERROR: ambassador publish stub not found')
s=s.replace(stub,publisher,1)

marker="\napp.use((_req,res)=>\n  res.status(404).json({ok:false,error:'route_not_enabled_yet'})\n);\n"
if marker not in s:
    raise SystemExit('ERROR: insertion marker not found')

promo=r'''
// === WIENER VPS ROUTES V6 ===
function promoFmtV6(v){const x=num(v);return Number.isInteger(x)?String(x):x.toFixed(2).replace(/0+$/,'').replace(/\.$/,'')}
function promoRenderV6(p){const used=num(p.claims_count),max=p.max_claims==null?null:num(p.max_claims),full=max!=null&&used>=max,expired=!!p.expires_at&&new Date(p.expires_at)<=new Date(),active=p.enabled&&!full&&!expired,almost=max!=null&&!full&&max>0&&used/max>=.8,type=String(p.reward_type||'wiener');let title='🎁 WIENER Promo Drop',reward=`+${promoFmtV6(p.reward)} WIENER`,extra='Open WIENER Farm and claim it before it’s gone.';if(type==='treasury_point'){title='🎁 Treasury Points Promo';reward=`+${promoFmtV6(p.reward)} Treasury Point${num(p.reward)===1?'':'s'}`;extra='Collect 5 Treasury Points = 1 Treasury Key 🔑'}else if(type==='treasury_key'){title='🔑 Treasury Key Drop';reward=`+${promoFmtV6(p.reward)} Treasury Key${num(p.reward)===1?'':'s'}`;extra='Open the WIENER Treasury and try your luck.'}return{text:`${title}\n\nCode: ${p.code}\nReward: ${reward}\nClaims: ${used} / ${max==null?'∞':max}\nStatus: ${active?'🟢 Active':full?'🔴 Fully Claimed':expired?'⚫ Expired':'⏸ Disabled'}${almost?'\n⚡ Almost gone':''}\n\n${extra}\n\n🌭 WIENER Farm`,markup:active?{inline_keyboard:[[{text:'🎁 CLAIM PROMO',url:'https://t.me/WienerDogeFarmBot?startapp'}]]}:{inline_keyboard:[]}}}
async function promoSyncV6(code){const q=await pool.query(`select * from public.promo_codes where code=$1 limit 1`,[code]);if(!q.rows[0])return;const posts=(await pool.query(`select chat_id,message_id from public.promo_channel_posts where code=$1`,[code])).rows;if(!posts.length)return;const r=promoRenderV6(q.rows[0]);for(const row of posts){try{await telegramApi('editMessageText',{chat_id:row.chat_id,message_id:row.message_id,text:r.text,disable_web_page_preview:true,reply_markup:r.markup});await pool.query(`update public.promo_channel_posts set updated_at=now() where code=$1 and chat_id=$2`,[code,row.chat_id])}catch(e){console.error('promo_sync',String(e?.message||e))}}}
async function promoFinalizeV6(id,sid){const data=await rpc('finalize_promo_reward_if_ready',[id,sid]);if(data?.status==='credited'&&data?.code)await promoSyncV6(String(data.code));return data}
async function promoValidateV6(id,code){const st=(await pool.query(`select promo_enabled,adsgram_block_id,maintenance_enabled from public.app_settings where id=true limit 1`)).rows[0];if(st?.maintenance_enabled)throw new Error('maintenance');if(!st?.promo_enabled)throw new Error('promo_disabled');if(!st?.adsgram_block_id)throw new Error('adsgram_not_configured');const c=String(code||'').trim().toUpperCase(),p=(await pool.query(`select * from public.promo_codes where code=$1 limit 1`,[c])).rows[0];if(!p)throw new Error('invalid_code');if(!p.enabled)throw new Error('code_disabled');if(p.expires_at&&new Date(p.expires_at)<=new Date())throw new Error('code_expired');if(p.max_claims!=null&&num(p.claims_count)>=num(p.max_claims))throw new Error('claim_limit_reached');if((await pool.query(`select id from public.promo_claims where code=$1 and telegram_id=$2 limit 1`,[c,id])).rows.length)throw new Error('already_claimed');return{promo:p,blockId:String(st.adsgram_block_id)}}
app.post('/functions/v1/wiener-promo',async(req,res)=>{try{const b=req.body||{}, {id}=await edgeUser(b),action=String(b.action||'');if(action==='start'){const code=String(b.code||'').trim().toUpperCase(),v=await promoValidateV6(id,code);await pool.query(`update public.promo_ad_sessions set status='expired' where telegram_id=$1 and status in ('pending','verified')`,[id]);const q=await pool.query(`insert into public.promo_ad_sessions(telegram_id,code,status,reward_snapshot,block_id) values($1,$2,'pending',$3,$4) returning id,code,status,created_at,reward_snapshot,block_id`,[id,code,v.promo.reward,v.blockId]);const x=q.rows[0];return res.json({ok:true,data:{session_id:x.id,code:x.code,reward:x.reward_snapshot,reward_type:v.promo.reward_type||'wiener',block_id:x.block_id}})}if(action==='client_complete'){const sid=String(b.session_id||''),q=await pool.query(`select id,status,created_at from public.promo_ad_sessions where id=$1 and telegram_id=$2 limit 1`,[sid,id]),x=q.rows[0];if(!x)throw new Error('promo_session_not_found');if(x.status==='credited')return res.json({ok:true,data:await promoFinalizeV6(id,sid)});if(Date.now()-new Date(x.created_at).getTime()>15*60000)throw new Error('promo_session_expired');await pool.query(`update public.promo_ad_sessions set client_completed_at=coalesce(client_completed_at,now()) where id=$1`,[sid]);return res.json({ok:true,data:await promoFinalizeV6(id,sid)})}if(action==='status'){const sid=String(b.session_id||''),q=await pool.query(`select * from public.promo_ad_sessions where id=$1 and telegram_id=$2 limit 1`,[sid,id]);if(!q.rows[0])throw new Error('promo_session_not_found');let result=null;if(q.rows[0].status!=='credited'&&q.rows[0].client_completed_at)result=await promoFinalizeV6(id,sid);const fresh=(await pool.query(`select id,status,code,reward_snapshot,client_completed_at,callback_received_at,credited_at from public.promo_ad_sessions where id=$1`,[sid])).rows[0];return res.json({ok:true,data:{...fresh,result}})}throw new Error('unknown_action')}catch(e){return edgeFail(res,e)}});
app.get('/functions/v1/wiener-promo/reward',async(req,res)=>{try{const id=num(req.query.userId||req.query.userid),secret=String(req.query.secret||'');if(!id||!secret)return res.status(403).json({ok:false,error:'forbidden'});const st=(await pool.query(`select adsgram_reward_secret_hash from public.app_settings where id=true limit 1`)).rows[0],dig=crypto.createHash('sha256').update(secret).digest('hex');if(!st?.adsgram_reward_secret_hash||dig!==String(st.adsgram_reward_secret_hash))return res.status(403).json({ok:false,error:'forbidden'});const q=await pool.query(`select id,status,created_at from public.promo_ad_sessions where telegram_id=$1 and status in ('pending','verified') and created_at>=now()-interval '15 minutes' order by created_at desc limit 1`,[id]);if(!q.rows[0])return res.json({ok:true,credited:false,reason:'no_pending_promo'});await pool.query(`update public.promo_ad_sessions set callback_received_at=now(),verified_at=now(),status='verified' where id=$1 and status in ('pending','verified')`,[q.rows[0].id]);const result=await promoFinalizeV6(id,q.rows[0].id);return res.json({ok:true,credited:result?.status==='credited',result})}catch(e){return res.status(400).json({ok:false,error:String(e?.message||e)})}});
'''
s=s.replace(marker,"\n"+promo+marker,1)
p.write_text(s)
print('Installed WIENER VPS ROUTES V6')
