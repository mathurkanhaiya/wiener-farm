import {useEffect,useRef,useState} from 'react';
import {botTaskApi,taskApi,type Snapshot} from './lib';
import {AnimatedIcon} from './icons';
import {useI18n} from './i18n';

type BotState='not_started'|'pending'|'verified';
type NormalState='idle'|'opened';

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

export function Tasks({data,run,say,refresh}:{data:Snapshot;run:any;say:(s:string)=>void;refresh?:()=>Promise<any>}){
  const {t}=useI18n();
  const targetId=new URLSearchParams(window.location.search).get('task'),target=data.tasks.find(tk=>tk.id===targetId),initialCat=target?.category==='partner'?'partner':'official';
  const [cat,setCat]=useState<'official'|'partner'>(initialCat);
  const [mode,setMode]=useState<'tasks'|'create'|'pending'|'live'|'manage'>('tasks');
  const [botStates,setBotStates]=useState<Record<string,BotState>>({}),[normalStates,setNormalStates]=useState<Record<string,NormalState>>({}),[busy,setBusy]=useState('');
  const [verifyTask,setVerifyTask]=useState<any>(null),[verifyElapsed,setVerifyElapsed]=useState(0),[verifyRunning,setVerifyRunning]=useState(false),[verifyLaunched,setVerifyLaunched]=useState(false),[verifyError,setVerifyError]=useState('');
  const verifyAccumRef=useRef(0),verifyHiddenAtRef=useRef<number|null>(null);
  const VERIFY_SECONDS=15;
  const [title,setTitle]=useState(''),[url,setUrl]=useState(''),[reward,setReward]=useState('');
  const done=new Set(data.completed.map(x=>x.task_id)),visibleTasks=data.tasks.filter(tk=>tk.category!=='exclusive');
  const items=visibleTasks.filter(tk=>(tk.category||'official')===cat).sort((a,b)=>Number(done.has(a.id))-Number(done.has(b.id)));
  const completedCount=data.completed.filter(x=>visibleTasks.some(tk=>tk.id===x.task_id)).length;
  const liveCount=visibleTasks.length,pendingCount=visibleTasks.filter(tk=>!done.has(tk.id)).length;

  useEffect(()=>{if(target){setCat(target.category==='partner'?'partner':'official');setMode('tasks');setTimeout(()=>document.getElementById('wf-task-'+target.id)?.scrollIntoView({behavior:'smooth',block:'center'}),120)}},[targetId]);
  useEffect(()=>{const bots=visibleTasks.filter(tk=>tk.verification==='bot_forward'&&!done.has(tk.id));Promise.all(bots.map(async tk=>{try{const s=await botTaskApi('status',{task_id:tk.id});return [tk.id,(s.verified?'verified':s.status==='pending'?'pending':'not_started') as BotState] as const}catch{return [tk.id,'not_started' as BotState] as const}})).then(rows=>setBotStates(v=>({...v,...Object.fromEntries(rows)})))},[data.tasks.length,data.completed.length]);

  useEffect(()=>{if(!verifyTask)return;
    const markAway=()=>{if(verifyHiddenAtRef.current==null)verifyHiddenAtRef.current=Date.now()};
    const markBack=()=>{
      if(verifyHiddenAtRef.current!=null){
        verifyAccumRef.current+=Math.max(0,Date.now()-verifyHiddenAtRef.current);
        verifyHiddenAtRef.current=null;
      }
      const elapsed=Math.min(VERIFY_SECONDS,Math.floor(verifyAccumRef.current/1000));
      setVerifyElapsed(elapsed);
      // Returning from the Telegram layer pauses the session so the user can resume.
      setVerifyRunning(false);
    };
    const onVisibility=()=>{if(document.visibilityState==='hidden')markAway();else markBack()};
    const onBlur=()=>markAway();
    const onFocus=()=>{if(document.visibilityState==='visible')markBack()};
    const onPageHide=()=>markAway(),onPageShow=()=>markBack();
    // Newer Telegram clients can expose explicit Mini App activation state. Use it
    // when available because a Mini App opened as a Telegram layer may leave
    // document.visibilityState === 'visible' underneath the layer.
    const tg=(window as any).Telegram?.WebApp;
    const onDeactivated=()=>markAway(),onActivated=()=>markBack();
    document.addEventListener('visibilitychange',onVisibility);
    window.addEventListener('blur',onBlur);
    window.addEventListener('focus',onFocus);
    window.addEventListener('pagehide',onPageHide);
    window.addEventListener('pageshow',onPageShow);
    tg?.onEvent?.('deactivated',onDeactivated);
    tg?.onEvent?.('activated',onActivated);
    return()=>{
      document.removeEventListener('visibilitychange',onVisibility);
      window.removeEventListener('blur',onBlur);
      window.removeEventListener('focus',onFocus);
      window.removeEventListener('pagehide',onPageHide);
      window.removeEventListener('pageshow',onPageShow);
      tg?.offEvent?.('deactivated',onDeactivated);
      tg?.offEvent?.('activated',onActivated);
    };
  },[verifyTask]);
  const openTaskUrl=(task:any)=>{const url=String(task?.url||'').trim();if(!url)return false;try{const tg=(window as any).Telegram?.WebApp;let isTelegram=false;try{const u=new URL(url);isTelegram=['t.me','www.t.me','telegram.me','www.telegram.me'].includes(u.hostname.toLowerCase())}catch{}if(task?.task_type==='mini_app'||isTelegram){if(tg?.openTelegramLink){tg.openTelegramLink(url);return true}}if(tg?.openLink){tg.openLink(url);return true}window.open(url,'_blank','noopener,noreferrer');return true}catch{try{window.open(url,'_blank','noopener,noreferrer');return true}catch{return false}}};
  const openVerify=(task:any)=>{setVerifyTask(task);setVerifyElapsed(0);setVerifyRunning(false);setVerifyLaunched(false);setVerifyError('');verifyAccumRef.current=0;verifyHiddenAtRef.current=null};
  const launchVerify=async()=>{const task=verifyTask;if(!task||busy||verifyElapsed>=VERIFY_SECONDS)return;
    setBusy(task.id);setVerifyError('');
    try{
      // Register the external-open state BEFORE leaving the app. The backend claim guard expects this.
      await taskApi('check',{task_id:task.id,stage:'begin_external'});
      // Start the session immediately before opening the Telegram layer.
      // Some Telegram clients keep the parent Mini App "visible" underneath the layer,
      // so we cannot wait for visibilitychange/blur before starting the stopwatch.
      verifyHiddenAtRef.current=Date.now();
      setVerifyRunning(true);
      setVerifyLaunched(true);
      const ok=openTaskUrl(task);
      if(!ok){
        verifyHiddenAtRef.current=null;
        setVerifyRunning(false);
        setVerifyLaunched(false);
        throw new Error('Could not open this Mini App. Please try again.');
      }
    }catch(e:any){
      verifyHiddenAtRef.current=null;setVerifyRunning(false);
      setVerifyError(String(e?.message||'Could not start verification. Please try again.'));
    }finally{setBusy('')}
  };
  const closeVerify=()=>{if(verifyRunning)return;setVerifyTask(null);verifyHiddenAtRef.current=null;setVerifyError('')};
  const claimVerify=async(retry=0)=>{
    const task=verifyTask;if(!task||!verifyLaunched||busy)return;
    setBusy(task.id);setVerifyError('');
    try{
      await taskApi('claim',{task_id:task.id});
      setNormalStates(v=>({...v,[task.id]:'opened'}));setVerifyTask(null);await refresh?.();
    }catch(e:any){
      const m=String(e?.message||'Task verification failed. Please try again.');
      const wait=m.match(/^wait_(\d+)_seconds$/);
      if(wait&&retry<1){
        setVerifyError('Finishing verification…');
        window.setTimeout(()=>claimVerify(retry+1),Number(wait[1])*1000+250);
        return;
      }
      setVerifyError(m.replace(/_/g,' '));
    }finally{
      if(retry===0)setBusy('');
    }
  };

  const normalTask=async(task:any)=>{if(busy)return;const opened=normalStates[task.id]==='opened',external=task.verification==='external_visit',mini=task.task_type==='mini_app';try{if(!opened){if(mini){openVerify(task);return}setBusy(task.id);if(external)taskApi('check',{task_id:task.id,stage:'begin_external'}).catch(()=>{});const didOpen=openTaskUrl(task);if(!didOpen){setBusy('');say('Could not open this task. Please try again.');return}setNormalStates(v=>({...v,[task.id]:'opened'}));say(external?'Task opened. Stay at least 15 seconds, then return and tap CLAIM.':task.verification==='telegram_member'?'Join the channel/group, then return and tap CLAIM':'Open the task, then tap CLAIM');return}setBusy(task.id);await taskApi('claim',{task_id:task.id});say('+'+task.reward+' W');await refresh?.()}catch(e:any){const m=String(e?.message||'Task verification failed');say(/^wait_\\d+_seconds$/.test(m)?'Please wait '+(m.match(/\\d+/)?.[0]||'a few')+' more seconds.':m)}finally{setBusy('')}};
  const botAction=async(task:any)=>{if(busy)return;const state=botStates[task.id]||'not_started';try{setBusy(task.id);if(state==='not_started'){const x=await botTaskApi('begin',{task_id:task.id});setBotStates(v=>({...v,[task.id]:'pending'}));say('Forward one message from @'+x.bot_username+' to WIENER bot, then tap CHECK');if(x.url)window.Telegram?.WebApp?.openTelegramLink?.(String(x.url));return}if(state==='pending'){const x=await botTaskApi('status',{task_id:task.id});if(x.verified){setBotStates(v=>({...v,[task.id]:'verified'}));say('Verified — tap CLAIM to receive your reward')}else say('Not verified yet. Forward the required message, then CHECK.');return}await taskApi('claim',{task_id:task.id});say('+'+task.reward+' W');await refresh?.()}catch(e:any){say(e.message||'Verification failed')}finally{setBusy('')}};
  const saveDraft=()=>{if(!title.trim()||!url.trim()||!reward.trim()){say('Fill title, destination and reward first.');return}say('Task draft saved.');setTitle('');setUrl('');setReward('');setMode('tasks')};

  return <main className="wf-task-v2">
    <style>{`
      .wf-task-v2{width:100%;max-width:560px;margin:0 auto;padding:2px 0 112px;box-sizing:border-box;color:#effff7}
      .wf-task-v2 *{box-sizing:border-box}
      .wf-task-v2 .wf-top-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:2px 0 12px}
      .wf-task-v2 .wf-top-btn{min-height:62px;border:1px solid rgba(100,236,167,.12)!important;border-radius:17px!important;background:linear-gradient(145deg,rgba(18,72,47,.8),rgba(5,35,25,.92))!important;color:#a8ebc7!important;font-size:10px!important;font-weight:950!important;letter-spacing:.06em!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.04)!important}
      .wf-task-v2 .wf-top-btn strong{display:block;color:#effff7;font-size:11px;margin-bottom:4px}.wf-task-v2 .wf-top-btn span{font-size:8px;color:rgba(228,255,241,.38);font-weight:700}.wf-task-v2 .wf-top-btn.create{color:#c8f276!important;border-color:rgba(160,235,72,.24)!important}.wf-task-v2 .wf-top-btn.active{background:linear-gradient(145deg,rgba(20,103,67,.9),rgba(5,47,31,.96))!important;border-color:rgba(91,231,158,.32)!important}
      .wf-task-v2 .wf-hero{padding:18px;border:1px solid rgba(91,231,158,.16);border-radius:23px;background:radial-gradient(circle at 90% 8%,rgba(54,224,137,.17),transparent 34%),linear-gradient(145deg,rgba(20,78,52,.82),rgba(4,34,24,.96));box-shadow:inset 0 1px 0 rgba(255,255,255,.04),0 12px 30px rgba(0,0,0,.14)}
      .wf-task-v2 .wf-kicker{font-size:9px;font-weight:950;letter-spacing:.25em;color:#55df9a}.wf-task-v2 .wf-hero h2{margin:6px 0;font-size:28px;line-height:1.02;letter-spacing:-.04em;color:#f3fff8}.wf-task-v2 .wf-hero p{margin:0;font-size:11px;line-height:1.45;color:rgba(228,255,241,.55)}.wf-task-v2 .wf-progress-row{display:flex;align-items:center;gap:10px;margin-top:16px}.wf-task-v2 .wf-progress{height:7px;flex:1;border-radius:99px;background:rgba(255,255,255,.07);overflow:hidden}.wf-task-v2 .wf-progress span{display:block;height:100%;background:#38dc8d;border-radius:99px}.wf-task-v2 .wf-progress-row b{font-size:10px;color:#86efb6;white-space:nowrap}
      .wf-task-v2 .wf-switch{display:grid;grid-template-columns:1fr 1fr;gap:5px;padding:5px;margin:10px 0 8px;border:1px solid rgba(91,231,158,.1);border-radius:16px;background:rgba(2,29,20,.58)}.wf-task-v2 .wf-switch button{height:41px;border:0!important;border-radius:11px!important;background:transparent!important;color:rgba(228,255,241,.42)!important;font-size:9px!important;font-weight:950!important;letter-spacing:.1em!important}.wf-task-v2 .wf-switch button.active{background:rgba(46,214,133,.14)!important;border:1px solid rgba(91,231,158,.16)!important;color:#f0fff7!important}
      .wf-task-v2 .wf-cats{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:9px}.wf-task-v2 .wf-cats button{height:38px;border:1px solid rgba(91,231,158,.1)!important;border-radius:11px!important;background:rgba(6,41,27,.62)!important;color:rgba(228,255,241,.44)!important;font-size:9px!important;font-weight:950!important}.wf-task-v2 .wf-cats button.active{background:linear-gradient(180deg,#18b967,#07894a)!important;color:#fff!important;border-color:rgba(104,255,179,.24)!important;box-shadow:0 7px 18px rgba(8,154,79,.12)!important}
      .wf-task-v2 .wf-list{overflow:hidden;border:1px solid rgba(91,231,158,.12);border-radius:20px;background:linear-gradient(145deg,rgba(12,53,37,.76),rgba(3,27,20,.9));padding:4px 12px}
      .wf-task-v2 .wf-row{display:flex;align-items:center;gap:11px;min-height:72px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.055)}.wf-task-v2 .wf-row:last-child{border-bottom:0}.wf-task-v2 .wf-row.target{background:rgba(54,224,137,.06);border-radius:13px;padding-left:7px;padding-right:7px}
      .wf-task-v2 .wf-avatar{flex:0 0 45px;width:45px;height:45px;border-radius:13px;display:grid;place-items:center;overflow:hidden;background:rgba(48,210,132,.08);border:1px solid rgba(91,231,158,.12)}.wf-task-v2 .wf-avatar img{width:100%;height:100%;object-fit:cover}.wf-task-v2 .wf-avatar svg{width:24px;height:24px}
      .wf-task-v2 .wf-info{flex:1;min-width:0}.wf-task-v2 .wf-title{display:flex;align-items:center;gap:6px;min-width:0}.wf-task-v2 .wf-title h3{margin:0;font-size:13px;line-height:1.25;color:#f1fff7;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.wf-task-v2 .wf-pill{padding:3px 6px;border-radius:7px;background:rgba(74,225,151,.08);color:#6ee6a7;font-size:7px;font-weight:950;white-space:nowrap}.wf-task-v2 .wf-desc{margin:3px 0 0;font-size:9px;color:rgba(228,255,241,.43);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.wf-task-v2 .wf-meta{display:flex;align-items:center;gap:6px;margin-top:4px;font-size:9px;color:rgba(228,255,241,.34)}.wf-task-v2 .wf-reward{font-size:11px;color:#6be5a4;font-weight:950}.wf-task-v2 .wf-status{margin-top:3px;font-size:8px;color:#68e2a1}
      .wf-task-v2 .wf-action{flex:0 0 auto!important;min-width:67px!important;height:36px!important;padding:0 11px!important;border-radius:11px!important;background:linear-gradient(180deg,#19b969,#078c4c)!important;border:1px solid rgba(104,255,179,.18)!important;color:#fff!important;font-size:9px!important;font-weight:950!important;box-shadow:0 7px 16px rgba(5,146,76,.12)!important}.wf-task-v2 .wf-action:disabled{opacity:.42!important;box-shadow:none!important}
      .wf-task-v2 .wf-panel{padding:15px;border:1px solid rgba(91,231,158,.14);border-radius:20px;background:linear-gradient(145deg,rgba(19,75,50,.78),rgba(4,34,24,.94))}.wf-task-v2 .wf-head{display:flex;align-items:center;gap:10px;margin-bottom:13px}.wf-task-v2 .wf-icon{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;background:rgba(45,216,133,.1);border:1px solid rgba(91,231,158,.13);font-size:20px}.wf-task-v2 .wf-panel h3{margin:0;font-size:15px}.wf-task-v2 .wf-panel p{margin:3px 0 0;font-size:9px;color:rgba(228,255,241,.45)}.wf-task-v2 .wf-label{display:block;margin:10px 0 5px;font-size:8px;font-weight:950;color:rgba(228,255,241,.5);letter-spacing:.08em}.wf-task-v2 .wf-input{width:100%;height:42px;border:1px solid rgba(91,231,158,.1);border-radius:11px;background:rgba(2,28,19,.82);color:#effff7;padding:0 11px;outline:none;font-size:11px}.wf-task-v2 .wf-types{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.wf-task-v2 .wf-types button{height:37px;border:1px solid rgba(91,231,158,.1)!important;border-radius:10px!important;background:rgba(2,28,19,.65)!important;color:rgba(228,255,241,.45)!important;font-size:8px!important;font-weight:900!important}.wf-task-v2 .wf-types button.active{background:rgba(45,216,133,.13)!important;color:#72e8aa!important;border-color:rgba(91,231,158,.22)!important}.wf-task-v2 .wf-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:13px}.wf-task-v2 .wf-actions button{height:41px;border-radius:11px;font-size:9px;font-weight:950}.wf-task-v2 .wf-cancel{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:rgba(255,255,255,.6)}.wf-task-v2 .wf-save{background:#0ca653;border:1px solid rgba(104,255,179,.16);color:#fff}.wf-task-v2 .wf-note{margin-top:8px;padding:8px;border-radius:9px;background:rgba(255,255,255,.025);color:rgba(228,255,241,.3);font-size:8px;line-height:1.4}
      .wf-task-verify-backdrop{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.72);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);display:flex;align-items:flex-end;justify-content:center}
      .wf-task-verify{width:min(100%,560px);max-height:88vh;overflow:auto;border-radius:28px 28px 0 0;background:linear-gradient(180deg,#18253a,#0b121d);border:1px solid rgba(100,150,220,.22);padding:10px 18px 24px;color:#fff;box-shadow:0 -20px 60px rgba(0,0,0,.5)}.wf-task-verify .grab{width:58px;height:5px;border-radius:99px;background:rgba(255,255,255,.25);margin:4px auto 22px}.wf-task-verify .verify-close{float:right;width:38px;height:38px;border:1px solid rgba(255,255,255,.1);border-radius:50%;background:rgba(255,255,255,.06);color:#fff;font-size:22px}.wf-task-verify h2{margin:0 0 16px;font-size:23px}.wf-task-verify .verify-task-card{padding:16px;border-radius:21px;background:linear-gradient(145deg,#263a55,#19283d);border:1px solid rgba(90,140,230,.35)}.wf-task-verify .verify-pill{display:inline-flex;padding:7px 11px;border-radius:999px;background:rgba(255,183,35,.12);border:1px solid rgba(255,183,35,.3);color:#ffd45a;font-size:12px;font-weight:900}.wf-task-verify .verify-reward{float:right;padding:7px 11px;border-radius:999px;background:rgba(60,230,165,.12);border:1px solid rgba(60,230,165,.28);color:#65edb5;font-size:12px;font-weight:900}.wf-task-verify .verify-title{margin-top:17px;font-size:19px;font-weight:900}.wf-task-verify .verify-desc{margin-top:6px;color:rgba(255,255,255,.55);font-size:12px}.wf-task-verify .verify-proof{margin-top:14px;padding:16px;border-radius:18px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.07)}.wf-task-verify .verify-proof b{font-size:15px}.wf-task-verify .verify-proof p{margin:8px 0 0;color:rgba(255,255,255,.55);font-size:12px;line-height:1.5}.wf-task-verify .verify-launch,.wf-task-verify .verify-claim{width:100%;height:56px;margin-top:17px;border:0;border-radius:16px;font-weight:950;font-size:14px;transition:transform .16s ease,opacity .16s ease,filter .16s ease}.wf-task-verify .verify-launch{background:linear-gradient(135deg,#ffc42e,#ff7a00);color:#111;box-shadow:0 10px 24px rgba(255,145,0,.18)}.wf-task-verify .verify-launch:not(:disabled):active,.wf-task-verify .verify-claim:not(:disabled):active{transform:scale(.985)}.wf-task-verify .verify-launch:disabled{opacity:.48;filter:saturate(.7)}.wf-task-verify .verify-claim{background:linear-gradient(180deg,#19c273,#0b9d5a);color:#fff;box-shadow:0 10px 24px rgba(12,178,96,.2)}.wf-task-verify .verify-remaining{margin-top:11px;text-align:center;color:rgba(255,214,107,.78);font-size:11px;font-weight:800}.wf-task-verify .verify-error{margin-top:12px;padding:11px 12px;border-radius:13px;background:rgba(255,74,74,.08);border:1px solid rgba(255,95,95,.2);color:#ffb5b5;font-size:11px;line-height:1.4}
      @media(max-width:390px){.wf-task-v2{padding-bottom:108px}.wf-top-btn{min-height:59px!important}.wf-hero{padding:15px!important}.wf-hero h2{font-size:25px!important}.wf-row{gap:8px!important;min-height:68px!important}.wf-avatar{flex-basis:40px!important;width:40px!important;height:40px!important}.wf-action{min-width:59px!important;padding:0 8px!important;font-size:8px!important}.wf-title h3{font-size:12px!important}.wf-list{padding-left:10px!important;padding-right:10px!important}}
    `}</style>

    {mode==='create' ? <section className="wf-panel">
      <div className="wf-head"><div className="wf-icon">＋</div><div><h3>Create your own task</h3><p>Promote a Telegram channel, link or Mini App.</p></div></div>
      <label className="wf-label">TASK TITLE</label><input className="wf-input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Join our Telegram channel"/>
      <label className="wf-label">DESTINATION URL</label><input className="wf-input" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://t.me/yourchannel"/>
      <label className="wf-label">REWARD PER USER (W)</label><input className="wf-input" value={reward} onChange={e=>setReward(e.target.value.replace(/[^0-9]/g,''))} inputMode="numeric" placeholder="100"/>
      <div className="wf-note">Tasks are reviewed before publishing. Existing verification and reward rules remain unchanged.</div>
      <div className="wf-actions"><button className="wf-cancel" onClick={()=>setMode('tasks')}>CANCEL</button><button className="wf-save" onClick={saveDraft}>SAVE DRAFT</button></div>
    </section> : <>
      <div className="wf-cats"><button className={cat==='official'?'active':''} onClick={()=>setCat('official')}>OFFICIAL</button><button className={cat==='partner'?'active':''} onClick={()=>setCat('partner')}>PARTNER</button></div>
      <section className="wf-list">{items.length?items.map(task=>{const isBot=task.verification==='bot_forward',isExternal=task.verification==='external_visit',isMini=task.task_type==='mini_app',state=botStates[task.id]||'not_started',opened=normalStates[task.id]==='opened',completed=done.has(task.id);const label=completed?'DONE':busy===task.id?'WAIT':isBot?(state==='verified'?'CLAIM':state==='pending'?'CHECK':'START'):(opened?'CLAIM':isMini?'OPEN':isExternal?'OPEN':t('common.join','JOIN'));const doneCount=Number(task.completed_count||0),limit=Number(task.max_completions||0),limitText=limit?Math.max(0,limit-doneCount)+' spots left':'Open task';const typeLabel=isMini?'MINI APP':isBot?'BOT':task.verification==='telegram_member'?'TELEGRAM':isExternal?'LINK':'TASK';const status=isBot&&state==='pending'?'Waiting for verification':isBot&&state==='verified'?'Reward ready':opened?'Ready to claim':'';return <div className={`wf-row ${targetId===task.id?'target':''}`} id={`wf-task-${task.id}`} key={task.id}><div className="wf-avatar"><TaskAvatar task={task} active={completed||state==='verified'}/></div><div className="wf-info"><div className="wf-title"><h3>{task.title}</h3><span className="wf-pill">{typeLabel}</span></div>{task.description&&<p className="wf-desc">{task.description}</p>}<div className="wf-meta"><span className="wf-reward">+{task.reward} W</span><span>•</span><span>{limitText}</span></div>{status&&<div className="wf-status">{status}</div>}</div><button className="wf-action" disabled={completed||busy===task.id} onClick={()=>isBot?botAction(task):normalTask(task)}>{label}</button></div>}) : <div style={{padding:'24px',textAlign:'center',color:'rgba(228,255,241,.4)',fontSize:11}}>No {cat} tasks right now.</div>}</section>
    </>}
      {verifyTask&&<div className="wf-task-verify-backdrop" onClick={e=>{if(e.target===e.currentTarget&&!verifyRunning)closeVerify()}}><section className="wf-task-verify" role="dialog" aria-modal="true"><div className="grab"/><button className="verify-close" type="button" disabled={verifyRunning} onClick={closeVerify}>×</button><h2>Verify Mini App Task</h2><div className="verify-task-card"><span className="verify-pill">🎮 {String(verifyTask?.title||'Mini App').slice(0,28)}</span><span className="verify-reward">+{verifyTask.reward} W</span><div className="verify-title">{verifyTask.title}</div><div className="verify-desc">{verifyTask.description||'Be active'}</div></div><div className="verify-proof"><b>◷ Proof of Activity</b><p>Launch the Mini App once and spend at least 15 seconds there. After launch, you do not need to open it again. Return here and tap CLAIM.</p></div>{verifyError&&<div className="verify-error" role="alert">{verifyError.replace(/_/g,' ')}</div>}{!verifyLaunched?<><button className="verify-launch" type="button" disabled={busy===verifyTask.id||verifyRunning} onClick={launchVerify}>{busy===verifyTask.id?'STARTING…':'Launch Mini App · 15s'}</button><div className="verify-remaining">Launch once. Then return and claim.</div></>:<button className="verify-claim" type="button" disabled={busy===verifyTask.id} onClick={()=>claimVerify()}>{busy===verifyTask.id?'VERIFYING…':'CLAIM +'+verifyTask.reward+' W'}</button>}</section></div>}
  </main>;
}
