from pathlib import Path

p=Path('/opt/wiener-backend/server.mjs')
s=p.read_text()

if 'WIENER VPS V13 APP PARITY' in s:
    print('V13 app parity already installed')
    raise SystemExit(0)

# Remove the fake compatibility stub for special-task-admin so the real handler below can own the route.
s=s.replace(",'wiener-special-task-admin'","")
s=s.replace("'wiener-special-task-admin',","")

marker="console.log('WIENER VPS compatibility API listening on 127.0.0.1:3000');"
pos=s.find(marker)
if pos<0:
    raise SystemExit('ERROR: backend listen marker not found')

code=r'''
// === WIENER VPS V13 APP PARITY ===
app.post('/functions/v1/wiener-special-task-admin',async(req,res)=>{
  try{
    const b=req.body||{};
    const {id}=await edgeUser(b);
    await adminV10(id);
    const action=String(b.action||'list');
    if(action==='list'){
      const tasks=(await pool.query(`select * from public.tasks where category='special' order by sort_order asc, created_at asc`)).rows;
      let submissions=[];
      try{submissions=(await pool.query(`select s.*,jsonb_build_object('title',t.title,'reward',t.reward) tasks from public.task_verification_submissions s left join public.tasks t on t.id=s.task_id order by s.submitted_at desc limit 200`)).rows}catch{}
      return res.json({ok:true,data:{tasks,submissions}});
    }
    if(action==='save'){
      const t=b.task||{};
      const title=String(t.title||'').trim();
      const reward=num(t.reward);
      if(!title)throw new Error('task_title_required');
      if(!(reward>0))throw new Error('invalid_reward');
      const allowed=new Set(['profile_name','profile_bio','manual_proof','none']);
      const verification=allowed.has(String(t.verification||''))?String(t.verification):'manual_proof';
      const vals=[title,String(t.description||'').trim()||null,reward,String(t.url||'').trim()||null,verification,String(t.verification_value||'').trim()||null,String(t.proof_instructions||'').trim()||null,!!t.is_daily,t.enabled!==false,num(t.sort_order),id];
      let row;
      if(t.id){
        row=(await pool.query(`update public.tasks set title=$1,description=$2,category='special',task_type='manual',reward=$3,url=$4,telegram_chat_id=null,verification=$5,verification_value=$6,proof_instructions=$7,is_daily=$8,enabled=$9,sort_order=$10,updated_at=now() where id=$11 returning *`,[...vals.slice(0,10),String(t.id)])).rows[0];
      }else{
        row=(await pool.query(`insert into public.tasks(title,description,category,task_type,reward,url,telegram_chat_id,verification,verification_value,proof_instructions,is_daily,enabled,sort_order) values($1,$2,'special','manual',$3,$4,null,$5,$6,$7,$8,$9,$10) returning *`,vals.slice(0,10))).rows[0];
      }
      return res.json({ok:true,data:row});
    }
    if(action==='delete'){
      const taskId=String(b.task_id||''); if(!taskId)throw new Error('task_id_required');
      await pool.query(`delete from public.tasks where id=$1 and category='special'`,[taskId]);
      return res.json({ok:true,data:{ok:true}});
    }
    if(action==='review'){
      const sid=String(b.submission_id||''),status=String(b.status||'');
      if(!['approved','rejected'].includes(status))throw new Error('invalid_review_status');
      const note=String(b.review_note||'').trim().slice(0,1000)||null;
      const row=(await pool.query(`update public.task_verification_submissions set status=$2,review_note=$3,reviewed_at=now(),reviewed_by=$4 where id=$1 returning *`,[sid,status,note,id])).rows[0];
      if(!row)throw new Error('submission_not_found');
      return res.json({ok:true,data:row});
    }
    throw new Error('unsupported_action');
  }catch(e){return edgeFail(res,e)}
});

app.get('/functions/v1/wiener-adsgram-reward',async(req,res)=>{
  try{
    const uid=num(req.query?.userId||req.query?.userid||0),secret=String(req.query?.secret||'');
    if(!uid||!secret)return res.status(403).json({ok:false,error:'forbidden'});
    const st=(await pool.query(`select adsgram_reward_secret_hash from public.app_settings where id=true limit 1`)).rows[0]||{};
    const dig=crypto.createHash('sha256').update(secret).digest('hex');
    if(!st.adsgram_reward_secret_hash||dig!==String(st.adsgram_reward_secret_hash))return res.status(403).json({ok:false,error:'forbidden'});
    const since=new Date(Date.now()-15*60*1000);
    const candidates=[];
    const add=async(type,sql)=>{try{const r=(await pool.query(sql,[uid,since])).rows[0];if(r)candidates.push({type,id:r.id,ts:new Date(r.ts).getTime()})}catch{}};
    await Promise.all([
      add('ad',`select id,started_at ts from public.ad_sessions where telegram_id=$1 and status in ('started','verified') and started_at>=$2 order by started_at desc limit 1`),
      add('promo',`select id,created_at ts from public.promo_ad_sessions where telegram_id=$1 and status in ('pending','verified') and created_at>=$2 order by created_at desc limit 1`),
      add('task',`select id,created_at ts from public.adsgram_task_sessions where telegram_id=$1 and status='started' and created_at>=$2 order by created_at desc limit 1`),
      add('bonus',`select id,started_at ts from public.tads_ad_sessions where telegram_id=$1 and status='started' and started_at>=$2 order by started_at desc limit 1`)
    ]);
    if(!candidates.length)return res.json({ok:true,matched:false});
    candidates.sort((a,b)=>b.ts-a.ts);const hit=candidates[0];
    if(hit.type==='promo')await pool.query(`update public.promo_ad_sessions set callback_received_at=now(),verified_at=now(),status='verified' where id=$1 and status in ('pending','verified')`,[hit.id]);
    else if(hit.type==='ad')await pool.query(`update public.ad_sessions set status='verified',verified_at=now() where id=$1 and status in ('started','verified')`,[hit.id]);
    else if(hit.type==='task')await pool.query(`update public.adsgram_task_sessions set callback_received_at=now() where id=$1 and status='started'`,[hit.id]);
    else if(hit.type==='bonus')await pool.query(`update public.tads_ad_sessions set callback_received_at=now() where id=$1 and status='started'`,[hit.id]);
    return res.json({ok:true,matched:true,type:hit.type});
  }catch(e){console.error('adsgram reward callback',String(e?.message||e));return res.status(500).json({ok:false,error:'server_error'})}
});
// === END WIENER VPS V13 APP PARITY ===

'''
s=s[:pos]+code+s[pos:]
p.write_text(s)
print('Installed WIENER VPS V13 APP PARITY')
