import {useEffect,useRef,useState} from 'react';
import {adsgramTaskApi,getInitData,PUBLISHABLE_KEY,SUPABASE_URL,type Snapshot} from './lib';
import {AnimatedIcon} from './icons';

type BotState='not_started'|'pending'|'verified';
type NormalState='idle'|'opened';
type AdsTaskState='loading'|'ready'|'crediting'|'waiting'|'unavailable'|'error'|'restart'|'completed';

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

async function ensureAdsGramTaskSdk(){
  if(customElements.get('adsgram-task'))return;
  let script=document.querySelector<HTMLScriptElement>('script[src*="sad.adsgram.ai/js/sad.min.js"]');
  if(!script){script=document.createElement('script');script.src='https://sad.adsgram.ai/js/sad.min.js';script.async=true;document.head.appendChild(script)}
  await Promise.race([customElements.whenDefined('adsgram-task'),new Promise((_,reject)=>setTimeout(()=>reject(new Error('AdsGram Task SDK did not load')),12000))]);
}

function AdsGramTaskBlock({say}:{say:(s:string)=>void}){
  const mount=useRef<HTMLDivElement|null>(null),sessionRef=useRef<Promise<any>|null>(null),[cycle,setCycle]=useState(0),[state,setState]=useState<AdsTaskState>('loading');
  useEffect(()=>{
    let active=true,rewarded=false,retry:any=null,nextTaskTimer:any=null,completedPoll:any=null;
    const root=mount.current;if(!root)return;root.innerHTML='';setState('loading');
    const retryFresh=(ms=12000)=>{if(retry)clearTimeout(retry);retry=window.setTimeout(()=>{if(active)setCycle(v=>v+1)},ms)};
    (async()=>{try{
      await ensureAdsGramTaskSdk();if(!active)return;
      if(!sessionRef.current)sessionRef.current=adsgramTaskApi('start');
      const el=document.createElement('adsgram-task') as HTMLElement;el.className='adsgram-native-task';el.setAttribute('data-block-id','task-44148');el.setAttribute('data-debug','false');el.setAttribute('data-debug-console','false');
      const reward=document.createElement('span');reward.slot='reward';reward.className='adsgram-task-reward';reward.textContent='+3.75 WIENER';
      const button=document.createElement('span');button.slot='button';button.className='adsgram-task-button';button.textContent='START';
      const claim=document.createElement('span');claim.slot='claim';claim.className='adsgram-task-button';claim.textContent='CLAIM';
      const done=document.createElement('span');done.slot='done';done.className='adsgram-task-button done';done.textContent='DONE';el.append(reward,button,claim,done);
      const onReward=async()=>{if(rewarded||!active)return;rewarded=true;setState('crediting');try{let session:any;try{session=await sessionRef.current}catch{sessionRef.current=adsgramTaskApi('start');session=await sessionRef.current}if(!active)return;const x=await adsgramTaskApi('reward',{session_id:session.session_id});if(!active)return;sessionRef.current=null;say(`+${Number(x?.reward||3.75)} WIENER`);setState('waiting');nextTaskTimer=window.setTimeout(()=>{if(active)setCycle(v=>v+1)},700)}catch(e:any){const m=String(e?.message||'Task reward failed');if(/task_session_(expired|not_found|closed)|task_already_completed/i.test(m))sessionRef.current=null;rewarded=false;setState('error');say(m);retryFresh(1200)}};
      const scheduleRetry=(next:AdsTaskState,ms=7000)=>{if(!active||rewarded)return;setState(next);retryFresh(ms)};
      el.addEventListener('reward',onReward as EventListener);
      el.addEventListener('onBannerNotFound',(()=>scheduleRetry('unavailable',12000)) as EventListener);
      el.addEventListener('onError',(()=>scheduleRetry('error',8000)) as EventListener);
      el.addEventListener('onTooLongSession',(()=>scheduleRetry('restart',900)) as EventListener);
      root.appendChild(el);setState('ready');

      completedPoll=window.setInterval(()=>{
        if(!active||rewarded)return;
        const shadow=(el as any).shadowRoot as ShadowRoot|null;
        const text=`${shadow?.textContent||''} ${el.textContent||''}`.toLowerCase();
        if(text.includes('task already completed')||text.includes('already completed')||text.includes('task completed')){
          setState('completed');
          el.style.visibility='hidden';
          retryFresh(15000);
        }
      },700);
    }catch{
      if(active){setState('error');retryFresh(8000)}
    }})();
    return()=>{active=false;if(retry)clearTimeout(retry);if(nextTaskTimer)clearTimeout(nextTaskTimer);if(completedPoll)clearInterval(completedPoll);if(root)root.innerHTML=''};
  },[cycle]);
  const covered=state!=='ready';
  return <div className={`adsgram-task-shell ${state}`}><style>{`.adsgram-task-shell{position:relative;border-bottom:1px solid rgba(255,255,255,.08);min-height:82px}.adsgram-task-shell:last-child{border-bottom:0}.adsgram-task-mount{min-height:82px}.adsgram-native-task{--adsgram-task-font-size:14px;--adsgram-task-icon-size:46px;--adsgram-task-icon-title-gap:14px;--adsgram-task-button-width:76px;--adsgram-task-icon-border-radius:15px;display:block;width:100%;padding:18px 0;background:transparent;color:#fff;font-family:inherit}.adsgram-task-reward{display:block;margin-top:4px;color:#a3b5a6;font-size:13px;font-weight:800}.adsgram-task-button{display:inline-flex;align-items:center;justify-content:center;min-width:76px;min-height:40px;padding:0 14px;border-radius:14px;background:linear-gradient(180deg,#fff05f,#ffd20b 63%,#edb900);color:#272000;font-size:12px;font-weight:950;letter-spacing:.5px}.adsgram-task-button.done{filter:saturate(.45);opacity:.7}.adsgram-task-status{position:absolute;inset:0;display:flex;align-items:center;gap:14px;padding:18px 0;background:linear-gradient(155deg,rgba(25,92,55,.98),rgba(15,73,43,.98));z-index:2}.adsgram-task-status .square{width:50px;height:50px;border-radius:16px}.adsgram-task-status b{display:block;font-size:15px}.adsgram-task-status small{display:block;margin-top:3px;color:#a3b5a6;font-size:12px;font-weight:700}.adsgram-task-dot{width:8px;height:8px;border-radius:50%;background:#ffe025;box-shadow:0 0 0 5px rgba(255,224,37,.12)}`}</style><div className="adsgram-task-mount" ref={mount}/>{covered&&<div className="adsgram-task-status"><div className="square check"><AnimatedIcon name="ads" active={state==='crediting'||state==='waiting'}/></div><div className="grow"><b>{state==='crediting'?'Claiming sponsored reward':state==='waiting'?'Loading next task':state==='completed'?'Loading next AdsGram task':state==='unavailable'?'No sponsored task right now':state==='restart'?'Refreshing sponsored task':state==='error'?'Refreshing sponsored task':'Loading sponsored task'}</b><small>{state==='waiting'?'Reward received · fetching next task…':state==='completed'?'Previous task finished. Checking for a new one…':state==='unavailable'||state==='error'||state==='restart'?'Checking again automatically…':'Please wait…'}</small></div><span className="adsgram-task-dot"/></div>}</div>
}

