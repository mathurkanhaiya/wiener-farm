import {useEffect,useState} from 'react';
import {getInitData,PUBLISHABLE_KEY,SUPABASE_URL,type Snapshot} from './lib';
import {AnimatedIcon} from './icons';

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
  const targetId=new URLSearchParams(window.location.search).get('task'),target=data.tasks.find(t=>t.id===targetId),initialCat=(target?.category==='partner'?'partner':'official');
  const [cat,setCat]=useState(initialCat),[botStates,setBotStates]=useState<Record<string,BotState>>({}),[normalStates,setNormalStates]=useState<Record<string,NormalState>>({}),[busy,setBusy]=useState('');
  const done=new Set(data.completed.map(x=>x.task_id)),visibleTasks=data.tasks.filter(t=>t.category!=='exclusive'),items=visibleTasks.filter(t=>(t.category||'official')===cat).sort((a,b)=>Number(done.has(a.id))-Number(done.has(b.id))),count=data.completed.filter(x=>visibleTasks.some(t=>t.id===x.task_id)).length;
  useEffect(()=>{if(target){setCat(target.category==='partner'?'partner':'official');setTimeout(()=>document.getElementById(`task-${target.id}`)?.scrollIntoView({behavior:'smooth',block:'center'}),120)}},[targetId]);
  useEffect(()=>{const bots=visibleTasks.filter(t=>t.verification==='bot_forward'&&!done.has(t.id));Promise.all(bots.map(async t=>{try{const s=await botTask('status',t.id);return [t.id,(s.verified?'verified':s.status==='pending'?'pending':'not_started') as BotState] as const}catch{return [t.id,'not_started' as BotState] as const}})).then(rows=>setBotStates(v=>({...v,...Object.fromEntries(rows)})))},[data.tasks.length,data.completed.length]);
  const normalTask = async (t: any) => {
    if (busy) return;
    const opened = normalStates[t.id] === 'opened';
    const external = t.verification === 'external_visit';
    const mini = t.task_type === 'mini_app';
    try {
      if (!opened) {
        setBusy(t.id);
        if (external) await taskApi(t.id, 'begin_external');
        if (t.url) {
          if (mini) window.Telegram?.WebApp?.openTelegramLink?.(t.url);
          else window.Telegram?.WebApp?.openLink?.(t.url);
        }
        setNormalStates(v => ({ ...v, [t.id]: 'opened' }));
        say(mini ? 'Mini App opened. Stay at least 15 seconds, then return and tap CLAIM.' : external ? 'Task opened. Stay at least 15 seconds, then return and tap CLAIM.' : t.verification === 'telegram_member' ? 'Join the channel/group, then return and tap CLAIM' : 'Open the task, then tap CLAIM');
        return;
      }
      setBusy(t.id);
      await taskApi(t.id, 'claim');
      say(`+${t.reward} W`);
      window.setTimeout(() => window.location.reload(), 450);
    } catch (e: any) {
      const m = String(e.message || 'Task verification failed');
      say(/^wait_\d+_seconds$/.test(m) ? `Please wait ${m.match(/\d+/)?.[0] || 'a few'} more seconds.` : m);
    } finally {
      setBusy('');
    }
  };

  const botAction = async (t: any) => {
    if (busy) return;
    const state = botStates[t.id] || 'not_started';
    try {
      setBusy(t.id);
      if (state === 'not_started') {
        const x = await botTask('begin', t.id);
        setBotStates(v => ({ ...v, [t.id]: 'pending' }));
        say(`Forward one message from @${x.bot_username} to WIENER bot, then tap CHECK`);
        const url = String(x.url || t.url || '');
        if (url) window.Telegram?.WebApp?.openTelegramLink?.(url);
        return;
      }
      if (state === 'pending') {
        const x = await botTask('status', t.id);
        if (x.verified) {
          setBotStates(v => ({ ...v, [t.id]: 'verified' }));
          say('✅ Verified — tap CLAIM to receive your reward');
        } else {
          say('Not verified yet. Forward one message from the required bot to WIENER, then check again.');
        }
        return;
      }
      await taskApi(t.id, 'claim');
      say(`+${t.reward} W`);
      window.setTimeout(() => window.location.reload(), 450);
    } catch (e: any) {
      say(e.message || 'Verification failed');
    } finally {
      setBusy('');
    }
  };

  const progressPercent = visibleTasks.length ? Math.min(100, Math.round((count / visibleTasks.length) * 100)) : 0;

  return (
    <>
      <style>{`
        #tasks-list-container.task-list {
          padding: 0 !important;
          overflow: hidden !important;
          background: rgba(14, 18, 26, 0.94) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          border-radius: 20px !important;
          box-sizing: border-box !important;
          width: 100% !important;
        }
        .task-tabs {
          display: flex !important;
          gap: 8px !important;
          margin: 4px 0 12px !important;
          width: 100% !important;
          box-sizing: border-box !important;
        }
        .task-tabs button {
          flex: 1 1 0 !important;
          height: 42px !important;
          border-radius: 14px !important;
          font-size: 13px !important;
          font-weight: 800 !important;
          background: rgba(255, 255, 255, 0.06) !important;
          border: 1px solid rgba(255, 255, 255, 0.09) !important;
          color: var(--wf-text-secondary, #94a3b8) !important;
          cursor: pointer !important;
          transition: all 0.16s ease !important;
        }
        .task-tabs button.active {
          background: var(--wf-gold-gradient, linear-gradient(135deg, #f59e0b 0%, #d97706 100%)) !important;
          border-color: rgba(255, 255, 255, 0.4) !important;
          color: #3b1903 !important;
          box-shadow: 0 4px 14px rgba(245, 158, 11, 0.35) !important;
        }
        .premium-task-row {
          display: flex !important;
          align-items: center !important;
          gap: 12px !important;
          padding: 14px 16px !important;
          border-bottom: 1px solid rgba(255, 255, 255, 0.065) !important;
          box-sizing: border-box !important;
          width: 100% !important;
          min-width: 0 !important;
          transition: background 0.15s ease !important;
        }
        .premium-task-row:last-child {
          border-bottom: 0 !important;
        }
        .premium-task-row.target-task {
          background: rgba(245, 158, 11, 0.08) !important;
          border-left: 3px solid #f59e0b !important;
        }
        .task-avatar {
          width: 44px !important;
          height: 44px !important;
          min-width: 44px !important;
          max-width: 44px !important;
          border-radius: 14px !important;
          background: rgba(255, 255, 255, 0.06) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          overflow: hidden !important;
          display: grid !important;
          place-items: center !important;
          flex-shrink: 0 !important;
        }
        .task-avatar img {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          display: block !important;
        }
        .task-info {
          flex: 1 1 auto !important;
          min-width: 0 !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 3px !important;
          overflow: hidden !important;
        }
        .task-title-line {
          display: flex !important;
          align-items: center !important;
          gap: 6px !important;
          flex-wrap: wrap !important;
          min-width: 0 !important;
        }
        .task-title-line h3 {
          margin: 0 !important;
          font-size: 14px !important;
          font-weight: 750 !important;
          line-height: 1.3 !important;
          color: #fff !important;
          word-break: break-word !important;
          overflow-wrap: break-word !important;
          min-width: 0 !important;
        }
        .task-type-pill {
          display: inline-block !important;
          font-size: 9px !important;
          font-weight: 900 !important;
          letter-spacing: 0.04em !important;
          padding: 2px 6px !important;
          border-radius: 6px !important;
          background: rgba(245, 158, 11, 0.12) !important;
          border: 1px solid rgba(245, 158, 11, 0.28) !important;
          color: #fef08a !important;
          text-transform: uppercase !important;
          white-space: nowrap !important;
          flex-shrink: 0 !important;
        }
        .task-desc {
          margin: 2px 0 0 !important;
          font-size: 12px !important;
          line-height: 1.35 !important;
          color: rgba(255, 255, 255, 0.62) !important;
          word-break: break-word !important;
          overflow-wrap: break-word !important;
        }
        .task-meta {
          display: flex !important;
          align-items: center !important;
          gap: 6px !important;
          margin-top: 3px !important;
          font-size: 12px !important;
          font-weight: 700 !important;
          flex-wrap: wrap !important;
        }
        .task-reward {
          color: #f59e0b !important;
          font-weight: 800 !important;
          font-variant-numeric: tabular-nums !important;
        }
        .task-dot-sep {
          color: rgba(255, 255, 255, 0.25) !important;
          font-size: 10px !important;
        }
        .task-limit {
          color: rgba(255, 255, 255, 0.45) !important;
          font-size: 11px !important;
          font-weight: 600 !important;
        }
        .task-status-mini {
          display: inline-block !important;
          margin-top: 3px !important;
          font-size: 11px !important;
          font-weight: 700 !important;
          color: #38bdf8 !important;
          word-break: break-word !important;
        }
        .task-status-mini.ready {
          color: #34d399 !important;
        }
        button.task-action {
          flex-shrink: 0 !important;
          min-width: 68px !important;
          max-width: 84px !important;
          height: 36px !important;
          padding: 0 12px !important;
          border-radius: 12px !important;
          font-size: 12px !important;
          font-weight: 850 !important;
          letter-spacing: 0.02em !important;
          white-space: nowrap !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
        }
        @media (max-width: 420px) {
          .premium-task-row {
            padding: 12px 10px !important;
            gap: 10px !important;
          }
          .task-avatar {
            width: 38px !important;
            height: 38px !important;
            min-width: 38px !important;
            border-radius: 12px !important;
          }
          .task-title-line h3 {
            font-size: 13px !important;
          }
          .task-desc {
            font-size: 11.5px !important;
          }
          button.task-action {
            min-width: 62px !important;
            height: 34px !important;
            font-size: 11.5px !important;
            padding: 0 8px !important;
          }
        }
      `}</style>
      <section className="card progress-card" id="tasks-progress-card">
        <div className="section-head">
          <div className="square check">
            <AnimatedIcon name="tasks" active />
          </div>
          <div>
            <h3>Your Progress</h3>
            <p>{count} current tasks completed</p>
          </div>
        </div>
        <div className="progress">
          <span style={{ width: `${progressPercent}%` }} />
        </div>
      </section>

      <div className="tabs task-tabs" id="tasks-filter-tabs">
        <button
          id="tab-official-tasks"
          type="button"
          className={cat === 'official' ? 'active' : ''}
          onClick={() => setCat('official')}
        >
          Official
        </button>
        <button
          id="tab-partner-tasks"
          type="button"
          className={cat === 'partner' ? 'active' : ''}
          onClick={() => setCat('partner')}
        >
          Partner
        </button>
      </div>

      <section className="card task-list" id="tasks-list-container">
        {items.length > 0 ? (
          items.map(t => {
            const isBot = t.verification === 'bot_forward';
            const isExternal = t.verification === 'external_visit';
            const isMini = t.task_type === 'mini_app';
            const state = botStates[t.id] || 'not_started';
            const normalOpened = normalStates[t.id] === 'opened';
            const completed = done.has(t.id);
            const label = completed
              ? 'DONE'
              : busy === t.id
              ? 'WAIT'
              : isBot
              ? state === 'verified'
                ? 'CLAIM'
                : state === 'pending'
                ? 'CHECK'
                : 'START'
              : normalOpened
              ? 'CLAIM'
              : isMini
              ? 'OPEN'
              : isExternal
              ? 'OPEN'
              : 'JOIN';
            const doneCount = Number(t.completed_count || 0);
            const limit = Number(t.max_completions || 0);
            const remaining = limit ? Math.max(0, limit - doneCount) : 0;
            const limitText = limit
              ? remaining > 0 && remaining <= 10
                ? `${remaining} spots left`
                : `${doneCount} / ${limit}`
              : 'Open task';
            const typeLabel = isMini
              ? 'MINI APP'
              : isBot
              ? 'BOT'
              : t.verification === 'telegram_member'
              ? 'TELEGRAM'
              : isExternal
              ? 'LINK'
              : 'TASK';
            const status =
              isBot && state === 'pending'
                ? 'Waiting for verification'
                : isBot && state === 'verified'
                ? 'Reward ready'
                : normalOpened
                ? isExternal
                  ? 'Return after 15 sec · reward ready'
                  : 'Ready to claim'
                : '';

            return (
              <div
                className={`premium-task-row ${targetId === t.id ? 'target-task' : ''}`}
                id={`task-${t.id}`}
                key={t.id}
              >
                <TaskAvatar task={t} active={completed || state === 'verified'} />
                <div className="task-info">
                  <div className="task-title-line">
                    <h3>{t.title}</h3>
                    <span className="task-type-pill">{typeLabel}</span>
                  </div>
                  {t.description ? <p className="task-desc">{t.description}</p> : null}
                  <div className="task-meta">
                    <span className="task-reward">+{t.reward} W</span>
                    <span className="task-dot-sep">•</span>
                    <span className="task-limit">{limitText}</span>
                  </div>
                  {status ? (
                    <small
                      className={`task-status-mini ${
                        state === 'verified' || normalOpened ? 'ready' : ''
                      }`}
                    >
                      {status}
                    </small>
                  ) : null}
                </div>
                <button
                  id={`btn-task-action-${t.id}`}
                  type="button"
                  className="primary small task-action"
                  disabled={completed || busy === t.id}
                  onClick={() => (isBot ? botAction(t) : normalTask(t))}
                >
                  {label}
                </button>
              </div>
            );
          })
        ) : cat === 'official' ? (
          <div className="empty" id="empty-tasks">No tasks right now.</div>
        ) : (
          <div className="empty" id="empty-tasks">No partner tasks right now.</div>
        )}
      </section>
    </>
  );
}
