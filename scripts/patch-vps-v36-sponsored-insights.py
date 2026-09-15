from pathlib import Path

p = Path("/opt/wiener-backend/server.mjs")
s = p.read_text()
TAG = "WIENER SPONSORED INSIGHTS V36"

if TAG in s:
    print("V36 sponsored insights already installed")
    raise SystemExit(0)

if "WIENER SPONSORED TASK MANAGER V30" not in s:
    raise SystemExit("ERROR: V30 sponsored task manager is required")

if "WIENER ADDTASK V35B" not in s:
    raise SystemExit("ERROR: V35B addtask fix is required")

marker = "\napp.use((_req,res)=>\n  res.status(404).json({ok:false,error:'route_not_enabled_yet'})\n);\n"
if marker not in s:
    raise SystemExit("ERROR: final fallback marker missing")

def replace_between(src, start_marker, end_marker, new_block):
    a = src.find(start_marker)
    if a < 0:
        raise SystemExit("ERROR: start marker not found: " + start_marker)
    b = src.find(end_marker, a)
    if b < 0:
        raise SystemExit("ERROR: end marker not found: " + end_marker)
    return src[:a] + new_block + src[b:]

show = r'''async function sponsorBotShowV30(uid,id){
  const o=await sponsorOrderV30(uid,id);
  if(!o)return{text:'Task not found.',markup:kb18([[cb18('◀️ TASK STUDIO','stm30:home')]])};
  const max=sponsorNumV30(o.max_completions||o.target_completions),done=sponsorNumV30(o.completed_count),remaining=Math.max(0,max-done),pct=max?Math.floor(done/max*100):0;
  if(o.status==='awaiting_payment')return{text:`🟡 PAYMENT REQUIRED

${o.title}

👥 ${o.target_completions} completions
🎁 +${o.reward_per_completion} WIENER each
💵 $${(sponsorNumV30(o.target_completions)/100*.30).toFixed(2)}

💎 SEND: ${sponsorNumV30(o.package_ton).toFixed(6)} TON
🏦 TO: ${o.payment_address}
📝 MEMO: ${o.payment_memo}

Send the exact amount with the exact memo, then tap CHECK PAYMENT.`,markup:kb18([
    [cb18('✅ CHECK PAYMENT',`stm30:check:${o.id}`)],
    [cb18('📜 ORDER DETAILS',`stm36:history:${o.id}`)],
    [cb18('◀️ MY TASKS','stm30:list:all'),cb18('🏠 STUDIO','stm30:home')]
  ])};
  const status=remaining<=0?'✅ COMPLETED':o.task_enabled===false?'⏸ PAUSED':'🟢 LIVE';
  const rows=[];
  if(remaining>0)rows.push([
    cb18(o.task_enabled===false?'▶️ RESUME':'⏸ PAUSE',`stm30:toggle:${o.id}:${o.task_enabled===false?'1':'0'}`),
    cb18('🔄 REFRESH',`stm30:show:${o.id}`)
  ]);
  rows.push([cb18('📊 INSIGHTS',`stm36:insights:${o.id}`),cb18('⚙️ MORE',`stm36:more:${o.id}`)]);
  rows.push([cb18('＋ ADD COMPLETIONS',`stm36:addmenu:${o.id}`)]);
  rows.push([cb18('◀️ MY TASKS','stm30:list:all'),cb18('🏠 STUDIO','stm30:home')]);
  return{text:`${status} · TASK

${o.title}

📊 ${done}/${max} completed · ${pct}%
🎯 ${remaining} remaining
🎁 +${o.reward_per_completion} WIENER / completion
🔗 ${o.target_url||'—'}

${remaining<=0?'Campaign capacity is complete. Add more completions to run it again.':o.task_enabled===false?'Campaign is paused. Resume it whenever you want.':'Campaign is active in Official Tasks.'}`,markup:kb18(rows)};
}'''

s = replace_between(
    s,
    "async function sponsorBotShowV30(uid,id){",
    "\n\nasync function handleSponsoredTaskManagerV30",
    show
)