export function Tasks({data,run,say}:{data:Snapshot;run:any;say:(s:string)=>void;refresh?:()=>Promise<any>}){
  const targetId=new URLSearchParams(window.location.search).get('task'),target=data.tasks.find(t=>t.id===targetId),initialCat=(target?.category==='partner'?'partner':'official');
  const [cat,setCat]=useState(initialCat),[botStates,setBotStates]=useState<Record<string,BotState>>({}),[normalStates,setNormalStates]=useState<Record<string,NormalState>>({}),[busy,setBusy]=useState('');
  const done=new Set(data.completed.map(x=>x.task_id)),visibleTasks=data.tasks.filter(t=>t.category!=='exclusive'),items=visibleTasks.filter(t=>(t.category||'official')===cat).sort((a,b)=>Number(done.has(a.id))-Number(done.has(b.id))),count=data.completed.filter(x=>visibleTasks.some(t=>t.id===x.task_id)).length;
  useEffect(()=>{if(target){setCat(target.category==='partner'?'partner':'official');setTimeout(()=>document.getElementById(`task-${target.id}`)?.scrollIntoView({behavior:'smooth',block:'center'}),120)}},[targetId]);
  useEffect(()=>{const bots=visibleTasks.filter(t=>t.verification==='bot_forward'&&!done.has(t.id));Promise.all(bots.map(async t=>{try{const s=await botTask('status',t.id);return [t.id,(s.verified?'verified':s.status==='pending'?'pending':'not_started') as BotState] as const}catch{return [t.id,'not_started' as BotState] as const}})).then(rows=>setBotStates(v=>({...v,...Object.fromEntries(rows)})))},[data.tasks.length,data.completed.length]);
  const normalTask=async(t:any)=>{if(busy)return;const opened=normalStates[t.id]==='opened',external=t.verification==='external_visit',mini=t.task_type==='mini_app';try{if(!opened){setBusy(t.id);if(external)await taskApi(t.id,'begin_external');if(t.url){if(mini)window.Telegram?.WebApp?.openTelegramLink?.(t.url);else window.Telegram?.WebApp?.openLink?.(t.url)}setNormalStates(v=>({...v,[t.id]:'opened'}));say(mini?'Mini App opened. Stay at least 15 seconds, then return and tap CLAIM.':external?'Task opened. Stay at least 15 seconds, then return and tap CLAIM.':t.verification==='telegram_member'?'Join the channel/group, then return and tap CLAIM':'Open the task, then tap CLAIM');return}setBusy(t.id);await taskApi(t.id,'claim');say(`+${t.reward} WIENER`);window.setTimeout(()=>window.location.reload(),450)}catch(e:any){const m=String(e.message||'Task verification failed');say(/^wait_\d+_seconds$/.test(m)?`Please wait ${m.match(/\d+/)?.[0]||'a few'} more seconds.`:m)}finally{setBusy('')}};
  const botAction=async(t:any)=>{if(busy)return;const state=botStates[t.id]||'not_started';try{setBusy(t.id);if(state==='not_started'){const x=await botTask('begin',t.id);setBotStates(v=>({...v,[t.id]:'pending'}));say(`Forward one message from @${x.bot_username} to WIENER bot, then tap CHECK`);const url=String(x.url||t.url||'');if(url)window.Telegram?.WebApp?.openTelegramLink?.(url);return}if(state==='pending'){const x=await botTask('status',t.id);if(x.verified){setBotStates(v=>({...v,[t.id]:'verified'}));say('✅ Verified — tap CLAIM to receive your reward')}else say('Not verified yet. Forward one message from the required bot to WIENER, then check again.');return}await taskApi(t.id,'claim');say(`+${t.reward} WIENER`);window.setTimeout(()=>window.location.reload(),450)}catch(e:any){say(e.message||'Verification failed')}finally{setBusy('')}};
  return <><style>{`.task-tabs{display:grid!important;grid-template-columns:1fr 1fr;gap:8px;padding:6px;margin:14px 0 16px;border:1px solid rgba(255,255,255,.08);border-radius:20px;background:rgba(0,24,14,.38);box-shadow:inset 0 1px 0 rgba(255,255,255,.04)}.task-tabs button{min-width:0!important;width:100%!important;height:50px!important;margin:0!important;border:1px solid transparent!important;border-radius:15px!important;background:transparent!important;color:rgba(255,255,255,.58)!important;font-size:14px!important;font-weight:850!important;letter-spacing:.1px!important;box-shadow:none!important;transition:.18s ease}.task-tabs button.active{background:linear-gradient(180deg,#fff16a,#ffd21a)!important;color:#251f00!important;border-color:rgba(255,255,255,.38)!important;box-shadow:0 8px 20px rgba(255,210,26,.16),inset 0 1px 0 rgba(255,255,255,.65)!important}.task-tabs button:not(.active):active{background:rgba(255,255,255,.06)!important}.task-list{overflow:hidden;padding:4px 12px!important}.premium-task-row{display:grid;grid-template-columns:54px minmax(0,1fr) auto;align-items:center;gap:12px;min-height:82px;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.065)}.premium-task-row:last-child{border-bottom:0}.premium-task-row.target-task{margin:0 -8px;padding-left:8px;padding-right:8px;border-radius:16px;background:rgba(255,220,60,.06)}.task-avatar{width:54px;height:54px;display:grid;place-items:center;overflow:hidden;border-radius:17px;border:1px solid rgba(255,255,255,.11);background:linear-gradient(145deg,rgba(255,255,255,.09),rgba(255,255,255,.035));box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 8px 22px rgba(0,0,0,.16)}.task-avatar img{width:100%;height:100%;object-fit:cover;display:block}.task-avatar svg{width:30px;height:30px}.task-info{min-width:0}.task-title-line{display:flex;align-items:center;gap:6px;min-width:0}.task-title-line h3{margin:0;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;font-weight:900;line-height:1.25;color:#fff}.task-type-pill{flex:0 0 auto;padding:3px 6px;border-radius:7px;background:rgba(255,205,45,.09);border:1px solid rgba(255,205,45,.12);color:#ffd85a;font-size:8px;font-weight:950;letter-spacing:.45px}.task-meta{display:flex;align-items:center;gap:7px;min-width:0;margin-top:6px;font-size:11px;font-weight:800;color:rgba(255,255,255,.54)}.task-reward{color:#ffe45e;font-weight:950}.task-dot-sep{opacity:.35}.task-limit{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.task-status-mini{display:block;margin-top:4px;font-size:9px;font-weight:800;color:rgba(255,255,255,.42)}.task-status-mini.ready{color:#82e9a2}.task-action{min-width:78px!important;width:auto!important;height:40px!important;padding:0 13px!important;border-radius:13px!important;font-size:11px!important;font-weight:950!important;letter-spacing:.25px!important}.task-action:disabled{opacity:.52!important;filter:saturate(.55)}@media(max-width:370px){.premium-task-row{grid-template-columns:48px minmax(0,1fr) auto;gap:9px}.task-avatar{width:48px;height:48px;border-radius:15px}.task-action{min-width:68px!important;padding:0 10px!important}.task-type-pill{display:none}}`}</style><section className="card progress-card"><div className="section-head"><div className="square check"><AnimatedIcon name="tasks" active/></div><div><h3>Your Progress</h3><p>{count} current tasks completed</p></div></div><div className="progress"><span style={{width:`${visibleTasks.length?Math.min(100,count/visibleTasks.length*100):0}%`}}/></div></section><div className="tabs task-tabs"><button className={cat==='official'?'active':''} onClick={()=>setCat('official')}>Official</button><button className={cat==='partner'?'active':''} onClick={()=>setCat('partner')}>Partner</button></div><section className="card task-list">{cat==='official'&&<AdsGramTaskBlock say={say}/>} {items.length?items.map(t=>{const isBot=t.verification==='bot_forward',isExternal=t.verification==='external_visit',isMini=t.task_type==='mini_app',state=botStates[t.id]||'not_started',normalOpened=normalStates[t.id]==='opened',completed=done.has(t.id),label=completed?'DONE':busy===t.id?'WAIT':isBot?(state==='verified'?'CLAIM':state==='pending'?'CHECK':'START'):(normalOpened?'CLAIM':isMini?'OPEN':isExternal?'OPEN':'JOIN'),doneCount=Number(t.completed_count||0),limit=Number(t.max_completions||0),remaining=limit?Math.max(0,limit-doneCount):0,limitText=limit?(remaining>0&&remaining<=10?`${remaining} spots left`:`${doneCount} / ${limit}`):'Open task',typeLabel=isMini?'MINI APP':isBot?'BOT':t.verification==='telegram_member'?'TELEGRAM':isExternal?'LINK':'TASK',status=isBot&&state==='pending'?'Waiting for verification':isBot&&state==='verified'?'Reward ready':normalOpened?(isExternal?'Return after 15 sec · reward ready':'Ready to claim'):'';return <div className={`premium-task-row ${targetId===t.id?'target-task':''}`} id={`task-${t.id}`} key={t.id}><TaskAvatar task={t} active={completed||state==='verified'}/><div className="task-info"><div className="task-title-line"><h3>{t.title}</h3><span className="task-type-pill">{typeLabel}</span></div><div className="task-meta"><span className="task-reward">+{t.reward} WIENER</span><span className="task-dot-sep">•</span><span className="task-limit">{limitText}</span></div>{status&&<small className={`task-status-mini ${state==='verified'||normalOpened?'ready':''}`}>{status}</small>}</div><button className="primary small task-action" disabled={completed||busy===t.id} onClick={()=>isBot?botAction(t):normalTask(t)}>{label}</button></div>}):cat==='official'?null:<div className="empty">No partner tasks right now.</div>}</section></>;
}
