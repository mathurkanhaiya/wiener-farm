from pathlib import Path
import os,re

p=Path(os.environ.get('WIENER_BACKEND_FILE','/opt/wiener-backend/server.mjs'))
if not p.exists():
    alt=Path('/opt/wiener-backend/server.js')
    if alt.exists(): p=alt
s=p.read_text()
TAG='WIENER SPONSORED TASK MANAGER V30'
if TAG in s:
    print('V30 sponsored task manager already installed')
    raise SystemExit(0)
if 'async function reconcileSponsoredV10B' not in s:
    raise SystemExit('ERROR: sponsored task backend missing')
marker="\napp.use((_req,res)=>\n  res.status(404).json({ok:false,error:'route_not_enabled_yet'})\n);\n"
if marker not in s:
    raise SystemExit('ERROR: final fallback marker missing')

code=r'''
// === WIENER SPONSORED TASK MANAGER V30 ===
let sponsorScanAtV30=0,sponsorScanPromiseV30=null;
const sponsorNumV30=v=>Number(v||0);
const sponsorShortV30=(v,n=18)=>{const x=String(v||'');return x.length<=n?x:x.slice(0,8)+'…'+x.slice(-6)};

async function sponsorScanV30(){
  const now=Date.now();
  if(sponsorScanPromiseV30)return sponsorScanPromiseV30;
  if(now-sponsorScanAtV30<4500)return{scanned:0,inserted:0,throttled:true};
  sponsorScanAtV30=now;
  sponsorScanPromiseV30=(async()=>{
    const t=await tonTreasuryV10B(),txs=await t.client.getTransactions(t.wc.address,{limit:50});let inserted=0;
    for(const tx of txs){try{if(await saveTonDepositV10B(t,tx))inserted++}catch(e){console.error('v30_save_ton',String(e?.message||e))}}
    return{scanned:txs.length,inserted};
  })();
  try{return await sponsorScanPromiseV30}finally{sponsorScanPromiseV30=null}
}

async function sponsorOrderV30(uid,id){
  return (await pool.query(`
    select o.*,t.id live_task_id,t.completed_count,t.max_completions,t.enabled task_enabled,t.created_at task_created_at,
      greatest(coalesce(t.max_completions,o.target_completions,0)-coalesce(t.completed_count,0),0)::int remaining_completions
    from public.exclusive_task_orders o
    left join public.tasks t on t.id=o.task_id
    where o.telegram_id=$1 and o.id::text=$2 limit 1
  `,[uid,String(id)])).rows[0]||null;
}
async function sponsorOrdersV30(uid){
  return (await pool.query(`
    select o.*,t.id live_task_id,t.completed_count,t.max_completions,t.enabled task_enabled,
      greatest(coalesce(t.max_completions,o.target_completions,0)-coalesce(t.completed_count,0),0)::int remaining_completions
    from public.exclusive_task_orders o
    left join public.tasks t on t.id=o.task_id
    where o.telegram_id=$1
    order by o.created_at desc limit 100
  `,[uid])).rows;
}
async function sponsorTopupsV30(uid,orderId=null){
  const args=[uid],extra=orderId?' and order_id=$2':'';
  if(orderId)args.push(String(orderId));
  return (await pool.query(`select * from public.sponsored_task_topups where telegram_id=$1${extra} order by created_at desc limit 100`,args)).rows;
}

async function reconcileSponsorTopupV30(x){
  if(!x||!['awaiting_payment','payment_pending'].includes(String(x.status)))return x;
  const cutoff=new Date(new Date(x.created_at).getTime()-180000);
  const deposits=(await pool.query(`select * from public.wiener_treasury_transfers where direction='deposit' and asset='TON' and network='TON' and state='confirmed' and created_at>=$1 order by created_at desc limit 250`,[cutoff])).rows;
  let pay=null;
  for(const d of deposits){
    if(String(d.to_address||'')!==String(x.payment_address||''))continue;
    if(String(d.metadata?.memo||'')!==String(x.payment_memo||''))continue;
    if(sponsorNumV30(d.amount)+0.000001<sponsorNumV30(x.package_ton))continue;
    const other=(await pool.query(`select id from public.sponsored_task_topups where tx_hash=$1 and id<>$2 limit 1`,[d.tx_hash,x.id])).rows[0];
    const initial=(await pool.query(`select order_id from public.task_deposits where tx_hash=$1 and order_id::text<>$2 limit 1`,[d.tx_hash,String(x.order_id)])).rows[0];
    if(other||initial)continue;
    pay=d;break;
  }
  if(!pay)return x;
  const db=await pool.connect();
  try{
    await db.query('begin');
    await db.query(`select pg_advisory_xact_lock(hashtext($1))`,['sponsor-topup:'+String(pay.tx_hash)]);
    const cur=(await db.query(`select * from public.sponsored_task_topups where id=$1 for update`,[x.id])).rows[0];
    if(!cur){await db.query('rollback');return x}
    if(cur.status==='credited'){await db.query('commit');return cur}
    const o=(await db.query(`select * from public.exclusive_task_orders where id::text=$1 and telegram_id=$2 for update`,[String(cur.order_id),cur.telegram_id])).rows[0];
    if(!o||!o.task_id)throw new Error('live_task_missing');
    const t=(await db.query(`select * from public.tasks where id=$1 for update`,[o.task_id])).rows[0];
    if(!t)throw new Error('live_task_missing');
    const added=Math.floor(sponsorNumV30(cur.added_completions));
    const oldMax=Math.max(sponsorNumV30(t.max_completions),sponsorNumV30(t.completed_count),sponsorNumV30(o.target_completions));
    const newMax=oldMax+added;
    await db.query(`update public.tasks set max_completions=$2,enabled=true where id=$1`,[o.task_id,newMax]);
    await db.query(`update public.exclusive_task_orders set target_completions=greatest(coalesce(target_completions,0),$2)+$3,gross_price_usdt=coalesce(gross_price_usdt,0)+$4,worker_pool_wiener=coalesce(worker_pool_wiener,0)+$5,worker_pool_usdt=coalesce(worker_pool_usdt,0)+$6,platform_profit_usdt=coalesce(platform_profit_usdt,0)+$7,updated_at=now() where id::text=$1`,[String(o.id),oldMax,added,cur.price_usd,cur.worker_pool_wiener,cur.worker_pool_usdt,cur.platform_profit_usdt]);
    const taskDeposit=(await db.query(`select 1 from public.task_deposits where tx_hash=$1 limit 1`,[pay.tx_hash])).rows[0];
    if(!taskDeposit)await db.query(`insert into public.task_deposits(order_id,telegram_id,expected_usdt,received_usdt,network,token_symbol,deposit_address,from_address,tx_hash,explorer_url,block_number,confirmations,status,verified_at) values($1,$2,$3,$4,'TON','TON',$5,$6,$7,$8,$9,1,'confirmed',now())`,[o.id,cur.telegram_id,cur.price_usd,sponsorNumV30(pay.amount)*sponsorNumV30(cur.quote_ton_usd),cur.payment_address,pay.from_address,pay.tx_hash,pay.explorer_url,pay.block_number]);
    await db.query(`update public.sponsored_task_topups set status='credited',payment_status='verified',tx_hash=$2,from_address=$3,explorer_url=$4,detected_at=now(),activated_at=now(),updated_at=now() where id=$1`,[cur.id,pay.tx_hash,pay.from_address,pay.explorer_url]);
    await db.query(`update public.wiener_treasury_transfers set metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('sponsored_topup_id',$2,'sponsored_order_id',$3) where tx_hash=$1`,[pay.tx_hash,String(cur.id),String(o.id)]).catch(()=>null);
    await db.query('commit');
    const out=(await pool.query(`select * from public.sponsored_task_topups where id=$1`,[cur.id])).rows[0];
    await tgV10('sendMessage',{chat_id:cur.telegram_id,text:`✅ Task upgraded\n\n+${added} completions added\nNew capacity: ${newMax}\nTask is active again.\n\n🌭 WIENER Farm`}).catch(()=>null);
    return out;
  }catch(e){await db.query('rollback').catch(()=>null);throw e}finally{db.release()}
}

async function syncSponsorPaymentsV30(uid){
  const [orders,topups]=await Promise.all([
    pool.query(`select * from public.exclusive_task_orders where telegram_id=$1 and status='awaiting_payment' order by created_at desc limit 20`,[uid]),
    pool.query(`select * from public.sponsored_task_topups where telegram_id=$1 and status in ('awaiting_payment','payment_pending') order by created_at desc limit 20`,[uid])
  ]);
  if(!orders.rows.length&&!topups.rows.length)return{pending:0};
  let scan={};try{scan=await sponsorScanV30()}catch(e){scan={error:String(e?.message||e)}}
  let initialActivated=0,topupsCredited=0;
  for(const o of orders.rows){try{const z=await reconcileSponsoredV10B(o);if(z?.status==='live')initialActivated++}catch(e){console.error('v30_initial_reconcile',String(e?.message||e))}}
  for(const x of topups.rows){try{const z=await reconcileSponsorTopupV30(x);if(z?.status==='credited')topupsCredited++}catch(e){console.error('v30_topup_reconcile',String(e?.message||e))}}
  return{pending:orders.rows.length+topups.rows.length,scan,initial_activated:initialActivated,topups_credited:topupsCredited};
}

async function createSponsorTopupV30(uid,orderId,addedRaw){
  const cfg=(await pool.query(`select sponsored_tasks_enabled,sponsored_min_completions,sponsored_max_completions,token_per_usdt from public.app_settings where id=true`)).rows[0]||{};
  if(!cfg.sponsored_tasks_enabled)throw new Error('sponsored_tasks_disabled');
  const added=Math.floor(sponsorNumV30(addedRaw)),min=Math.max(1,sponsorNumV30(cfg.sponsored_min_completions)||100),max=Math.max(min,sponsorNumV30(cfg.sponsored_max_completions)||50000);
  if(added<min||added>max)throw new Error('completion_count_out_of_range');
  const o=await sponsorOrderV30(uid,orderId);if(!o)throw new Error('order_not_found');
  if(o.status!=='live'||!o.task_id)throw new Error('task_not_live');
  const existing=(await pool.query(`select * from public.sponsored_task_topups where order_id=$1 and telegram_id=$2 and status in ('awaiting_payment','payment_pending') order by created_at desc limit 1`,[String(o.id),uid])).rows[0];
  if(existing)return{...existing,reused:true};
  const rate=sponsorNumV30(cfg.token_per_usdt||15000),reward=sponsorNumV30(o.reward_per_completion),gross=added/100*.30,worker=added*reward/rate,profit=gross-worker;
  if(profit<0)throw new Error('reward_too_high_for_fixed_price');
  const [usd,t]=await Promise.all([tonUsdV10B(),tonTreasuryV10B()]);
  const expected=Math.ceil((gross/usd-1e-12)*1e6)/1e6,memo='WTOPUP-'+crypto.randomUUID().replace(/-/g,'').slice(0,8).toUpperCase(),exp=new Date(Date.now()+15*60*1000);
  return (await pool.query(`insert into public.sponsored_task_topups(order_id,telegram_id,task_id,added_completions,price_usd,worker_pool_wiener,worker_pool_usdt,platform_profit_usdt,package_ton,payment_address,payment_memo,quote_ton_usd,status,payment_status,expires_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'awaiting_payment','awaiting',$13) returning *`,[String(o.id),uid,String(o.task_id),added,gross,added*reward,worker,profit,expected,t.address,memo,usd,exp])).rows[0];
}

async function sponsorManagerDataV30(uid){
  await syncSponsorPaymentsV30(uid).catch(()=>null);
  const [orders,topups]=await Promise.all([sponsorOrdersV30(uid),sponsorTopupsV30(uid)]);
  const counts={pending:orders.filter(x=>x.status==='awaiting_payment').length,live:orders.filter(x=>x.status==='live'&&sponsorNumV30(x.remaining_completions)>0).length,completed:orders.filter(x=>x.status==='live'&&sponsorNumV30(x.remaining_completions)<=0).length,total:orders.length};
  return{orders,topups,counts};
}

app.post('/functions/v1/wiener-sponsored-task-manager',async(req,res)=>{
  try{
    const b=req.body||{},sec=String(req.headers['x-wiener-internal-secret']||''),internal=!!sec&&sec===await secretV10();
    const uid=internal?Number(b.telegram_id||0):Number((await edgeUser(b)).id||0);if(!uid)throw new Error('telegram_required');
    const a=String(b.action||'list');
    if(a==='list')return res.json({ok:true,data:await sponsorManagerDataV30(uid)});
    if(a==='detail'){
      await syncSponsorPaymentsV30(uid).catch(()=>null);
      const order=await sponsorOrderV30(uid,b.order_id);if(!order)throw new Error('order_not_found');
      return res.json({ok:true,data:{order,topups:await sponsorTopupsV30(uid,String(order.id))}});
    }
    if(a==='check_initial'){
      await sponsorScanV30().catch(()=>null);
      let order=await sponsorOrderV30(uid,b.order_id);if(!order)throw new Error('order_not_found');
      if(order.status==='awaiting_payment')order=await reconcileSponsoredV10B(order);
      return res.json({ok:true,data:{order}});
    }
    if(a==='topup_create')return res.json({ok:true,data:await createSponsorTopupV30(uid,b.order_id,b.completions)});
    if(a==='topup_status'){
      await sponsorScanV30().catch(()=>null);
      let x=(await pool.query(`select * from public.sponsored_task_topups where id=$1 and telegram_id=$2 limit 1`,[String(b.topup_id||''),uid])).rows[0];if(!x)throw new Error('topup_not_found');
      x=await reconcileSponsorTopupV30(x);
      return res.json({ok:true,data:{topup:x,order:await sponsorOrderV30(uid,x.order_id)}});
    }
    if(a==='set_enabled'){
      const o=await sponsorOrderV30(uid,b.order_id);if(!o||!o.task_id)throw new Error('task_not_live');
      const enable=b.enabled===true;
      if(enable&&sponsorNumV30(o.completed_count)>=sponsorNumV30(o.max_completions))throw new Error('no_remaining_completions_add_more');
      await pool.query(`update public.tasks set enabled=$2 where id=$1`,[o.task_id,enable]);
      return res.json({ok:true,data:{order:await sponsorOrderV30(uid,o.id)}});
    }
    throw new Error('unknown_action');
  }catch(e){return edgeFail(res,e)}
});

async function sponsorBotHomeV30(uid){
  const d=await sponsorManagerDataV30(uid),st=await st18(),a=app18(st);
  return{text:`📣 SPONSORED TASK CENTER\n\nCreate and manage your paid tasks from one place.\n\n🟡 Pending payment: ${d.counts.pending}\n🟢 Live: ${d.counts.live}\n✅ Completed: ${d.counts.completed}\n📚 Total: ${d.counts.total}\n\n💵 Price: $0.30 / 100 completions\n💎 Payments: TON · automatically detected`,markup:kb18([[cb18('➕ CREATE NEW TASK','stm30:new')],[cb18(`🟡 PENDING (${d.counts.pending})`,'stm30:list:pending'),cb18(`🟢 LIVE (${d.counts.live})`,'stm30:list:live')],[cb18('📚 ALL MY TASKS','stm30:list:all')],[web18('🖥 OPEN TASK MANAGER',`${a}?page=tasks`)]])};
}
async function sponsorBotListV30(uid,mode='all'){
  const d=await sponsorManagerDataV30(uid);let rows=d.orders;
  if(mode==='pending')rows=rows.filter(x=>x.status==='awaiting_payment');
  if(mode==='live')rows=rows.filter(x=>x.status==='live');
  rows=rows.slice(0,8);
  return{text:`📚 ${mode==='pending'?'PENDING PAYMENTS':mode==='live'?'LIVE TASKS':'MY SPONSORED TASKS'}\n\n${rows.map((x,i)=>`${i+1}. ${x.status==='awaiting_payment'?'🟡':sponsorNumV30(x.remaining_completions)>0?'🟢':'✅'} ${x.title}\n   ${sponsorNumV30(x.completed_count)}/${sponsorNumV30(x.max_completions||x.target_completions)} completed · +${sponsorNumV30(x.reward_per_completion)} WIENER`).join('\n\n')||'No tasks in this section.'}`,markup:kb18([...rows.map(x=>[cb18(`${x.status==='awaiting_payment'?'💳':'⚙️'} ${String(x.title||'Task').slice(0,28)}`,`stm30:show:${x.id}`)]),[cb18('◀️ TASK CENTER','stm30:home')]])};
}
async function sponsorBotShowV30(uid,id){
  const o=await sponsorOrderV30(uid,id);if(!o)return{text:'Task not found.',markup:kb18([[cb18('◀️ TASK CENTER','stm30:home')]])};
  const max=sponsorNumV30(o.max_completions||o.target_completions),done=sponsorNumV30(o.completed_count),remaining=Math.max(0,max-done);
  if(o.status==='awaiting_payment')return{text:`🟡 PENDING PAYMENT\n\n${o.title}\n👥 ${o.target_completions} completions\n🎁 ${o.reward_per_completion} WIENER each\n💎 Send: ${sponsorNumV30(o.package_ton).toFixed(6)} TON\n🏦 ${o.payment_address}\n📝 Memo: ${o.payment_memo}\n\nAfter sending, tap CHECK PAYMENT.`,markup:kb18([[cb18('✅ CHECK PAYMENT',`stm30:check:${o.id}`)],[cb18('◀️ MY TASKS','stm30:list:all')]])};
  return{text:`${o.task_enabled?'🟢':'⏸'} TASK MANAGER\n\n${o.title}\n📊 Progress: ${done}/${max}\n🎯 Remaining: ${remaining}\n🎁 Reward: ${o.reward_per_completion} WIENER\n🔗 ${o.target_url||'—'}\n\n${remaining<=0?'Capacity completed. Add more completions to reactivate.':o.task_enabled?'Task is currently live.':'Task is paused.'}`,markup:kb18([[cb18(o.task_enabled?'⏸ PAUSE':'▶️ RESUME',`stm30:toggle:${o.id}:${o.task_enabled?'0':'1'}`)],[cb18('➕ 100','stm30:add:'+o.id+':100'),cb18('➕ 250','stm30:add:'+o.id+':250')],[cb18('➕ 500','stm30:add:'+o.id+':500'),cb18('➕ 1000','stm30:add:'+o.id+':1000')],[cb18('🔄 REFRESH',`stm30:show:${o.id}`)],[cb18('◀️ MY TASKS','stm30:list:all')]])};
}

async function handleSponsoredTaskManagerV30(up,uid,text,m,q){
  uid=Number(q?.from?.id||m?.from?.id||uid||0);text=String(m?.text||text||'').trim();
  if(m?.chat?.type==='private'&&/^\/addtask(?:@\w+)?$/i.test(text)){const x=await sponsorBotHomeV30(uid);await safeTg18('sendMessage',{chat_id:uid,text:x.text,reply_markup:x.markup,disable_web_page_preview:true});return true}
  if(!q||!String(q.data||'').startsWith('stm30:'))return false;
  const p=String(q.data).split(':'),act=p[1];
  try{
    if(act==='home'){await edit18(q,await sponsorBotHomeV30(uid))}
    else if(act==='new'){await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:'Starting task creator'});await startAddtask18(uid);return true}
    else if(act==='list'){await edit18(q,await sponsorBotListV30(uid,p[2]||'all'))}
    else if(act==='show'){await edit18(q,await sponsorBotShowV30(uid,p[2]))}
    else if(act==='check'){
      await sponsorScanV30().catch(()=>null);let o=await sponsorOrderV30(uid,p[2]);if(o?.status==='awaiting_payment')o=await reconcileSponsoredV10B(o);
      await edit18(q,await sponsorBotShowV30(uid,p[2]));await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:o?.status==='live'?'Payment confirmed':'Not detected yet',show_alert:o?.status!=='live'});return true
    }
    else if(act==='toggle'){
      const o=await sponsorOrderV30(uid,p[2]);if(!o||!o.task_id)throw new Error('task_not_live');const enable=p[3]==='1';
      if(enable&&sponsorNumV30(o.completed_count)>=sponsorNumV30(o.max_completions))throw new Error('Add more completions first');
      await pool.query(`update public.tasks set enabled=$2 where id=$1`,[o.task_id,enable]);await edit18(q,await sponsorBotShowV30(uid,p[2]))
    }
    else if(act==='add'){
      const x=await createSponsorTopupV30(uid,p[2],p[3]);
      await edit18(q,{text:`💎 ADD COMPLETIONS PAYMENT\n\n➕ ${x.added_completions} completions\n💵 $ ${sponsorNumV30(x.price_usd).toFixed(2)}\n💎 Send: ${sponsorNumV30(x.package_ton).toFixed(6)} TON\n🏦 ${x.payment_address}\n📝 Memo: ${x.payment_memo}\n\nPayment is detected automatically. Tap CHECK after sending.`,markup:kb18([[cb18('✅ CHECK PAYMENT',`stm30:topcheck:${x.id}`)],[cb18('◀️ TASK',`stm30:show:${p[2]}`)]])})
    }
    else if(act==='topcheck'){
      await sponsorScanV30().catch(()=>null);let x=(await pool.query(`select * from public.sponsored_task_topups where id=$1 and telegram_id=$2 limit 1`,[p[2],uid])).rows[0];if(!x)throw new Error('topup_not_found');x=await reconcileSponsorTopupV30(x);
      await edit18(q,await sponsorBotShowV30(uid,x.order_id));await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:x.status==='credited'?'Completions added':'Payment not detected yet',show_alert:x.status!=='credited'});return true
    } else return false;
    await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:'Updated'});return true;
  }catch(e){await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:String(e?.message||e).replace(/_/g,' '),show_alert:true});return true}
}
// === END WIENER SPONSORED TASK MANAGER V30 ===
'''

s=s.replace(marker,"\n"+code+marker,1)

needle="try{if(await handleBotFullV18(up,uid,text,m,q)) return done();}"
pos=s.find(needle)
if pos>=0:
    line=s.rfind("\n",0,pos)+1
    indent=re.match(r"[ \t]*",s[line:pos]).group(0)
    hook=indent+"try{if(await handleSponsoredTaskManagerV30(up,uid,text,m,q)) return done();}catch(e){console.error('v30_sponsored_manager',String(e?.message||e));}\n"
    s=s[:line]+hook+s[line:]
else:
    print('WARNING: V18 webhook hook not found; Mini App manager still works')

p.write_text(s)
print('V30 installed: advanced sponsored task management API + bot dashboard')
