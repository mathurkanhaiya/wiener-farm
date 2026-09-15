from pathlib import Path

p=Path('/opt/wiener-backend/server.mjs')
s=p.read_text()
marker='\napp.use((_req,res)=>\n  res.status(404).json({ok:false,error:\'route_not_enabled_yet\'})\n);\n'
if 'WIENER VPS ROUTES V3' in s:
    print('V3 already installed')
    raise SystemExit(0)
code=r'''

// === WIENER VPS ROUTES V3 ===

function sha256hex(v){return crypto.createHash('sha256').update(String(v)).digest('hex')}

app.post('/functions/v1/wiener-missions',async(req,res)=>{
  try{
    const b=req.body||{}, {id}=await edgeUser(b), action=String(b.action||'status');
    if(action==='status') return res.json({ok:true,data:await rpc('get_missions',[id])});
    if(action==='claim'){
      const claim=await rpc('claim_mission',[id,String(b.mission_key||'')]);
      const missions=await rpc('get_missions',[id]);
      return res.json({ok:true,data:{claim,missions}});
    }
    throw new Error('unknown_action');
  }catch(e){return edgeFail(res,e)}
});

app.post('/functions/v1/wiener-share',async(req,res)=>{
  try{
    const b=req.body||{}, {id}=await edgeUser(b);
    const referral=`https://t.me/WienerDogeFarmBot?startapp=ref_${id}`;
    const image='https://pixlinkhost.vercel.app/i/4ccZRHlQxQ';
    const result={type:'photo',id:`wf_${id}_${Date.now()}`,photo_url:image,thumbnail_url:image,caption:'💰 Earn up to $0.01 per referral\n💸 Min withdraw $0.05\n\n👇 Click below to join WIENER Farm',reply_markup:{inline_keyboard:[[{text:'🚀 JOIN WIENER FARM',url:referral}]]}};
    const prepared=await telegramApi('savePreparedInlineMessage',{user_id:id,result,allow_user_chats:true,allow_bot_chats:false,allow_group_chats:true,allow_channel_chats:false});
    return res.json({ok:true,data:{id:prepared.id,expiration_date:prepared.expiration_date,referral_link:referral}});
  }catch(e){return edgeFail(res,e)}
});

async function promoAdmin(id){const a=await isAdmin(id);return !!a&&(a.role==='owner'||a.role==='admin'||a.permissions?.promos===true)}
function promoFmt(v){const x=num(v);return Number.isInteger(x)?String(x):x.toFixed(2).replace(/0+$/,'').replace(/\.$/,'')}
function promoRender(p){const used=num(p.claims_count),max=p.max_claims==null?null:num(p.max_claims),full=max!=null&&used>=max,expired=!!p.expires_at&&new Date(p.expires_at)<=new Date(),active=p.enabled&&!full&&!expired,almost=max!=null&&!full&&max>0&&used/max>=.8,type=String(p.reward_type||'wiener');let title='🎁 WIENER Promo Drop',reward=`+${promoFmt(p.reward)} WIENER`,extra='Open WIENER Farm and claim it before it’s gone.';if(type==='treasury_point'){title='🎁 Treasury Points Promo';reward=`+${promoFmt(p.reward)} Treasury Point${num(p.reward)===1?'':'s'}`;extra='Collect 5 Treasury Points = 1 Treasury Key 🔑'}else if(type==='treasury_key'){title='🔑 Treasury Key Drop';reward=`+${promoFmt(p.reward)} Treasury Key${num(p.reward)===1?'':'s'}`;extra='Open the WIENER Treasury and try your luck.'}const text=`${title}\n\nCode: ${p.code}\nReward: ${reward}\nClaims: ${used} / ${max==null?'∞':max}\nStatus: ${active?'🟢 Active':full?'🔴 Fully Claimed':expired?'⚫ Expired':'⏸ Disabled'}${almost?'\n⚡ Almost gone':''}\n\n${extra}\n\n🌭 WIENER Farm`;const markup=active?{inline_keyboard:[[{text:'🎁 CLAIM PROMO',url:'https://t.me/WienerDogeFarmBot?startapp'}]]}:undefined;return {text,markup}}

app.post('/functions/v1/wiener-promo-channel',async(req,res)=>{
  try{
    const b=req.body||{}, {id}=await edgeUser(b); if(!await promoAdmin(id)) throw new Error('admin_forbidden');
    const code=String(b.code||'').trim().toUpperCase(); if(!code) throw new Error('code_required');
    const pq=await pool.query('select * from public.promo_codes where code=$1 limit 1',[code]); const promo=pq.rows[0]; if(!promo) throw new Error('promo_not_found');
    const allowed=['@WienerFarm','@WienerPay']; const wanted=Array.isArray(b.channels)&&b.channels.length?new Set(b.channels.map(x=>String(x).trim().toLowerCase())):null; const chats=wanted?allowed.filter(x=>wanted.has(x.toLowerCase())):allowed;
    if(!chats.length) throw new Error('no_valid_channels'); const {text,markup}=promoRender(promo); const out=[];
    for(const chat of chats){try{const q=await pool.query('select message_id from public.promo_channel_posts where code=$1 and chat_id=$2 limit 1',[code,chat]);if(q.rows[0]?.message_id){await telegramApi('editMessageText',{chat_id:chat,message_id:q.rows[0].message_id,text,disable_web_page_preview:true,reply_markup:markup||{inline_keyboard:[]}});await pool.query('update public.promo_channel_posts set updated_at=now() where code=$1 and chat_id=$2',[code,chat]);out.push({chat,edited:true})}else{const m=await telegramApi('sendMessage',{chat_id:chat,text,disable_web_page_preview:true,...(markup?{reply_markup:markup}:{})});await pool.query(`insert into public.promo_channel_posts(code,chat_id,message_id,updated_at) values($1,$2,$3,now()) on conflict(code,chat_id) do update set message_id=excluded.message_id,updated_at=now()`,[code,chat,m.message_id]);out.push({chat,sent:true})}}catch(e){out.push({chat,error:String(e.message||e)})}}
    return res.json({ok:true,data:{code,channels:out}});
  }catch(e){return edgeFail(res,e)}
});

app.post('/functions/v1/wiener-device',async(req,res)=>{
  try{
    const b=req.body||{}; const {u}=verifyTelegram(String(b.initData||'')); const id=num(u.id); const deviceId=String(b.device_id||'').trim().slice(0,128),fp=String(b.device_fingerprint||'').trim().slice(0,128); if(!deviceId) throw new Error('device_id_required');
    const data=await rpc('register_device_for_user',[id,deviceId,fp||null]);
    try{const rawIp=String(req.headers['x-wiener-client-ip']||'').trim().slice(0,128),ua=String(req.headers['x-wiener-user-agent']||'').slice(0,512),key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.DEVICE_HASH_SECRET||BOT;const ipHash=rawIp&&key?crypto.createHmac('sha256',key).update(rawIp).digest('hex'):null,uaHash=ua?sha256hex(ua):null;await pool.query(`insert into public.user_security_events(telegram_id,event_type,device_id,installation_id,fingerprint_v2,ip_hash,country,region,city,telegram_platform,language,timezone,user_agent_hash,vpn,proxy,hosting) values($1,'app_open',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,null,null,null)`,[id,deviceId,String(b.installation_id||'').trim().slice(0,128)||null,String(b.fingerprint_v2||'').trim().slice(0,128)||null,ipHash,String(req.headers['x-wiener-country']||'').slice(0,8)||null,String(req.headers['x-wiener-region']||'').slice(0,64)||null,String(req.headers['x-wiener-city']||'').slice(0,96)||null,String(b.telegram_platform||'').slice(0,32)||null,String(b.language||'').slice(0,32)||null,String(b.timezone||'').slice(0,64)||null,uaHash]);await rpc('refresh_user_risk',[id])}catch(e){console.error('security_event_nonblocking',String(e.message||e))}
    return res.json({ok:true,data:{...(data||{}),blocked:!!data?.blocked,device_blocked:!!data?.device_blocked,access_blocked:!!data?.access_blocked,same_device:!!data?.same_device,referral_eligible:data?.referral_eligible!==false}});
  }catch(e){return edgeFail(res,e)}
});

// === END WIENER VPS ROUTES V3 ===
'''
if marker not in s: raise SystemExit('404 marker not found')
s=s.replace(marker,code+marker,1)
p.write_text(s)
print('Installed WIENER VPS ROUTES V3')