code = r'''
// === WIENER SPONSORED INSIGHTS V36 ===

async function sponsorEnsureV36(){
  await pool.query(`
    create table if not exists public.sponsored_task_alerts(
      order_id uuid not null,
      telegram_id bigint not null,
      alert_key text not null,
      created_at timestamptz not null default now(),
      primary key(order_id,alert_key)
    )
  `);
}

async function sponsorAnalyticsV36(uid,id){
  const o=await sponsorOrderV30(uid,id);
  if(!o)throw new Error('order_not_found');
  const max=sponsorNumV30(o.max_completions||o.target_completions);
  const done=sponsorNumV30(o.completed_count);
  const remaining=Math.max(0,max-done);
  let stat={total:done,today:0,h24:0,d7:0,unique_users:done,first_at:null,last_at:null};
  let days=[];
  if(o.task_id){
    try{
      stat=(await pool.query(`
        select
          count(*)::int total,
          count(*) filter(where completion_day=current_date)::int today,
          count(*) filter(where created_at>=now()-interval '24 hours')::int h24,
          count(*) filter(where created_at>=now()-interval '7 days')::int d7,
          count(distinct telegram_id)::int unique_users,
          min(created_at) first_at,
          max(created_at) last_at
        from public.task_completions
        where task_id=$1
      `,[o.task_id])).rows[0]||stat;
      days=(await pool.query(`
        select completion_day::text day,count(*)::int n
        from public.task_completions
        where task_id=$1 and completion_day>=current_date-6
        group by completion_day
        order by completion_day
      `,[o.task_id])).rows;
    }catch(e){console.error('sponsor_analytics_v36',String(e?.message||e))}
  }
  const topups=await sponsorTopupsV30(uid,String(o.id));
  const credited=topups.filter(x=>x.status==='credited');
  const paidTopups=credited.reduce((a,x)=>a+sponsorNumV30(x.price_usd),0);
  const gross=sponsorNumV30(o.gross_price_usdt)||sponsorNumV30(o.target_completions)/100*.30;
  const pace24=sponsorNumV30(stat.h24);
  const pace7=sponsorNumV30(stat.d7)/7;
  const pace=pace24>0?pace24:pace7;
  let eta='No recent pace yet';
  if(remaining<=0)eta='Completed';
  else if(pace>0){
    const daysLeft=remaining/pace;
    eta=daysLeft<1?`~${Math.max(1,Math.ceil(daysLeft*24))}h`:`~${Math.ceil(daysLeft)}d`;
  }
  const trend=days.length?days.map(x=>`${String(x.day).slice(5)} ${x.n}`).join(' · '):'No 7-day data yet';
  const pct=max?Math.min(100,Math.floor(done/max*100)):0;
  const health=remaining<=0?'✅ Complete':pace24>0?'🟢 Moving':done>0?'🟡 Slow':'⚪ New';
  return{o,max,done,remaining,pct,stat,days,topups,credited,paidTopups,gross,pace,eta,trend,health};
}

async function sponsorInsightsCardV36(uid,id){
  const a=await sponsorAnalyticsV36(uid,id);
  return{text:`📊 CAMPAIGN INSIGHTS

${a.o.title}

${a.health}
Progress: ${a.done}/${a.max} · ${a.pct}%
Remaining: ${a.remaining}

⚡ Today: ${sponsorNumV30(a.stat.today)}
🕐 Last 24h: ${sponsorNumV30(a.stat.h24)}
📅 Last 7d: ${sponsorNumV30(a.stat.d7)}
👥 Unique completers: ${sponsorNumV30(a.stat.unique_users)}

💵 Campaign value: $${a.gross.toFixed(2)}
➕ Credited top-ups: ${a.credited.length}
⏳ Estimated finish: ${a.eta}

7-day activity
${a.trend}`,markup:kb18([
    [cb18('📜 HISTORY',`stm36:history:${id}`),cb18('🔄 REFRESH',`stm36:insights:${id}`)],
    [cb18('＋ ADD COMPLETIONS',`stm36:addmenu:${id}`)],
    [cb18('◀️ BACK TO TASK',`stm30:show:${id}`)]
  ])};
}

async function sponsorHistoryCardV36(uid,id){
  const a=await sponsorAnalyticsV36(uid,id);
  const events=[];
  events.push(`🆕 Created · ${when18(a.o.created_at)}`);
  if(a.o.activated_at||a.o.tx_verified_at)events.push(`✅ Payment confirmed · ${when18(a.o.activated_at||a.o.tx_verified_at)}`);
  const tops=(a.topups||[]).slice(0,5);
  for(const x of tops){
    events.push(`${x.status==='credited'?'➕':'🟡'} +${sponsorNumV30(x.added_completions)} completions · ${x.status==='credited'?'credited':'payment pending'} · ${when18(x.activated_at||x.created_at)}`);
  }
  if(a.stat.first_at)events.push(`👤 First completion · ${when18(a.stat.first_at)}`);
  if(a.stat.last_at)events.push(`⚡ Latest completion · ${when18(a.stat.last_at)}`);
  return{text:`📜 CAMPAIGN HISTORY

${a.o.title}

${events.join('\n')}

Current: ${a.done}/${a.max} completed · ${a.remaining} remaining`,markup:kb18([
    [cb18('📊 INSIGHTS',`stm36:insights:${id}`)],
    [cb18('◀️ BACK TO TASK',`stm30:show:${id}`)]
  ])};
}

async function sponsorMoreCardV36(uid,id){
  const o=await sponsorOrderV30(uid,id);
  if(!o)throw new Error('order_not_found');
  const rows=[
    [cb18('♻️ DUPLICATE CAMPAIGN',`stm36:dupask:${id}`)],
    [cb18('📜 HISTORY',`stm36:history:${id}`)]
  ];
  if(o.target_url)rows.push([url18('🔗 OPEN TARGET',o.target_url)]);
  rows.push([cb18('◀️ BACK TO TASK',`stm30:show:${id}`)]);
  return{text:`⚙️ CAMPAIGN TOOLS

${o.title}

♻️ Duplicate creates a new unpaid campaign with the same target, reward and capacity.
📜 History shows payment, top-ups and completion activity.

The target itself is never changed by these tools.`,markup:kb18(rows)};
}

async function sponsorAddMenuV36(uid,id){
  const o=await sponsorOrderV30(uid,id);
  if(!o||o.status!=='live')throw new Error('task_not_live');
  return{text:`＋ ADD COMPLETIONS

${o.title}

Choose capacity to add:

100 · $0.30
250 · $0.75
500 · $1.50
1000 · $3.00

A TON payment request will be created. Nothing is charged automatically.`,markup:kb18([
    [cb18('＋100 · $0.30',`stm36:add:${id}:100`),cb18('＋250 · $0.75',`stm36:add:${id}:250`)],
    [cb18('＋500 · $1.50',`stm36:add:${id}:500`),cb18('＋1000 · $3.00',`stm36:add:${id}:1000`)],
    [cb18('◀️ BACK TO TASK',`stm30:show:${id}`)]
  ])};
}

async function sponsorOverviewV36(uid){
  const d=await sponsorManagerDataV30(uid);
  const live=(d.orders||[]).filter(x=>x.status==='live');
  const paid=live.reduce((a,x)=>a+(sponsorNumV30(x.gross_price_usdt)||sponsorNumV30(x.target_completions)/100*.30),0);
  const done=live.reduce((a,x)=>a+sponsorNumV30(x.completed_count),0);
  const capacity=live.reduce((a,x)=>a+sponsorNumV30(x.max_completions||x.target_completions),0);
  const active=live.filter(x=>sponsorNumV30(x.remaining_completions)>0&&x.task_enabled!==false).length;
  const paused=live.filter(x=>sponsorNumV30(x.remaining_completions)>0&&x.task_enabled===false).length;
  const pct=capacity?Math.floor(done/capacity*100):0;
  return{text:`📈 ADVERTISER PERFORMANCE

Campaigns: ${d.counts.total}
🟢 Active: ${active}
⏸ Paused: ${paused}
✅ Completed campaigns: ${d.counts.completed}

👥 Total completions: ${done}/${capacity}
📊 Overall fill: ${pct}%
💵 Campaign value: $${paid.toFixed(2)}

Open a campaign for detailed 24h/7d analytics.`,markup:kb18([
    [cb18('📚 ALL CAMPAIGNS','stm30:list:all')],
    [cb18('🏠 TASK STUDIO','stm30:home')]
  ])};
}

async function handleSponsorFeaturesV36(up,uid,text,m,q){
  uid=Number(q?.from?.id||m?.from?.id||uid||0);
  if(!q||!String(q.data||'').startsWith('stm36:'))return false;
  const p=String(q.data).split(':'),act=p[1],id=p[2];
  try{
    if(act==='overview')await edit18(q,await sponsorOverviewV36(uid));
    else if(act==='insights')await edit18(q,await sponsorInsightsCardV36(uid,id));
    else if(act==='history')await edit18(q,await sponsorHistoryCardV36(uid,id));
    else if(act==='more')await edit18(q,await sponsorMoreCardV36(uid,id));
    else if(act==='addmenu')await edit18(q,await sponsorAddMenuV36(uid,id));
    else if(act==='add'){
      const x=await createSponsorTopupV30(uid,id,p[3]);
      await edit18(q,{text:`💎 TOP-UP PAYMENT

➕ ${x.added_completions} completions
💵 $${sponsorNumV30(x.price_usd).toFixed(2)}
💎 ${sponsorNumV30(x.package_ton).toFixed(6)} TON

🏦 TO
${x.payment_address}

📝 MEMO
${x.payment_memo}

Send the exact amount with the exact memo, then tap CHECK PAYMENT.`,markup:kb18([
        [cb18('✅ CHECK PAYMENT',`stm30:topcheck:${x.id}`)],
        [cb18('◀️ BACK TO TASK',`stm30:show:${id}`)]
      ])});
    }
    else if(act==='dupask'){
      const o=await sponsorOrderV30(uid,id);if(!o)throw new Error('order_not_found');
      const count=sponsorNumV30(o.max_completions||o.target_completions);
      await edit18(q,{text:`♻️ DUPLICATE CAMPAIGN?

${o.title}

Target: ${o.target_ref}
Capacity: ${count}
Reward: +${o.reward_per_completion} WIENER each

This only creates a NEW UNPAID order.
No TON is charged until you manually pay it.`,markup:kb18([
        [cb18('✅ CREATE COPY',`stm36:duplicate:${id}`)],
        [cb18('❌ CANCEL',`stm30:show:${id}`)]
      ])});
    }
    else if(act==='duplicate'){
      const o=await sponsorOrderV30(uid,id);if(!o)throw new Error('order_not_found');
      const count=Math.max(100,Math.floor(sponsorNumV30(o.max_completions||o.target_completions)));
      const x=await postLocalV10B('wiener-sponsored-task',{action:'create',telegram_id:uid,kind:o.task_kind,target:o.target_ref,completions:count,reward:sponsorNumV30(o.reward_per_completion)});
      await edit18(q,await sponsorBotShowV30(uid,x.id));
    } else return false;
    await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:'Updated'}).catch(()=>null);
    return true;
  }catch(e){
    await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:String(e?.message||e).replace(/_/g,' ').slice(0,180),show_alert:true}).catch(()=>null);
    return true;
  }
}

let sponsorAlertBusyV36=false;
async function sponsorAlertsV36(){
  if(sponsorAlertBusyV36)return;
  sponsorAlertBusyV36=true;
  try{
    await sponsorEnsureV36();
    const rows=(await pool.query(`
      select o.id,o.telegram_id,o.title,o.task_id,
        coalesce(t.completed_count,0)::int completed_count,
        greatest(coalesce(t.max_completions,o.target_completions,0),1)::int max_completions,
        greatest(coalesce(t.max_completions,o.target_completions,0)-coalesce(t.completed_count,0),0)::int remaining
      from public.exclusive_task_orders o
      join public.tasks t on t.id=o.task_id
      where o.status='live'
      order by o.updated_at desc
      limit 500
    `)).rows;
    for(const o of rows){
      const pct=Math.floor(sponsorNumV30(o.completed_count)/Math.max(1,sponsorNumV30(o.max_completions))*100);
      const reached=[25,50,75,90,100].filter(x=>pct>=x);
      let newest=[];
      for(const m of reached){
        const q=await pool.query(`insert into public.sponsored_task_alerts(order_id,telegram_id,alert_key) values($1,$2,$3) on conflict do nothing returning alert_key`,[o.id,o.telegram_id,'milestone_'+m]);
        if(q.rows[0])newest.push(m);
      }
      if(newest.length){
        const m=Math.max(...newest);
        const done=sponsorNumV30(o.completed_count),max=sponsorNumV30(o.max_completions),remaining=sponsorNumV30(o.remaining);
        await tgV10('sendMessage',{chat_id:o.telegram_id,text:`📊 Sponsored Task Update

${o.title}

${m>=100?'✅ Campaign completed!':`🎯 ${m}% milestone reached`}
📊 ${done}/${max} completed
🎯 ${remaining} remaining

Open /addtask to manage or add more completions.`}).catch(()=>null);
        continue;
      }
      const max=sponsorNumV30(o.max_completions),remaining=sponsorNumV30(o.remaining);
      const low=Math.max(20,Math.ceil(max*.10));
      if(remaining>0&&remaining<=low){
        const q=await pool.query(`insert into public.sponsored_task_alerts(order_id,telegram_id,alert_key) values($1,$2,'low_capacity') on conflict do nothing returning alert_key`,[o.id,o.telegram_id]);
        if(q.rows[0])await tgV10('sendMessage',{chat_id:o.telegram_id,text:`⚠️ Sponsored Task Running Low

${o.title}

Only ${remaining} completions remain.
Use /addtask → Add Completions to keep the campaign running.`}).catch(()=>null);
      }
    }
  }catch(e){console.error('sponsor_alerts_v36',String(e?.message||e))}
  finally{sponsorAlertBusyV36=false}
}

sponsorEnsureV36().catch(e=>console.error('sponsor_schema_v36',String(e?.message||e)));
setInterval(()=>sponsorAlertsV36(),60000).unref?.();

// === END WIENER SPONSORED INSIGHTS V36 ===
'''

