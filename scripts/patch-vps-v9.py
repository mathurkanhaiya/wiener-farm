from pathlib import Path

p=Path('/opt/wiener-backend/server.mjs')
s=p.read_text()
marker="\napp.use((_req,res)=>\n  res.status(404).json({ok:false,error:'route_not_enabled_yet'})\n);\n"
if 'WIENER VPS ROUTES V9' in s:
    print('V9 already installed')
    raise SystemExit(0)
if marker not in s:
    raise SystemExit('ERROR: final insertion marker not found')

code=r'''

// === WIENER VPS ROUTES V9 ===

app.post('/functions/v1/wiener-ad-usage',async(req,res)=>{
  try{
    const b=req.body||{}; const {id}=await edgeUser(b);
    const [u,sq,last]=await Promise.all([
      pool.query(`select ads_watched_today,ads_day,is_banned from public.users where telegram_id=$1 limit 1`,[id]),
      pool.query(`select ads_enabled,daily_ad_limit,ad_reward,adsgram_block_id,maintenance_enabled from public.app_settings where id=true limit 1`),
      pool.query(`select credited_at from public.ad_sessions where telegram_id=$1 and network='adsgram' and status='credited' and credited_at is not null order by credited_at desc limit 1`,[id])
    ]);
    const user=u.rows[0], st=sq.rows[0];
    if(!user) throw new Error('user_not_found');
    if(!st) throw new Error('settings_unavailable');
    if(user.is_banned) throw new Error('user_banned');
    const today=new Date().toISOString().slice(0,10);
    const used=String(user.ads_day||'')===today?num(user.ads_watched_today):0;
    let cooldown=0;
    const at=last.rows[0]?.credited_at;
    if(at) cooldown=Math.max(0,Math.ceil((20000-(Date.now()-new Date(at).getTime()))/1000));
    return res.json({ok:true,data:{used,limit:num(st.daily_ad_limit),remaining:Math.max(0,num(st.daily_ad_limit)-used),cooldown_seconds:cooldown,full_reward:num(st.ad_reward),block_id:st.adsgram_block_id,ads_enabled:!!st.ads_enabled,maintenance_enabled:!!st.maintenance_enabled}});
  }catch(e){return edgeFail(res,e)}
});

app.post('/functions/v1/wiener-admin-settings',async(req,res)=>{
  try{
    const b=req.body||{}; const {id}=await edgeUser(b); await needAdminV4(id);
    const incoming={...(b.settings||{})};
    const cols=await pool.query(`select column_name,data_type from information_schema.columns where table_schema='public' and table_name='app_settings'`);
    const allowed=new Map(cols.rows.map(x=>[x.column_name,x.data_type]));
    for(const k of ['id','created_at','updated_at','telegram_webhook_secret','notification_cron_secret','adsgram_reward_secret_hash']) allowed.delete(k);
    const keys=Object.keys(incoming).filter(k=>allowed.has(k));
    if(!keys.length){
      const q=await pool.query(`select * from public.app_settings where id=true limit 1`);
      return res.json({ok:true,data:safeSettingsV4(q.rows[0])});
    }
    const vals=keys.map(k=>{
      const type=allowed.get(k);
      const v=incoming[k];
      if(type==='jsonb' && v!=null && typeof v!=='string') return JSON.stringify(v);
      return v;
    });
    const set=keys.map((k,i)=>`\"${k}\"=$${i+1}${allowed.get(k)==='jsonb'?'::jsonb':''}`).join(',');
    const q=await pool.query(`update public.app_settings set ${set},updated_at=now() where id=true returning *`,vals);
    return res.json({ok:true,data:safeSettingsV4(q.rows[0])});
  }catch(e){return edgeFail(res,e)}
});

// === END WIENER VPS ROUTES V9 ===
'''

s=s.replace(marker,code+marker,1)
p.write_text(s)
print('Installed WIENER VPS ROUTES V9')
