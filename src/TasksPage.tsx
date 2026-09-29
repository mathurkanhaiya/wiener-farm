import {useEffect,useState} from 'react';
import {getInitData,PUBLISHABLE_KEY,SUPABASE_URL,type Snapshot} from './lib';
import {AnimatedIcon} from './icons';
import {useI18n} from './i18n';

type BotState='not_started'|'pending'|'verified';
type NormalState='idle'|'opened';

async function botTask(action:'begin'|'status',taskId:string){const r=await fetch(`${SUPABASE_URL}/functions/v1/wiener-bot-task`,{method:'POST',headers:{'Content-Type':'application/json','apikey':PUBLISHABLE_KEY},body:JSON.stringify({action,task_id:taskId,initData:getInitData()})});const x=await r.json().catch(()=>({ok:false,error:'invalid_response'}));if(!r.ok||!x.ok)throw new Error(x.message||x.error||'Verification failed');return x.data}
async function taskApi(taskId:string,action='claim'){const r=await fetch(`${SUPABASE_URL}/functions/v1/wiener-task-api`,{method:'POST',headers:{'Content-Type':'application/json','apikey':PUBLISHABLE_KEY},body:JSON.stringify({action,task_id:taskId,initData:getInitData()})});const x=await r.json().catch(()=>({ok:false,error:'invalid_response'}));if(!r.ok||!x.ok)throw new Error(x.message||x.error||'Task verification failed');return x.data}

function telegramUsername(task:any){
  try{
    const u=new URL(String(task?.url||''));
    const host=String(u.hostname||'').toLowerCase();
    if(host==='t.me'||host==='www.t.me'||host==='telegram.me'){
      const first=u.pathname.split('/').filter(Boolean)[0]||'';
      if(/^[A-Za-z0-9_]{5,32}$/.test(first))return first;
    }
  }catch{}
  const chat=String(task?.telegram_chat_id||'').trim().replace(/^@/,'');
  if(/^[A-Za-z0-9_]{5,32}$/.test(chat))return chat;
  const found=String(task?.title||'').match(/@([A-Za-z0-9_]{5,32})/);
  return found?.[1]||'';
}
function telegramAvatar(task:any){const username=telegramUsername(task);return username?`https://t.me/i/userpic/320/${encodeURIComponent(username)}.jpg`:''}
function TaskAvatar({task,active=false}:{task:any;active?:boolean}){
  const [failed,setFailed]=useState(false),src=telegramAvatar(task);
  return <div className="task-avatar">{src&&!failed?<img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>:<AnimatedIcon name={task?.verification==='bot_forward'?'ads':'check'} active={active}/>}</div>
}

