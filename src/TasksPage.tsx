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
  const [view,setView]=useState<'tasks'|'create'>('tasks');
  const [botStates,setBotStates]=useState<Record<string,BotState>>({});
  const [normalStates,setNormalStates]=useState<Record<string,NormalState>>({});
  const [busy,setBusy]=useState('');
  const [title,setTitle]=useState(''),[url,setUrl]=useState(''),[reward,setReward]=useState('');
  const [type,setType]=useState<'telegram'|'link'|'mini_app'>('telegram');
  const done=new Set(data.completed.map(x=>x.task_id));
  const all=data.tasks.filter(x=>x.category!=='exclusive');
  const items=all.filter(x=>(x.category||'official')===cat).sort((a,b)=>Number(done.has(a.id))-Number(done.has(b.id)));
  const completedCount=data.completed.filter(x=>all.some(t=>t.id===x.task_id)).length;

  useEffect(()=>{if(target){setCat(target.category==='partner'?'partner':'official');setView('tasks');setTimeout(()=>document.getElementById('task-'+target.id)?.scrollIntoView({behavior:'smooth',block:'center'}),120)}},[targetId]);
  useEffect(()=>{const bots=all.filter(x=>x.verification==='bot_forward'&&!done.has(x.id));Promise.all(bots.map(async x=>{try{const s=await botTask('status',x.id);return [x.id,(s.verified?'verified':s.status==='pending'?'pending':'not_started') as BotState] as const}catch{return [x.id,'not_started' as BotState] as const}})).then(rows=>setBotStates(v=>({...v,...Object.fromEntries(rows)})))},[data.tasks.length,data.completed.length]);

  const normalTask=async(task:any)=>{if(busy)return;const opened=normalStates[task.id]==='opened',external=task.verification==='external_visit',mini=task.task_type==='mini_app';try{if(!opened){setBusy(task.id);if(external)await taskApi(task.id,'begin_external');if(task.url)(mini?window.Telegram?.WebApp?.openTelegramLink:window.Telegram?.WebApp?.openLink)?.(task.url);setNormalStates(v=>({...v,[task.id]:'opened'}));say(mini?'Mini App opened. Stay 15 seconds, then return and CLAIM.':external?'Task opened. Stay 15 seconds, then return and CLAIM.':task.verification==='telegram_member'?'Join, then return and CLAIM.':'Open the task, then CLAIM.');return}setBusy(task.id);await taskApi(task.id,'claim');say('+'+task.reward+' W');setTimeout(()=>window.location.reload(),450)}catch(e:any){const m=String(e.message||'Task verification failed');say(/^wait_\\d+_seconds$/.test(m)?'Please wait '+(m.match(/\\d+/)?.[0]||'a few')+' more seconds.':m)}finally{setBusy('')}};
  const botAction=async(task:any)=>{if(busy)return;const state=botStates[task.id]||'not_started';try{setBusy(task.id);if(state==='not_started'){const x=await botTask('begin',task.id);setBotStates(v=>({...v,[task.id]:'pending'}));say('Forward one message from @'+x.bot_username+' to WIENER bot, then CHECK');if(x.url)window.Telegram?.WebApp?.openTelegramLink?.(String(x.url));return}if(state==='pending'){const x=await botTask('status',task.id);if(x.verified){setBotStates(v=>({...v,[task.id]:'verified'}));say('Verified — tap CLAIM.')}else say('Not verified yet. Forward the required message, then CHECK.');return}await taskApi(task.id,'claim');say('+'+task.reward+' W');setTimeout(()=>window.location.reload(),450)}catch(e:any){say(e.message||'Verification failed')}finally{setBusy('')}};
  const saveDraft=()=>{if(!title.trim()||!url.trim()||!reward.trim()){say('Fill title, destination and reward first.');return}say('Task draft saved. Publishing backend will be connected next.');setTitle('');setUrl('');setReward('');setView('tasks')};

  return <main className="wf-tasks-page">
    <style>{`
      .wf-tasks-page{width:100%;max-width:540px;margin:auto;padding:2px 0 112px;box-sizing:border-box;color:#effff7}
      .wf-task-hero,.wf-create-card{border:1px solid rgba(91,231,158,.15);border-radius:21px;background:linear-gradient(145deg,rgba(20,79,52,.78),rgba(5,35,25,.92));box-shadow:inset 0 1px 0 rgba(220,255,235,.04),0 12px 30px rgba(0,0,0,.12)}
      .wf-task-hero{position:relative;overflow:hidden;padding:18px;background:radial-gradient(circle at 88% 10%,rgba(57,226,139,.15),transparent 34%),linear-gradient(145deg,rgba(20,79,52,.82),rgba(5,35,25,.94))}
      .wf-task-kicker{font-size:9px;font-weight:950;letter-spacing:.2em;color:#55df9a}.wf-task-hero h2{margin:6px 0 5px;font-size:27px;line-height:1.05;letter-spacing:-.04em}.wf-task-hero p{margin:0;max-width:340px;font-size:11px;line-height:1.45;color:rgba(228,255,241,.58)}
      .wf-task-progress{display:flex;align-items:center;gap:10px;margin-top:17px}.wf-task-progress-track{height:6px;flex:1;border-radius:99px;background:rgba(255,255,255,.07);overflow:hidden}.wf-task-progress-track span{display:block;height:100%;background:#35dc8a;border-radius:99px}.wf-task-progress b{font-size:10px;color:#8aefba;white-space:nowrap}
      .wf-task-switch{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:5px;margin:12px 0 9px;border:1px solid rgba(91,231,158,.1);border-radius:17px;background:rgba(3,31,21,.5)}.wf-task-switch button{height:42px;border:0;border-radius:12px;background:transparent;color:rgba(228,255,241,.46);font-size:10px;font-weight:950;letter-spacing:.08em}.wf-task-switch button.active{background:rgba(44,213,132,.13);color:#f0fff7;border:1px solid rgba(91,231,158,.14)}
      .wf-task-cats{display:flex;gap:7px;margin-bottom:10px}.wf-task-cats button{flex:1;height:37px;border:1px solid rgba(91,231,158,.1);border-radius:11px;background:rgba(8,44,29,.5);color:rgba(228,255,241,.48);font-size:9px;font-weight:950}.wf-task-cats button.active{background:#0b9f50;color:white;border-color:rgba(104,255,179,.2)}
      .wf-task-list{display:flex;flex-direction:column;gap:8px}.wf-task-card{display:grid;grid-template-columns:45px minmax(0,1fr) auto;gap:10px;align-items:center;padding:11px;border:1px solid rgba(103,232,169,.12);border-radius:17px;background:linear-gradient(145deg,rgba(20,75,50,.72),rgba(6,39,27,.84));box-shadow:inset 0 1px 0 rgba(220,255,235,.025)}.wf-task-card.target{border-color:rgba(101,240,164,.35)}
      .wf-task-avatar{width:45px;height:45px;border-radius:14px;display:grid;place-items:center;overflow:hidden;background:rgba(50,207,130,.09);border:1px solid rgba(91,231,158,.12)}.wf-task-avatar img{width:100%;height:100%;object-fit:cover}.wf-task-avatar svg{width:24px;height:24px}
      .wf-task-copy{min-width:0}.wf-task-title{display:flex;align-items:center;gap:6px;min-width:0}.wf-task-title h3{margin:0;min-width:0;font-size:13px;line-height:1.3;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.wf-task-type{padding:3px 6px;border-radius:7px;background:rgba(84,225,151,.08);color:#72e8aa;font-size:7px;font-weight:950;letter-spacing:.08em;white-space:nowrap}.wf-task-desc{margin:3px 0 0;font-size:9.5px;color:rgba(228,255,241,.45);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.wf-task-meta{display:flex;gap:7px;align-items:center;margin-top:5px;font-size:9px;color:rgba(228,255,241,.36)}.wf-task-meta b{color:#62e6a0;font-size:11px}.wf-task-status{margin-top:4px;font-size:8px;color:#69e4a3}
      .wf-task-action{height:34px!important;min-width:62px!important;padding:0 9px!important;border-radius:10px!important;background:#0ca653!important;color:white!important;border:1px solid rgba(104,255,179,.15)!important;font-size:9px!important;font-weight:950!important}.wf-task-action:disabled{opacity:.45!important}.wf-empty{padding:25px;border:1px dashed rgba(103,232,169,.13);border-radius:16px;text-align:center;color:rgba(228,255,241,.4);font-size:11px}
      .wf-create-card{padding:15px;margin-top:10px}.wf-create-head{display:flex;align-items:center;gap:11px;margin-bottom:14px}.wf-create-icon{width:43px;height:43px;border-radius:13px;display:grid;place-items:center;background:rgba(47,216,134,.1);border:1px solid rgba(91,231,158,.13);font-size:21px}.wf-create-head h3{margin:0;font-size:15px}.wf-create-head p{margin:3px 0 0;font-size:9px;color:rgba(228,255,241,.45)}
      .wf-form-label{display:block;margin:11px 0 6px;font-size:8px;font-weight:950;letter-spacing:.08em;color:rgba(228,255,241,.5)}.wf-form-input{width:100%;height:43px;box-sizing:border-box;border:1px solid rgba(91,231,158,.1);border-radius:12px;background:rgba(3,29,20,.8);color:#effff7;padding:0 12px;font:inherit;font-size:11px;outline:none}.wf-form-input:focus{border-color:rgba(91,231,158,.35)}.wf-form-types{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.wf-form-types button{height:38px;border:1px solid rgba(91,231,158,.1);border-radius:10px;background:rgba(3,29,20,.6);color:rgba(228,255,241,.46);font-size:8px;font-weight:900}.wf-form-types button.active{background:rgba(44,213,132,.13);color:#72e8aa;border-color:rgba(91,231,158,.22)}.wf-create-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:14px}.wf-create-actions button{height:42px;border-radius:12px;font-size:9px;font-weight:950}.wf-create-actions .cancel{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:rgba(255,255,255,.6)}.wf-create-actions .publish{background:#0ca653;border:1px solid rgba(104,255,179,.16);color:white}.wf-create-note{margin-top:9px;padding:9px;border-radius:10px;background:rgba(255,255,255,.025);color:rgba(228,255,241,.32);font-size:8px;line-height:1.4}
      @media(max-width:390px){.wf-tasks-page{padding-bottom:108px}.wf-task-hero{padding:15px}.wf-task-hero h2{font-size:24px}.wf-task-card{grid-template-columns:40px minmax(0,1fr) auto;gap:8px;padding:9px}.wf-task-avatar{width:40px;height:40px;border-radius:12px}.wf-task-action{min-width:56px!important;padding:0 7px!important;font-size:8px!important}}@media(max-width:340px){.wf-task-card{grid-template-columns:36px minmax(0,1fr) auto}.wf-task-avatar{width:36px;height:36px}.wf-task-title h3{font-size:12px}.wf-task-action{min-width:51px!important}}
    `}</style>
    <section className="wf-task-hero"><span className="wf-task-kicker">WIENER TASKS</span><h2>Complete tasks.<br/>Earn W.</h2><p>Simple verified tasks from Wiener and selected partners. Finish a task and claim your reward.</p><div className="wf-task-progress"><div className="wf-task-progress-track"><span style={{width:`${all.length?Math.min(100,completedCount/all.length*100):0}%`}}/></div><b>{completedCount}/{all.length} done</b></div></section>
    <div className="wf-task-switch"><button className={view==='tasks'?'active':''} onClick={()=>setView('tasks')}>TASKS</button><button className={view==='create'?'active':''} onClick={()=>setView('create')}>CREATE TASK</button></div>
    {view==='tasks'?<>
      <div className="wf-task-cats"><button className={cat==='official'?'active':''} onClick={()=>setCat('official')}>OFFICIAL</button><button className={cat==='partner'?'active':''} onClick={()=>setCat('partner')}>PARTNER</button></div>
      <section className="wf-task-list">{items.length?items.map(task=>{
        const isBot=task.verification==='bot_forward',isExternal=task.verification==='external_visit',isMini=task.task_type==='mini_app',state=botStates[task.id]||'not_started',opened=normalStates[task.id]==='opened',completed=done.has(task.id);
        const label=completed?'DONE':busy===task.id?'WAIT':isBot?(state==='verified'?'CLAIM':state==='pending'?'CHECK':'START'):(opened?'CLAIM':isMini?'OPEN':isExternal?'OPEN':t('common.join','JOIN'));
        const limit=Number(task.max_completions||0),used=Number(task.completed_count||0),typeLabel=isMini?'MINI APP':isBot?'BOT':task.verification==='telegram_member'?'TELEGRAM':isExternal?'LINK':'TASK';
        return <article className={`wf-task-card ${targetId===task.id?'target':''}`} id={`task-${task.id}`} key={task.id}><TaskAvatar task={task} active={completed||state==='verified'}/><div className="wf-task-copy"><div className="wf-task-title"><h3>{task.title}</h3><span className="wf-task-type">{typeLabel}</span></div>{task.description&&<p className="wf-task-desc">{task.description}</p>}<div className="wf-task-meta"><b>+{task.reward} W</b><span>•</span><span>{limit?Math.max(0,limit-used)+' spots left':'Open task'}</span></div>{state==='pending'&&<div className="wf-task-status">Waiting for verification</div>}{state==='verified'&&<div className="wf-task-status">Reward ready</div>}{opened&&<div className="wf-task-status">Ready to claim</div>}</div><button className="wf-task-action" disabled={completed||busy===task.id} onClick={()=>isBot?botAction(task):normalTask(task)}>{label}</button></article>
      }):<div className="wf-empty">No {cat} tasks available right now.</div>}</section>
      <section className="wf-create-card"><div className="wf-create-head"><div className="wf-create-icon">＋</div><div><h3>Create your own task</h3><p>Promote a channel, link or Mini App to Wiener users.</p></div></div><button className="wf-task-action" style={{width:'100%'}} onClick={()=>setView('create')}>CREATE A TASK</button></section>
    </>:<section className="wf-create-card">
      <div className="wf-create-head"><div className="wf-create-icon">＋</div><div><h3>Create your own task</h3><p>Set the destination, reward and task type.</p></div></div>
      <label className="wf-form-label">TASK TITLE</label><input className="wf-form-input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Join our Telegram channel"/>
      <label className="wf-form-label">DESTINATION URL</label><input className="wf-form-input" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://t.me/yourchannel"/>
      <label className="wf-form-label">REWARD PER USER (W)</label><input className="wf-form-input" value={reward} onChange={e=>setReward(e.target.value.replace(/[^0-9]/g,''))} inputMode="numeric" placeholder="100"/>
      <label className="wf-form-label">TASK TYPE</label><div className="wf-form-types"><button className={type==='telegram'?'active':''} onClick={()=>setType('telegram')}>TELEGRAM</button><button className={type==='link'?'active':''} onClick={()=>setType('link')}>LINK VISIT</button><button className={type==='mini_app'?'active':''} onClick={()=>setType('mini_app')}>MINI APP</button></div>
      <div className="wf-create-note">Tasks are reviewed before becoming visible. Avoid misleading destinations or spam.</div><div className="wf-create-actions"><button className="cancel" onClick={()=>setView('tasks')}>CANCEL</button><button className="publish" onClick={saveDraft}>SAVE TASK</button></div>
    </section>}
  </main>;
}