s = s.replace(marker, "\n" + code + marker, 1)

hook = "    try{if(await handleSponsoredTaskManagerV30(up,uid,text,m,q)) return done();}catch(e){console.error('v30_sponsored_manager',String(e?.message||e));}\n"
if hook not in s:
    raise SystemExit("ERROR: V30 webhook hook not found")
s = s.replace(
    hook,
    "    try{if(await handleSponsorFeaturesV36(up,uid,text,m,q)) return done();}catch(e){console.error('v36_sponsored_features',String(e?.message||e));}\n" + hook,
    1
)

old_home_end = "[cb18('📚 ALL MY TASKS','stm30:list:all')]\n  ])};"
new_home_end = "[cb18('📚 ALL MY TASKS','stm30:list:all')],\n    [cb18('📈 PERFORMANCE','stm36:overview')]\n  ])};"
if old_home_end in s:
    s = s.replace(old_home_end, new_home_end, 1)
else:
    print("WARNING: home performance button insertion point not found")

s = s.replace(
    "// === WIENER ADDTASK V35B ===",
    "// === WIENER ADDTASK V35B ===\n// === WIENER SPONSORED INSIGHTS V36 ===",
    1
)

p.write_text(s)
print("V36 installed: analytics, history, duplicate, smart alerts, clean top-up menu")