export function Tasks({data,run,say}:{data:Snapshot;run:any;say:(s:string)=>void;refresh?:()=>Promise<any>}){
  const {t}=useI18n();
  const targetId=new URLSearchParams(window.location.search).get('task');
  const target=data.tasks.find(x=>x.id===targetId);
  const [cat,setCat]=useState<'official'|'partner'>(target?.category==='partner'?'partner':'official');
  const [mode,setMode]=useState<'tasks'|'create'|'pending'|'live'|'manage'>('tasks');
  const [botStates,setBotStates]=useState<Record<string,BotState>>({});
  const [normalStates,setNormalStates]=useState<Record<string,NormalState>>({});
  const [busy,setBusy]=useState('');
  const [title,setTitle]=useState(''),[url,setUrl]=useState(''),[reward,setReward]=useState('');
  const [type,setType]=useState<'telegram'|'link'|'mini_app'>('telegram');

  const done=new Set(data.completed.map(x=>x.task_id));
  const all=data.tasks.filter(x=>x.category!=='exclusive');
  const official=all.filter(x=>(x.category||'official')==='official');
  const partner=all.filter(x=>(x.category||'official')==='partner');
  const items=(cat==='official'?official:partner).filter(x=>mode==='pending'?false:mode==='live'?true:true).sort((a,b)=>Number(done.has(a.id))-Number(done.has(b.id)));
  const completedCount=all.filter(x=>done.has(x.id)).length;
  const liveCount=all.filter(x=>Number(x.max_completions||0)===0||Number(x.completed_count||0)<Number(x.max_completions||0)).length;
  const pendingCount=all.filter(x=>!done.has(x.id)).length;

  useEffect(()=>{if(target){setCat(target.category==='partner'?'partner':'official');setMode('tasks');setTimeout(()=>document.getElementById('task-'+target.id)?.scrollIntoView({behavior:'smooth',block:'center'}),120)}},[targetId]);
  useEffect(()=>{const bots=all.filter(x=>x.verification==='bot_forward'&&!done.has(x.id));Promise.all(bots.map(async x=>{try{const s=await botTask('status',x.id);return [x.id,(s.verified?'verified':s.status==='pending'?'pending':'not_started') as BotState] as const}catch{return [x.id,'not_started' as BotState] as const}})).then(rows=>setBotStates(v=>({...v,...Object.fromEntries(rows)})))},[data.tasks.length,data.completed.length]);

  const normalTask=async(task:any)=>{if(busy)return;const opened=normalStates[task.id]==='opened',external=task.verification==='external_visit',mini=task.task_type==='mini_app';try{if(!opened){setBusy(task.id);if(external)await taskApi(task.id,'begin_external');if(task.url){if(mini)window.Telegram?.WebApp?.openTelegramLink?.(task.url);else window.Telegram?.WebApp?.openLink?.(task.url)}setNormalStates(v=>({...v,[task.id]:'opened'}));say(mini?'Mini App opened. Stay at least 15 seconds, then return and tap CLAIM.':external?'Task opened. Stay at least 15 seconds, then return and tap CLAIM.':task.verification==='telegram_member'?'Join the channel/group, then return and tap CLAIM':'Open the task, then tap CLAIM');return}setBusy(task.id);await taskApi(task.id,'claim');say('+'+task.reward+' W');setTimeout(()=>window.location.reload(),450)}catch(e:any){const m=String(e.message||'Task verification failed');say(/^wait_\\d+_seconds$/.test(m)?'Please wait '+(m.match(/\\d+/)?.[0]||'a few')+' more seconds.':m)}finally{setBusy('')}};
  const botAction=async(task:any)=>{if(busy)return;const state=botStates[task.id]||'not_started';try{setBusy(task.id);if(state==='not_started'){const x=await botTask('begin',task.id);setBotStates(v=>({...v,[task.id]:'pending'}));say('Forward one message from @'+x.bot_username+' to WIENER bot, then tap CHECK');if(x.url)window.Telegram?.WebApp?.openTelegramLink?.(String(x.url));return}if(state==='pending'){const x=await botTask('status',task.id);if(x.verified){setBotStates(v=>({...v,[task.id]:'verified'}));say('Verified — tap CLAIM to receive your reward')}else say('Not verified yet. Forward the required message, then CHECK.');return}await taskApi(task.id,'claim');say('+'+task.reward+' W');setTimeout(()=>window.location.reload(),450)}catch(e:any){say(e.message||'Verification failed')}finally{setBusy('')}};
  const saveDraft=()=>{if(!title.trim()||!url.trim()||!reward.trim()){say('Fill title, destination and reward first.');return}say('Task details saved as a draft. Publishing will be connected to the task backend.');setMode('tasks');setTitle('');setUrl('');setReward('')};

  return <main className="wf-tasks-redesign">
    <style>{`
      .wf-tasks-redesign{width:100%;max-width:560px;margin:0 auto;padding:4px 0 112px;color:#effff7;box-sizing:border-box}
      .wf-manage-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:2px 0 12px}
      .wf-manage-btn{min-height:67px;border:1px solid rgba(91,231,158,.13);border-radius:18px;background:linear-gradient(145deg,rgba(17,70,47,.72),rgba(5,34,24,.82));color:#9df0c4;font-size:11px;font-weight:950;letter-spacing:.04em;box-shadow:inset 0 1px 0 rgba(220,255,235,.04);transition:.18s ease}
      .wf-manage-btn strong{display:block;font-size:12px;color:#f0fff7;margin-bottom:3px}.wf-manage-btn span{font-size:8px;color:rgba(228,255,241,.38);font-weight:700}
      .wf-manage-btn.create{border-color:rgba(120,233,72,.25);color:#c9f36e;background:linear-gradient(145deg,rgba(47,94,27,.48),rgba(9,53,30,.82))}
      .wf-manage-btn.pending{color:#a8e9c7}.wf-manage-btn.live{color:#67eaa4}.wf-manage-btn.manage{color:#a7e8c7}
      .wf-manage-btn.active{border-color:rgba(83,232,154,.34);background:linear-gradient(145deg,rgba(20,105,67,.78),rgba(5,48,31,.9));box-shadow:0 8px 24px rgba(0,0,0,.12),inset 0 1px 0 rgba(255,255,255,.05)}
      .wf-task-hero{position:relative;overflow:hidden;padding:19px;border:1px solid rgba(91,231,158,.16);border-radius:24px;background:radial-gradient(circle at 88% 12%,rgba(55,229,139,.17),transparent 35%),linear-gradient(145deg,rgba(20,80,53,.82),rgba(5,35,25,.95));box-shadow:inset 0 1px 0 rgba(220,255,235,.05),0 14px 34px rgba(0,0,0,.14)}
      .wf-task-hero:after{content:"";position:absolute;right:-70px;bottom:-95px;width:220px;height:220px;border-radius:50%;background:rgba(54,220,135,.06)}
      .wf-kicker{font-size:9px;font-weight:950;letter-spacing:.25em;color:#5be39c}.wf-task-hero h2{margin:6px 0 6px;font-size:29px;line-height:1.02;letter-spacing:-.045em}.wf-task-hero p{margin:0;max-width:380px;font-size:11px;line-height:1.5;color:rgba(228,255,241,.56)}
      .wf-progress-row{display:flex;align-items:center;gap:11px;margin-top:18px}.wf-progress{height:7px;flex:1;border-radius:99px;background:rgba(255,255,255,.07);overflow:hidden}.wf-progress span{display:block;height:100%;border-radius:inherit;background:#39dc8d}.wf-progress-row b{font-size:11px;color:#86efb6;white-space:nowrap}
      .wf-main-tabs{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:5px;margin:12px 0 9px;border:1px solid rgba(91,231,158,.1);border-radius:17px;background:rgba(3,31,21,.52)}
      .wf-main-tabs button{height:42px;border:0;border-radius:12px;background:transparent;color:rgba(228,255,241,.45);font-size:10px;font-weight:950;letter-spacing:.1em}.wf-main-tabs button.active{background:rgba(45,215,133,.13);border:1px solid rgba(91,231,158,.15);color:#effff7}
      .wf-cats{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}.wf-cats button{height:38px;border:1px solid rgba(91,231,158,.1);border-radius:12px;background:rgba(7,42,28,.52);color:rgba(228,255,241,.45);font-size:9px;font-weight:950}.wf-cats button.active{background:#0ca653;color:#fff;border-color:rgba(104,255,179,.2)}
      .wf-task-list{display:flex;flex-direction:column;gap:8px}.wf-task-card{display:grid;grid-template-columns:45px minmax(0,1fr) auto;gap:10px;align-items:center;padding:11px;border:1px solid rgba(103,232,169,.12);border-radius:17px;background:linear-gradient(145deg,rgba(20,75,50,.72),rgba(6,39,27,.84));box-shadow:inset 0 1px 0 rgba(220,255,235,.025)}.wf-task-card.target{border-color:rgba(101,240,164,.35)}
      .wf-avatar{width:45px;height:45px;border-radius:14px;display:grid;place-items:center;overflow:hidden;background:rgba(50,207,130,.09);border:1px solid rgba(91,231,158,.12)}.wf-avatar img{width:100%;height:100%;object-fit:cover}.wf-avatar svg{width:24px;height:24px}
      .wf-copy{min-width:0}.wf-title{display:flex;align-items:center;gap:6px;min-width:0}.wf-title h3{margin:0;font-size:13px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.wf-pill{padding:3px 6px;border-radius:7px;background:rgba(84,225,151,.08);color:#72e8aa;font-size:7px;font-weight:950;white-space:nowrap}.wf-desc{margin:3px 0 0;font-size:9.5px;color:rgba(228,255,241,.45);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.wf-meta{display:flex;align-items:center;gap:7px;margin-top:5px;font-size:9px;color:rgba(228,255,241,.36)}.wf-meta b{font-size:11px;color:#65e5a1}.wf-status{margin-top:4px;font-size:8px;color:#69e4a3}
      .wf-action{height:34px!important;min-width:62px!important;padding:0 9px!important;border-radius:10px!important;background:#0ca653!important;color:#fff!important;border:1px solid rgba(104,255,179,.15)!important;font-size:9px!important;font-weight:950!important}.wf-action:disabled{opacity:.45!important}
      .wf-panel{padding:16px;border:1px solid rgba(91,231,158,.15);border-radius:20px;background:linear-gradient(145deg,rgba(20,79,52,.76),rgba(5,35,25,.91));box-shadow:inset 0 1px 0 rgba(255,255,255,.035)}
      .wf-panel-head{display:flex;align-items:center;gap:11px;margin-bottom:15px}.wf-panel-icon{width:43px;height:43px;border-radius:13px;display:grid;place-items:center;background:rgba(47,216,134,.1);border:1px solid rgba(91,231,158,.13);font-size:20px}.wf-panel h3{margin:0;font-size:15px}.wf-panel p{margin:3px 0 0;font-size:9px;color:rgba(228,255,241,.45)}
      .wf-label{display:block;margin:11px 0 6px;font-size:8px;font-weight:950;letter-spacing:.08em;color:rgba(228,255,241,.5)}.wf-input{width:100%;height:43px;box-sizing:border-box;border:1px solid rgba(91,231,158,.1);border-radius:12px;background:rgba(3,29,20,.8);color:#effff7;padding:0 12px;font:inherit;font-size:11px;outline:none}.wf-input:focus{border-color:rgba(91,231,158,.35)}.wf-types{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.wf-types button{height:38px;border:1px solid rgba(91,231,158,.1);border-radius:10px;background:rgba(3,29,20,.6);color:rgba(228,255,241,.46);font-size:8px;font-weight:900}.wf-types button.active{background:rgba(44,213,132,.13);color:#72e8aa;border-color:rgba(91,231,158,.22)}.wf-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:14px}.wf-actions button{height:42px;border-radius:12px;font-size:9px;font-weight:950}.wf-actions .cancel{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:rgba(255,255,255,.6)}.wf-actions .save{background:#0ca653;border:1px solid rgba(104,255,179,.16);color:#fff}.wf-note{margin-top:9px;padding:9px;border-radius:10px;background:rgba(255,255,255,.025);color:rgba(228,255,241,.32);font-size:8px;line-height:1.4}
      .wf-manage-info{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:10px}.wf-stat{padding:12px 8px;text-align:center;border:1px solid rgba(91,231,158,.1);border-radius:13px;background:rgba(7,42,28,.5)}.wf-stat b{display:block;font-size:16px;color:#76e8ad}.wf-stat span{font-size:7px;color:rgba(228,255,241,.38);font-weight:900;letter-spacing:.08em}
      .wf-empty{padding:25px;border:1px dashed rgba(103,232,169,.13);border-radius:16px;text-align:center;color:rgba(228,255,241,.4);font-size:11px}
      @media(max-width:390px){.wf-tasks-redesign{padding-bottom:108px}.wf-manage-grid{gap:7px}.wf-manage-btn{min-height:61px;border-radius:16px;font-size:10px}.wf-task-hero{padding:16px;border-radius:21px}.wf-task-hero h2{font-size:25px}.wf-task-card{grid-template-columns:40px minmax(0,1fr) auto;gap:8px;padding:9px}.wf-avatar{width:40px;height:40px;border-radius:12px}.wf-action{min-width:56px!important;padding:0 7px!important;font-size:8px!important}.wf-title h3{font-size:12px}.wf-desc{font-size:9px}}
      @media(max-width:340px){.wf-task-card{grid-template-columns:36px minmax(0,1fr) auto}.wf-avatar{width:36px;height:36px}.wf-title h3{font-size:11px}.wf-action{min-width:51px!important}}
    `}</style>

    <div className="wf-manage-grid">
      <button className={`wf-manage-btn create ${mode==='create'?'active':''}`} onClick={()=>setMode('create')}><strong>＋ CREATE TASK</strong><span>Promote your channel or app</span></button>
      <button className={`wf-manage-btn pending ${mode==='pending'?'active':''}`} onClick={()=>setMode('pending')}><strong>🟡 PENDING</strong><span>{pendingCount} tasks available</span></button>
      <button className={`wf-manage-btn live ${mode==='live'?'active':''}`} onClick={()=>setMode('live')}><strong>🟢 LIVE TASKS</strong><span>{liveCount} active tasks</span></button>
      <button className={`wf-manage-btn manage ${mode==='manage'?'active':''}`} onClick={()=>setMode('manage')}><strong>⚙️ MANAGE</strong><span>Task overview & controls</span></button>
    </div>

    <section className="wf-task-hero">
      <span className="wf-kicker">WIENER TASKS</span>
      <h2>Complete tasks.<br/>Earn W.</h2>
      <p>Simple verified tasks from Wiener and selected partners. Finish a task and claim your reward.</p>
      <div className="wf-progress-row"><div className="wf-progress"><span style={{width:`${all.length?Math.min(100,completedCount/all.length*100):0}%`}}/></div><b>{completedCount}/{all.length} done</b></div>
    </section>

    {mode==='create' ? <section className="wf-panel" style={{marginTop:10}}>
      <div className="wf-panel-head"><div className="wf-panel-icon">＋</div><div><h3>Create your own task</h3><p>Build a clean promotion for Wiener users.</p></div></div>
      <label className="wf-label">TASK TITLE</label><input className="wf-input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Join our Telegram channel"/>
      <label className="wf-label">DESTINATION URL</label><input className="wf-input" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://t.me/yourchannel"/>
      <label className="wf-label">REWARD PER USER (W)</label><input className="wf-input" value={reward} onChange={e=>setReward(e.target.value.replace(/[^0-9]/g,''))} inputMode="numeric" placeholder="100"/>
      <label className="wf-label">TASK TYPE</label><div className="wf-types"><button className={type==='telegram'?'active':''} onClick={()=>setType('telegram')}>TELEGRAM</button><button className={type==='link'?'active':''} onClick={()=>setType('link')}>LINK</button><button className={type==='mini_app'?'active':''} onClick={()=>setType('mini_app')}>MINI APP</button></div>
      <div className="wf-note">Your task will use the same verification and reward system as existing Wiener tasks. Review is required before publishing.</div>
      <div className="wf-actions"><button className="cancel" onClick={()=>setMode('tasks')}>CANCEL</button><button className="save" onClick={saveDraft}>SAVE DRAFT</button></div>
    </section> : mode==='manage' ? <section className="wf-panel" style={{marginTop:10}}>
      <div className="wf-panel-head"><div className="wf-panel-icon">⚙</div><div><h3>Task management</h3><p>Overview of the current task pool.</p></div></div>
      <div className="wf-manage-info"><div className="wf-stat"><b>{all.length}</b><span>TOTAL</span></div><div className="wf-stat"><b>{completedCount}</b><span>COMPLETED</span></div><div className="wf-stat"><b>{liveCount}</b><span>LIVE</span></div></div>
      <div className="wf-note">Task verification, rewards and completion limits are handled by the existing Wiener task system. No existing payment or claim logic is changed.</div>
    </section> : <>
      <div className="wf-main-tabs"><button className="active">TASKS</button><button onClick={()=>setMode('create')}>CREATE TASK</button></div>
      <div className="wf-cats"><button className={cat==='official'?'active':''} onClick={()=>setCat('official')}>OFFICIAL</button><button className={cat==='partner'?'active':''} onClick={()=>setCat('partner')}>PARTNER</button></div>
      <section className="wf-task-list">{items.length?items.map(task=>{
        const isBot=task.verification==='bot_forward',isExternal=task.verification==='external_visit',isMini=task.task_type==='mini_app',state=botStates[task.id]||'not_started',opened=normalStates[task.id]==='opened',completed=done.has(task.id);
        const label=completed?'DONE':busy===task.id?'WAIT':isBot?(state==='verified'?'CLAIM':state==='pending'?'CHECK':'START'):(opened?'CLAIM':isMini?'OPEN':isExternal?'OPEN':t('common.join','JOIN'));
        const limit=Number(task.max_completions||0),used=Number(task.completed_count||0),limitText=limit?(Math.max(0,limit-used)+' spots left'):'Open task';
        const typeLabel=isMini?'MINI APP':isBot?'BOT':task.verification==='telegram_member'?'TELEGRAM':isExternal?'LINK':'TASK';
        const status=isBot&&state==='pending'?'Waiting for verification':isBot&&state==='verified'?'Reward ready':opened?'Ready to claim':'';
        return <article className={`wf-task-card ${targetId===task.id?'target':''}`} id={`task-${task.id}`} key={task.id}><TaskAvatar task={task} active={completed||state==='verified'}/><div className="wf-copy"><div className="wf-title"><h3>{task.title}</h3><span className="wf-pill">{typeLabel}</span></div>{task.description&&<p className="wf-desc">{task.description}</p>}<div className="wf-meta"><b>+{task.reward} W</b><span>•</span><span>{limitText}</span></div>{status&&<div className="wf-status">{status}</div>}</div><button className="wf-action" disabled={completed||busy===task.id} onClick={()=>isBot?botAction(task):normalTask(task)}>{label}</button></article>
      )}):<div className="wf-empty">No {cat} tasks available right now.</div>}</section>
    </>}
  </main>;
}
