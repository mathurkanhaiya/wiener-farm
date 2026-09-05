from pathlib import Path

p = Path("/opt/wiener-backend/server.mjs")
s = p.read_text()
TAG = "WIENER ADDTASK V35B"
if TAG in s:
    print("V35B already installed")
    raise SystemExit(0)
if "WIENER SPONSORED TASK MANAGER V30" not in s:
    raise SystemExit("ERROR: V30 sponsored task manager is required")

def replace_between(src, start_marker, end_marker, new_block):
    a = src.find(start_marker)
    if a < 0:
        raise SystemExit("ERROR: start marker not found: " + start_marker)
    b = src.find(end_marker, a)
    if b < 0:
        raise SystemExit("ERROR: end marker not found: " + end_marker)
    return src[:a] + new_block + src[b:]

home = r'''async function sponsorBotHomeV30(uid){
  const d=await sponsorManagerDataV30(uid);
  const active=(d.orders||[]).filter(x=>x.status==='live'&&sponsorNumV30(x.remaining_completions)>0&&x.task_enabled!==false).length;
  const paused=(d.orders||[]).filter(x=>x.status==='live'&&sponsorNumV30(x.remaining_completions)>0&&x.task_enabled===false).length;
  return{text:`📣 TASK STUDIO

Create and manage sponsored tasks from one clean dashboard.

🟢 Live: ${active}
⏸ Paused: ${paused}
🟡 Awaiting payment: ${d.counts.pending}
✅ Completed: ${d.counts.completed}

💵 100 completions = $0.30
💎 TON payment · automatic detection`,markup:kb18([
    [cb18('＋ CREATE TASK','stm30:new')],
    [cb18(`🟢 LIVE ${active}`,'stm30:list:live'),cb18(`⏸ PAUSED ${paused}`,'stm30:list:paused')],
    [cb18(`🟡 PAYMENTS ${d.counts.pending}`,'stm30:list:pending'),cb18(`✅ DONE ${d.counts.completed}`,'stm30:list:done')],
    [cb18('📚 ALL MY TASKS','stm30:list:all')]
  ])};
}'''

listing = r'''async function sponsorBotListV30(uid,mode='all'){
  const d=await sponsorManagerDataV30(uid);let rows=d.orders||[];
  if(mode==='pending')rows=rows.filter(x=>x.status==='awaiting_payment');
  else if(mode==='live')rows=rows.filter(x=>x.status==='live'&&sponsorNumV30(x.remaining_completions)>0&&x.task_enabled!==false);
  else if(mode==='paused')rows=rows.filter(x=>x.status==='live'&&sponsorNumV30(x.remaining_completions)>0&&x.task_enabled===false);
  else if(mode==='done')rows=rows.filter(x=>x.status==='live'&&sponsorNumV30(x.remaining_completions)<=0);
  rows=rows.slice(0,10);
  const title=mode==='pending'?'AWAITING PAYMENT':mode==='live'?'LIVE TASKS':mode==='paused'?'PAUSED TASKS':mode==='done'?'COMPLETED TASKS':'ALL MY TASKS';
  const body=rows.map((x,i)=>{
    const max=sponsorNumV30(x.max_completions||x.target_completions),done=sponsorNumV30(x.completed_count),left=Math.max(0,max-done);
    const icon=x.status==='awaiting_payment'?'🟡':left<=0?'✅':x.task_enabled===false?'⏸':'🟢';
    return `${i+1}. ${icon} ${String(x.title||'Task').slice(0,32)}
   ${done}/${max} done · ${left} left · +${sponsorNumV30(x.reward_per_completion)} WIENER`;
  }).join('\n\n')||'No tasks here yet.';
  return{text:`📚 ${title}

${body}`,markup:kb18([
    ...rows.map(x=>[cb18(`${x.status==='awaiting_payment'?'💳':'⚙️'} ${String(x.title||'Task').slice(0,28)}`,`stm30:show:${x.id}`)]),
    [cb18('＋ CREATE TASK','stm30:new')],
    [cb18('◀️ TASK STUDIO','stm30:home')]
  ])};
}'''

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
    [cb18('◀️ MY TASKS','stm30:list:all'),cb18('🏠 STUDIO','stm30:home')]
  ])};
  const status=remaining<=0?'✅ COMPLETED':o.task_enabled===false?'⏸ PAUSED':'🟢 LIVE';
  const rows=[];
  if(remaining>0)rows.push([cb18(o.task_enabled===false?'▶️ RESUME':'⏸ PAUSE',`stm30:toggle:${o.id}:${o.task_enabled===false?'1':'0'}`),cb18('🔄 REFRESH',`stm30:show:${o.id}`)]);
  rows.push([cb18('＋100 · $0.30','stm30:add:'+o.id+':100'),cb18('＋250 · $0.75','stm30:add:'+o.id+':250')]);
  rows.push([cb18('＋500 · $1.50','stm30:add:'+o.id+':500'),cb18('＋1000 · $3.00','stm30:add:'+o.id+':1000')]);
  rows.push([cb18('◀️ MY TASKS','stm30:list:all'),cb18('🏠 STUDIO','stm30:home')]);
  return{text:`${status} · TASK

${o.title}

📊 ${done}/${max} completed · ${pct}%
🎯 ${remaining} remaining
🎁 +${o.reward_per_completion} WIENER / completion
🔗 ${o.target_url||'—'}

${remaining<=0?'Capacity completed. Add more completions to run it again.':o.task_enabled===false?'Task is paused. Resume it anytime.':'Task is active in Official Tasks.'}`,markup:kb18(rows)};
}'''

s = replace_between(
    s,
    "async function sponsorBotHomeV30(uid){",
    "\nasync function sponsorBotListV30",
    home
)
s = replace_between(
    s,
    "async function sponsorBotListV30(uid,mode='all'){",
    "\nasync function sponsorBotShowV30",
    listing
)
s = replace_between(
    s,
    "async function sponsorBotShowV30(uid,id){",
    "\n\nasync function handleSponsoredTaskManagerV30",
    show
)

old = "else if(act==='new'){await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:'Starting task creator'});await startAddtask18(uid);return true}"
new = '''else if(act==='new'){
      await clearAddtask18(uid);
      await pool.query(`insert into public.task_advertiser_sessions(telegram_id,step,wizard_chat_id,wizard_message_id,updated_at) values($1,'type',$2,$3,now())`,[uid,Number(q.message.chat.id),Number(q.message.message_id)]);
      await showAddtask18(await addtaskSession18(uid));
      await safeTg18('answerCallbackQuery',{callback_query_id:q.id,text:'Task creator opened'});
      return true
    }'''
if old not in s:
    raise SystemExit("ERROR: V30 create button handler not found")
s = s.replace(old, new, 1)

old_cmd = "{command:'addtask',description:'Create sponsored task'}"
if old_cmd in s:
    s = s.replace(old_cmd, "{command:'addtask',description:'Create & manage sponsored tasks'}", 1)

s = s.replace(
    "// === END WIENER SPONSORED TASK MANAGER V30 ===",
    "// === END WIENER SPONSORED TASK MANAER V30 ===\n// === WIENER ADDTASK V35B ===",
    1
)

p.write_text(s)
print("V35B installed: /addtask Task Studio cleaned and create button fixed")
