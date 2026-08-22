import {useEffect,useState} from 'react';
import {api,date,getInitData,PUBLISHABLE_KEY,SUPABASE_URL,type Snapshot} from './lib';
import {AnimatedIcon} from './icons';
import {ExclusivePromote} from './ExclusivePromote';

type BotState='not_started'|'pending'|'verified';
type NormalState='idle'|'opened';

async function botTask(action:'begin'|'status',taskId:string){
  const r=await fetch(`${SUPABASE_URL}/functions/v1/wiener-bot-task`,{
    method:'POST',headers:{'Content-Type':'application/json','apikey':PUBLISHABLE_KEY},
    body:JSON.stringify({action,task_id:taskId,initData:getInitData()})
  });
  const x=await r.json().catch(()=>({ok:false,error:'invalid_response'}));
  if(!r.ok||!x.ok)throw new Error(x.message||x.error||'Verification failed');
  return x.data;
}
async function verifiedTaskClaim(taskId:string){
  const r=await fetch(`${SUPABASE_URL}/functions/v1/wiener-task-api`,{
    method:'POST',headers:{'Content-Type':'application/json','apikey':PUBLISHABLE_KEY},
    body:JSON.stringify({action:'claim',task_id:taskId,initData:getInitData()})
  });
  const x=await r.json().catch(()=>({ok:false,error:'invalid_response'}));
  if(!r.ok||!x.ok)throw new Error(x.message||x.error||'Task verification failed');
  return x.data;
}
export function Tasks({data,run,say}:{data:Snapshot;run:any;say:(s:string)=>void}){
  const targetId=new URLSearchParams(window.location.search).get('task'),target=data.tasks.find(t=>t.id===targetId);
  const [cat,setCat]=useState(target?.category||'official'),[botStates,setBotStates]=useState<Record<string,BotState>>({}),[normalStates,setNormalStates]=useState<Record<string,NormalState>>({}),[busy,setBusy]=useState('');
  const done=new Set(data.completed.map(x=>x.task_id)),items=data.tasks.filter(t=>t.category===cat),count=data.completed.length;
  useEffect(()=>{if(target){setCat(target.category);setTimeout(()=>document.getElementById(`task-${target.id}`)?.scrollIntoView({behavior:'smooth',block:'center'}),120)}},[targetId]);
  useEffect(()=>{const bots=data.tasks.filter(t=>t.verification==='bot_forward'&&!done.has(t.id));Promise.all(bots.map(async t=>{try{const s=await botTask('status',t.id);return [t.id,(s.verified?'verified':s.status==='pending'?'pending':'not_started') as BotState] as const}catch{return [t.id,'not_started' as BotState] as const}})).then(rows=>setBotStates(v=>({...v,...Object.fromEntries(rows)})))},[data.tasks.length,data.completed.length]);
  const normalTask=async(t:any)=>{if(busy)return;const opened=normalStates[t.id]==='opened';try{if(!opened){if(t.url)window.Telegram?.WebApp?.openLink?.(t.url);setNormalStates(v=>({...v,[t.id]:'opened'}));say(t.verification==='telegram_member'?'Join the channel/group, then return and tap CHECK':'Open the task, then tap CHECK');return}setBusy(t.id);await verifiedTaskClaim(t.id);say(`+${t.reward} WIENER`);window.setTimeout(()=>window.location.reload(),450)}catch(e:any){say(e.message||'Task verification failed')}finally{setBusy('')}};
  const botAction=async(t:any)=>{if(busy)return;const state=botStates[t.id]||'not_started';try{setBusy(t.id);if(state==='not_started'){const x=await botTask('begin',t.id);setBotStates(v=>({...v,[t.id]:'pending'}));say(`Forward one message from @${x.bot_username} to WIENER bot, then tap CHECK`);const url=String(x.url||t.url||'');if(url)window.Telegram?.WebApp?.openTelegramLink?.(url);return}if(state==='pending'){const x=await botTask('status',t.id);if(x.verified){setBotStates(v=>({...v,[t.id]:'verified'}));say('✅ Verified — tap CLAIM to receive your reward')}else say('Not verified yet. Forward one message from the required bot to WIENER, then check again.');return}await verifiedTaskClaim(t.id);say(`+${t.reward} WIENER`);window.setTimeout(()=>window.location.reload(),450)}catch(e:any){say(e.message||'Verification failed')}finally{setBusy('')}};
  return <><section className="card progress-card"><div className="section-head"><div className="square check"><AnimatedIcon name="tasks" active/></div><div><h3>Your Progress</h3><p>{count} current tasks completed</p></div></div><div className="progress"><span style={{width:`${data.tasks.length?Math.min(100,count/data.tasks.length*100):0}%`}}/></div></section><div className="tabs">{['official','exclusive','partner'].map(x=><button className={cat===x?'active':''} onClick={()=>setCat(x)} key={x}>{x[0].toUpperCase()+x.slice(1)}</button>)}</div>{cat==='exclusive'&&<ExclusivePromote say={say} isAdmin={data.is_admin} tasks={data.tasks}/>}<section className="card task-list">{items.length?items.map(t=>{const isBot=t.verification==='bot_forward',state=botStates[t.id]||'not_started',normalOpened=normalStates[t.id]==='opened',label=done.has(t.id)?'DONE':busy===t.id?'WAIT':isBot?(state==='verified'?'CLAIM':state==='pending'?'CHECK':'START BOT'):(normalOpened?'CHECK':'JOIN'),progress=t.max_completions?`${Number(t.completed_count||0)}/${Number(t.max_completions)} completed · `:'';return <div className={`task ${targetId===t.id?'target-task':''}`} id={`task-${t.id}`} key={t.id}><div className="square check"><AnimatedIcon name={isBot?'ads':'check'} active={done.has(t.id)||state==='verified'}/></div><div className="grow"><h3>{t.title}{t.is_daily&&<span className="tag">DAILY</span>}{isBot&&<span className="tag">BOT</span>}{t.user_created&&<span className="tag">SPONSORED</span>}</h3><p>+{t.reward} WIENER · {progress}{isBot?`Start @${String(t.telegram_chat_id||'bot').replace('@','')} and forward one bot message`:t.description||t.category}{t.expires_at?` · Ends ${date(t.expires_at)}`:''}</p>{isBot&&state==='pending'&&<small className="bot-verify-status">Forward sent? Tap CHECK anytime.</small>}{isBot&&state==='verified'&&<small className="bot-verify-status verified">✓ Forward verified — reward ready</small>}</div><button className="primary small" disabled={done.has(t.id)||busy===t.id} onClick={()=>isBot?botAction(t):normalTask(t)}>{label}</button></div>}):<div className="empty">No {cat} tasks right now.</div>}</section></>;
}
