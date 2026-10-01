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
  const [verifyTask,setVerifyTask]=useState<any>(null),[verifyElapsed,setVerifyElapsed]=useState(0),[verifyRunning,setVerifyRunning]=useState(false);
  const verifyStartedRef=useRef(0),verifyAccumRef=useRef(0),verifyHiddenAtRef=useRef<number|null>(null);
  const VERIFY_SECONDS=15;
  const [title,setTitle]=useState(''),[url,setUrl]=useState(''),[reward,setReward]=useState('');
  const done=new Set(data.completed.map(x=>x.task_id)),visibleTasks=data.tasks.filter(tk=>tk.category!=='exclusive');
  const items=visibleTasks.filter(tk=>(tk.category||'official')===cat).sort((a,b)=>Number(done.has(a.id))-Number(done.has(b.id)));
  const completedCount=data.completed.filter(x=>visibleTasks.some(tk=>tk.id===x.task_id)).length;
  const liveCount=visibleTasks.length,pendingCount=visibleTasks.filter(tk=>!done.has(tk.id)).length;

  useEffect(()=>{if(target){setCat(target.category==='partner'?'partner':'official');setMode('tasks');setTimeout(()=>document.getElementById('wf-task-'+target.id)?.scrollIntoView({behavior:'smooth',block:'center'}),120)}},[targetId]);
  useEffect(()=>{const bots=visibleTasks.filter(tk=>tk.verification==='bot_forward'&&!done.has(tk.id));Promise.all(bots.map(async tk=>{try{const s=await botTaskApi('status',{task_id:tk.id});return [tk.id,(s.verified?'verified':s.status==='pending'?'pending':'not_started') as BotState] as const}catch{return [tk.id,'not_started' as BotState] as const}})).then(rows=>setBotStates(v=>({...v,...Object.fromEntries(rows)})))},[data.tasks.length,data.completed.length]);

  useEffect(()=>{if(!verifyTask)return;
    const onVisibility=()=>{const now=Date.now();
      if(document.visibilityState==='hidden'){if(verifyHiddenAtRef.current==null)verifyHiddenAtRef.current=now;return}
      if(verifyHiddenAtRef.current!=null){verifyAccumRef.current+=Math.max(0,now-verifyHiddenAtRef.current);verifyHiddenAtRef.current=null}
      const elapsed=Math.min(VERIFY_SECONDS,Math.floor(verifyAccumRef.current/1000));setVerifyElapsed(elapsed);
      if(elapsed>=VERIFY_SECONDS)setVerifyRunning(false);
    };
    const timer=window.setInterval(()=>{if(document.visibilityState==='hidden'&&verifyHiddenAtRef.current!=null){const elapsed=Math.min(VERIFY_SECONDS,Math.floor((verifyAccumRef.current+(Date.now()-verifyHiddenAtRef.current))/1000));setVerifyElapsed(elapsed);if(elapsed>=VERIFY_SECONDS)setVerifyRunning(false)}},250);
    document.addEventListener('visibilitychange',onVisibility);
    return()=>{window.clearInterval(timer);document.removeEventListener('visibilitychange',onVisibility)};
  },[verifyTask]);
  const openVerify=async(task:any)=>{setVerifyTask(task);setVerifyElapsed(0);setVerifyRunning(false);verifyStartedRef.current=Date.now();verifyAccumRef.current=0;verifyHiddenAtRef.current=null};
  const launchVerify=async()=>{const task=verifyTask;if(!task||busy)return;try{setBusy(task.id);await taskApi('check',{task_id:task.id,stage:'begin_external'});setVerifyRunning(true);verifyAccumRef.current=0;verifyHiddenAtRef.current=Date.now();setVerifyElapsed(0);const ok=await openTaskUrl(task);if(!ok){verifyHiddenAtRef.current=null;setVerifyRunning(false);say('Could not open this Mini App. Please try again.');return}say('Mini App opened. Keep it open for 15 seconds, then return here.')}catch(e:any){verifyHiddenAtRef.current=null;setVerifyRunning(false);say(String(e?.message||'Could not start Mini App verification.'))}finally{setBusy('')}};
  const closeVerify=()=>{if(verifyElapsed>=VERIFY_SECONDS){setVerifyTask(null);return}if(verifyRunning)return;setVerifyTask(null);verifyHiddenAtRef.current=null};
  const claimVerify=async()=>{const task=verifyTask;if(!task||verifyElapsed<VERIFY_SECONDS||busy)return;try{setBusy(task.id);await taskApi('claim',{task_id:task.id});setNormalStates(v=>({...v,[task.id]:'opened'}));setVerifyTask(null);say('+'+task.reward+' W');await refresh?.()}catch(e:any){const m=String(e?.message||'Task verification failed');say(m)}finally{setBusy('')}};
  const openTaskUrl=async(task:any)=>{const url=String(task?.url||'').trim();if(!url)return false;try{const tg=(window as any).Telegram?.WebApp;if(task.task_type==='mini_app'||/^https?:\\/\\/(t\\.me|telegram\\.me)\\//i.test(url)){if(tg?.openTelegramLink){tg.openTelegramLink(url);return true}if(tg?.openLink){tg.openLink(url);return true}}else if(tg?.openLink){tg.openLink(url);return true}window.open(url,'_blank','noopener,noreferrer');return true}catch{try{window.open(url,'_blank','noopener,noreferrer');return true}catch{return false}}};
  const normalTask=async(task:any)=>{if(busy)return;const opened=normalStates[task.id]==='opened',external=task.verification==='external_visit',mini=task.task_type==='mini_app';try{if(!opened){if(mini){await openVerify(task);return} setBusy(task.id);let verificationPromise:Promise<any>|null=null;if(external)verificationPromise=taskApi('check',{task_id:task.id,stage:'begin_external'});const didOpen=await openTaskUrl(task);setNormalStates(v=>({...v,[task.id]:'opened'}));if(!didOpen){setBusy('');say('Could not open this task. Please try again.');return}if(verificationPromise){try{await verificationPromise}catch{say('Task opened. Keep it open for at least 15 seconds, then return and tap CLAIM.')}}say(mini?'Mini App opened. Stay at least 15 seconds, then return and tap CLAIM.':external?'Task opened. Stay at least 15 seconds, then return and tap CLAIM.':task.verification==='telegram_member'?'Join the channel/group, then return and tap CLAIM':'Open the task, then tap CLAIM');return}setBusy(task.id);try{await taskApi('claim',{task_id:task.id})}catch(e:any){const m=String(e?.message||'');if(/open_task_first/i.test(m)){if(external){await taskApi('check',{task_id:task.id,stage:'begin_external'});say('Task verification has started. Please keep the task open for at least 15 seconds, then tap CLAIM again.');return}say('Please open the task first, keep it open for at least 15 seconds, then return and tap CLAIM.');return}throw e}say('+'+task.reward+' W');await refresh?.()}catch(e:any){const m=String(e.message||'Task verification failed');say(/^wait_\\d+_seconds$/.test(m)?'Please wait '+(m.match(/\\d+/)?.[0]||'a few')+' more seconds.':m)}finally{setBusy('')}};
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
      .wf-task-verify-backdrop{position:fixed;inset:0;z-index:1000;background:rgba(0,8,14,.7);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);display:flex;align-items:flex-end;justify-content:center;padding:0}
      .wf-task-verify{width:min(100%,560px);max-height:88dvh;overflow:auto;border:1px solid rgba(112,180,255,.18);border-radius:30px 30px 0 0;background:linear-gradient(180deg,#172338,#0b1320);box-shadow:0 -20px 70px rgba(0,0,0,.45);padding:10px 18px 24px;color:#fff}
      .wf-task-verify .grab{width:58px;height:6px;border-radius:99px;background:rgba(255,255,255,.25);margin:4px auto 25px}
      .wf-task-verify .verify-close{float:right;width:40px;height:40px;border-radius:50%;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.06);color:#fff;font-size:24px}
      .wf-task-verify h2{margin:0 0 16px;font-size:24px;letter-spacing:-.03em}
      .wf-task-verify .verify-task-card{padding:16px;border-radius:22px;background:linear-gradient(145deg,#263a55,#1a2b42);border:1px solid rgba(82,140,255,.4);box-shadow:inset 0 1px rgba(255,255,255,.05)}
      .wf-task-verify .verify-title{font-size:20px;font-weight:900;margin-top:18px}
      .wf-task-verify .verify-desc{margin:7px 0 0;color:rgba(255,255,255,.58);font-size:13px}
      .wf-task-verify .verify-pill{display:inline-flex;padding:7px 12px;border-radius:999px;background:rgba(255,186,32,.12);border:1px solid rgba(255,186,32,.35);color:#ffd24d;font-weight:900;font-size:13px}
      .wf-task-verify .verify-reward{float:right;padding:7px 12px;border-radius:999px;background:rgba(63,238,171,.12);border:1px solid rgba(63,238,171,.3);color:#65efb5;font-weight:900;font-size:13px}
      .wf-task-verify .verify-proof{margin-top:14px;padding:17px;border-radius:20px;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.07)}
      .wf-task-verify .verify-proof b{font-size:16px}.wf-task-verify .verify-proof p{margin:10px 0 0;color:rgba(255,255,255,.55);font-size:13px;line-height:1.5}
      .wf-task-verify .verify-launch{width:100%;height:58px;margin-top:18px;border:0;border-radius:17px;background:linear-gradient(90deg,#ffab00,#ff7a00);color:#111;font-size:15px;font-weight:950;box-shadow:0 10px 28px rgba(255,133,0,.2)}
      .wf-task-verify .verify-launch:disabled{opacity:.55}
      .wf-task-verify .verify-claim{width:100%;height:54px;margin-top:10px;border:1px solid rgba(90,235,170,.35);border-radius:16px;background:#13aa63;color:#fff;font-size:14px;font-weight:950}
      .wf-task-verify .verify-remaining{margin-top:12px;text-align:center;color:#ffd66b;font-size:12px;font-weight:800}
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
      {verifyTask&&<div className="wf-task-verify-backdrop" onClick={e=>{if(e.target===e.currentTarget&&!verifyRunning)closeVerify()}}>
        <section className="wf-task-verify" role="dialog" aria-modal="true" aria-label="Verify Mini App Task">
          <div className="grab"/>
          <button className="verify-close" type="button" disabled={verifyRunning} onClick={closeVerify}>×</button>
          <h2>Verify Mini App Task</h2>
          <div className="verify-task-card">
            <span className="verify-pill">🎮 @{telegramUsername(verifyTask)||'Mini App'}</span>
            <span className="verify-reward">+{verifyTask.reward} W</span>
            <div className="verify-title">{verifyTask.title}</div>
            <div className="verify-desc">{verifyTask.description||'Be active'}</div>
          </div>
          <div className="verify-proof">
            <b>◷ Proof of Activity ({VERIFY_SECONDS}s)</b>
            <p>Launch the Mini App and keep it visible for at least {VERIFY_SECONDS} seconds. Returning early pauses verification and keeps the remaining time.</p>
          </div>
          {verifyElapsed<VERIFY_SECONDS?<><button className="verify-launch" type="button" disabled={busy===verifyTask.id||verifyRunning} onClick={launchVerify}>{verifyRunning?'Mini App Opened… '+Math.max(0,VERIFY_SECONDS-verifyElapsed)+'s remaining':'Launch Mini App ('+VERIFY_SECONDS+'s)'}</button><div className="verify-remaining">{verifyElapsed>0?'Remaining: '+(VERIFY_SECONDS-verifyElapsed)+'s — return after the full visible time.':'Tap Launch to start verification.'}</div></>:<button className="verify-claim" type="button" disabled={busy===verifyTask.id} onClick={claimVerify}>{busy===verifyTask.id?'VERIFYING…':'CLAIM +'+verifyTask.reward+' W'}</button>}
        </section>
      </div>}
  </main>;
}
