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
  const targetId=new URLSearchParams(window.location.search).get('task'),target=data.tasks.find(t=>t.id===targetId),initialCat=(target?.category==='partner'?'partner':'official');
  const [cat,setCat]=useState(initialCat),[botStates,setBotStates]=useState<Record<string,BotState>>({}),[normalStates,setNormalStates]=useState<Record<string,NormalState>>({}),[busy,setBusy]=useState('');
  const done=new Set(data.completed.map(x=>x.task_id)),visibleTasks=data.tasks.filter(tk=>tk.category!=='exclusive'),items=visibleTasks.filter(tk=>(tk.category||'official')===cat).sort((a,b)=>Number(done.has(a.id))-Number(done.has(b.id))),count=data.completed.filter(x=>visibleTasks.some(tk=>tk.id===x.task_id)).length;
  useEffect(()=>{if(target){setCat(target.category==='partner'?'partner':'official');setTimeout(()=>document.getElementById(`task-${target.id}`)?.scrollIntoView({behavior:'smooth',block:'center'}),120)}},[targetId]);
  useEffect(()=>{const bots=visibleTasks.filter(tk=>tk.verification==='bot_forward'&&!done.has(tk.id));Promise.all(bots.map(async tk=>{try{const s=await botTask('status',tk.id);return [tk.id,(s.verified?'verified':s.status==='pending'?'pending':'not_started') as BotState] as const}catch{return [tk.id,'not_started' as BotState] as const}})).then(rows=>setBotStates(v=>({...v,...Object.fromEntries(rows)})))},[data.tasks.length,data.completed.length]);
  const normalTask=async(task:any)=>{if(busy)return;const opened=normalStates[task.id]==='opened',external=task.verification==='external_visit',mini=task.task_type==='mini_app';try{if(!opened){setBusy(task.id);if(external)await taskApi(task.id,'begin_external');if(task.url){if(mini)window.Telegram?.WebApp?.openTelegramLink?.(task.url);else window.Telegram?.WebApp?.openLink?.(task.url)}setNormalStates(v=>({...v,[task.id]:'opened'}));say(mini?'Mini App opened. Stay at least 15 seconds, then return and tap CLAIM.':external?'Task opened. Stay at least 15 seconds, then return and tap CLAIM.':task.verification==='telegram_member'?'Join the channel/group, then return and tap CLAIM':'Open the task, then tap CLAIM');return}setBusy(task.id);await taskApi(task.id,'claim');say(`+${task.reward} W`);window.setTimeout(()=>window.location.reload(),450)}catch(e:any){const m=String(e.message||'Task verification failed');say(/^wait_\d+_seconds$/.test(m)?`Please wait ${m.match(/\d+/)?.[0]||'a few'} more seconds.`:m)}finally{setBusy('')}};
  const botAction=async(task:any)=>{if(busy)return;const state=botStates[task.id]||'not_started';try{setBusy(task.id);if(state==='not_started'){const x=await botTask('begin',task.id);setBotStates(v=>({...v,[task.id]:'pending'}));say(`Forward one message from @${x.bot_username} to WIENER bot, then tap CHECK`);const url=String(x.url||task.url||'');if(url)window.Telegram?.WebApp?.openTelegramLink?.(url);return}if(state==='pending'){const x=await botTask('status',task.id);if(x.verified){setBotStates(v=>({...v,[task.id]:'verified'}));say('✅ Verified — tap CLAIM to receive your reward')}else say('Not verified yet. Forward one message from the required bot to WIENER, then check again.');return}await taskApi(task.id,'claim');say(`+${task.reward} W`);window.setTimeout(()=>window.location.reload(),450)}catch(e:any){say(e.message||'Verification failed')}finally{setBusy('')}};
  return <>
    <style>{`
      .task-tabs{display:grid!important;grid-template-columns:1fr 1fr;gap:8px;padding:6px;margin:14px 0 16px;border:1px solid rgba(255,255,255,.08);border-radius:20px;background:rgba(0,24,14,.38);box-shadow:inset 0 1px 0 rgba(255,255,255,.04)}
      .task-tabs button{min-width:0!important;width:100%!important;height:48px!important;margin:0!important;border:1px solid transparent!important;border-radius:15px!important;background:transparent!important;color:rgba(255,255,255,.58)!important;font-size:14px!important;font-weight:850!important;letter-spacing:.1px!important;box-shadow:none!important;transition:.18s ease}
      .task-tabs button.active{background:linear-gradient(180deg,#fff16a,#ffd21a)!important;color:#251f00!important;border-color:rgba(255,255,255,.38)!important;box-shadow:0 8px 20px rgba(255,210,26,.16),inset 0 1px 0 rgba(255,255,255,.65)!important}
      .task-tabs button:not(.active):active{background:rgba(255,255,255,.06)!important}
      .task-list{overflow:hidden;padding:6px 14px!important;width:100%!important;box-sizing:border-box!important}
      .premium-task-row{display:flex!important;align-items:center!important;gap:12px!important;min-height:76px;padding:14px 0!important;border-bottom:1px solid rgba(255,255,255,.065);width:100%!important;box-sizing:border-box!important}
      .premium-task-row:last-child{border-bottom:0}
      .premium-task-row.target-task{margin:0 -8px;padding-left:8px!important;padding-right:8px!important;border-radius:16px;background:rgba(255,220,60,.06)}
      .task-avatar{flex:0 0 46px!important;width:46px!important;height:46px!important;display:grid;place-items:center;overflow:hidden;border-radius:15px;border:1px solid rgba(255,255,255,.11);background:linear-gradient(145deg,rgba(255,255,255,.09),rgba(255,255,255,.035));box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 6px 16px rgba(0,0,0,.15)}
      .task-avatar img{width:100%;height:100%;object-fit:cover;display:block}
      .task-avatar svg{width:26px;height:26px}
      .task-info{flex:1 1 0%!important;min-width:0!important;padding-right:4px}
      .task-title-line{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap;min-width:0}
      .task-title-line h3{margin:0;font-size:14px;font-weight:850;line-height:1.35;color:#fff;word-break:break-word;white-space:normal}
      .task-desc{margin:3px 0 0;font-size:11.5px;line-height:1.4;color:rgba(255,255,255,.62);word-break:break-word;white-space:normal}
      .task-type-pill{display:inline-block;padding:2px 6px;border-radius:6px;background:rgba(255,205,45,.09);border:1px solid rgba(255,205,45,.14);color:#ffd85a;font-size:8.5px;font-weight:900;letter-spacing:.4px;white-space:nowrap}
      .task-meta{display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0;margin-top:5px;font-size:11px;font-weight:800;color:rgba(255,255,255,.54)}
      .task-reward{color:#ffe45e;font-weight:950}
      .task-dot-sep{opacity:.35}
      .task-limit{white-space:nowrap}
      .task-status-mini{display:block;margin-top:4px;font-size:9.5px;font-weight:800;color:rgba(255,255,255,.45);word-break:break-word}
      .task-status-mini.ready{color:#82e9a2}
      .task-action{flex:0 0 auto!important;min-width:74px!important;height:38px!important;padding:0 12px!important;border-radius:12px!important;font-size:11px!important;font-weight:950!important;letter-spacing:.2px!important;white-space:nowrap!important}
      .task-action:disabled{opacity:.52!important;filter:saturate(.55)}
      @media(max-width:375px){
        .premium-task-row{gap:9px!important;padding:11px 0!important}
        .task-avatar{flex:0 0 40px!important;width:40px!important;height:40px!important;border-radius:12px}
        .task-avatar svg{width:22px;height:22px}
        .task-action{min-width:64px!important;height:35px!important;padding:0 8px!important;font-size:10.5px!important}
        .task-title-line h3{font-size:13px}
        .task-desc{font-size:10.5px}
      }
    `}</style>
    <section className="card progress-card">
      <div className="section-head">
        <div className="square check"><AnimatedIcon name="tasks" active/></div>
        <div>
          <h3>{t('tasks.progress','Your Progress')}</h3>
          <p>{count} {t('tasks.completed','current tasks completed')}</p>
        </div>
      </div>
      <div className="progress">
        <span style={{width:`${visibleTasks.length?Math.min(100,count/visibleTasks.length*100):0}%`}}/>
      </div>
    </section>
    <div className="tabs task-tabs">
      <button className={cat==='official'?'active':''} onClick={()=>setCat('official')}>
        {t('tasks.official','Official')}
      </button>
      <button className={cat==='partner'?'active':''} onClick={()=>setCat('partner')}>
        {t('tasks.partner','Partner')}
      </button>
    </div>
    <section className="card task-list">
      {items.length ? items.map(task=>{
        const isBot=task.verification==='bot_forward',isExternal=task.verification==='external_visit',isMini=task.task_type==='mini_app',state=botStates[task.id]||'not_started',normalOpened=normalStates[task.id]==='opened',completed=done.has(task.id);
        const label=completed?t('common.done','DONE'):busy===task.id?t('common.wait','WAIT'):isBot?(state==='verified'?t('common.claim','CLAIM'):state==='pending'?'CHECK':'START'):(normalOpened?t('common.claim','CLAIM'):isMini?'OPEN':isExternal?'OPEN':t('common.join','JOIN'));
        const doneCount=Number(task.completed_count||0),limit=Number(task.max_completions||0),remaining=limit?Math.max(0,limit-doneCount):0;
        const limitText=limit?(remaining>0&&remaining<=10?`${remaining} spots left`:`${doneCount} / ${limit}`):'Open task';
        const typeLabel=isMini?'MINI APP':isBot?'BOT':task.verification==='telegram_member'?'TELEGRAM':isExternal?'LINK':'TASK';
        const status=isBot&&state==='pending'?'Waiting for verification':isBot&&state==='verified'?'Reward ready':normalOpened?(isExternal?'Return after 15 sec · reward ready':'Ready to claim'):'';
        return <div className={`premium-task-row ${targetId===task.id?'target-task':''}`} id={`task-${task.id}`} key={task.id}>
          <TaskAvatar task={task} active={completed||state==='verified'}/>
          <div className="task-info">
            <div className="task-title-line">
              <h3>{task.title}</h3>
              <span className="task-type-pill">{typeLabel}</span>
            </div>
            {task.description && <p className="task-desc">{task.description}</p>}
            <div className="task-meta">
              <span className="task-reward">+{task.reward} W</span>
              <span className="task-dot-sep">•</span>
              <span className="task-limit">{limitText}</span>
            </div>
            {status&&<small className={`task-status-mini ${state==='verified'||normalOpened?'ready':''}`}>{status}</small>}
          </div>
          <button className="primary small task-action" disabled={completed||busy===task.id} onClick={()=>isBot?botAction(task):normalTask(task)}>
            {label}
          </button>
        </div>
      }) : cat==='official' ? null : <div className="empty">{t('tasks.none','No tasks right now.')}</div>}
    </section>
  </>;
}

