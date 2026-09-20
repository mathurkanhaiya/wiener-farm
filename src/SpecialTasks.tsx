import {useMemo,useState} from 'react';
import {getInitData,PUBLISHABLE_KEY,SUPABASE_URL,type Snapshot} from './lib';
import {AnimatedIcon} from './icons';
import {useI18n} from './i18n';

async function specialTaskApi(taskId:string,action:string){const r=await fetch(`${SUPABASE_URL}/functions/v1/wiener-task-api`,{method:'POST',headers:{'Content-Type':'application/json','apikey':PUBLISHABLE_KEY},body:JSON.stringify({action,task_id:taskId,initData:getInitData()})});const x=await r.json().catch(()=>({ok:false,error:'invalid_response'}));if(!r.ok||!x.ok)throw new Error(x.message||x.error||'Task verification failed');return x.data}

export function SpecialTasks({data,say,refresh}:{data:Snapshot;say:(s:string)=>void;refresh:()=>Promise<any>}){
 const {t}=useI18n();
 const tasks=useMemo(()=>data.tasks.filter((t:any)=>t.category==='special'&&t.enabled!==false).sort((a:any,b:any)=>Number(a.sort_order||0)-Number(b.sort_order||0)),[data.tasks]);
 const done=new Set(data.completed.map((x:any)=>x.task_id));
 const [busy,setBusy]=useState('');
 if(!tasks.length)return null;
 const verify=async(t:any)=>{if(busy||done.has(t.id))return;try{setBusy(t.id);if(t.verification==='profile_name'||t.verification==='profile_bio')await specialTaskApi(t.id,'check');await specialTaskApi(t.id,'claim');say(`${t.verification==='none'?'✅ Completed':'✅ Verified'} · +${t.reward} W`);await refresh()}catch(e:any){const m=String(e?.message||'Verification failed');const pretty:Record<string,string>={profile_name_requirement_not_met:'Add WIENER or 🌭 to your Telegram name, then check again.',profile_bio_requirement_not_met:'Add the required Wiener Farm link/text to your Telegram bio, then check again.',open_bot_chat_first:'Open Wiener Farm bot once, then try CHECK again.'};say(pretty[m]||m)}finally{setBusy('')}};
 const label=(task:any)=>done.has(task.id)?t('common.done','DONE'):busy===task.id?'…':task.verification==='none'?t('common.claim','CLAIM'):'CHECK';
  return <><style>{`
    .special-wrap{margin-bottom:14px;width:100%;box-sizing:border-box}
    .special-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:9px;padding:0 3px}
    .special-head div span{display:block;font-size:9px;font-weight:950;letter-spacing:1.5px;color:#ffe33b}
    .special-head h3{margin:3px 0 0;font-size:17px}
    .special-head small{font-size:10px;color:rgba(255,255,255,.42)}
    .special-list{padding:0;overflow:hidden;width:100%;box-sizing:border-box}
    .special-row{display:flex;align-items:center;gap:12px;padding:14px;border-bottom:1px solid rgba(255,255,255,.065);width:100%;box-sizing:border-box}
    .special-row:last-child{border-bottom:0}
    .special-row .square{flex:0 0 46px;width:46px;height:46px;border-radius:15px}
    .special-copy{flex:1 1 0%;min-width:0}
    .special-copy h4{margin:0;font-size:14px;font-weight:850;line-height:1.3;word-break:break-word;white-space:normal}
    .special-copy p{margin:4px 0 0;font-size:11px;line-height:1.35;color:rgba(255,255,255,.53);word-break:break-word;white-space:normal}
    .special-meta{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px}
    .special-chip{padding:3px 6px;border-radius:7px;background:rgba(255,255,255,.055);font-size:8px;font-weight:900;color:rgba(255,255,255,.55);white-space:nowrap}
    .special-chip.reward{color:#ffe33b;background:rgba(255,224,62,.08)}
    .special-row button{flex:0 0 auto;min-width:72px;white-space:nowrap}
    @media(max-width:375px){
      .special-row{gap:9px;padding:12px 10px}
      .special-row .square{flex:0 0 40px;width:40px;height:40px;border-radius:12px}
      .special-row button{min-width:64px;padding:0 8px;font-size:10.5px}
    }
  `}</style><section className="special-wrap"><div className="special-head"><div><span>{t('special.title','SPECIAL MISSIONS')}</span><h3>{t('special.subtitle','Extra ways to earn')}</h3></div><small>{tasks.filter((t:any)=>done.has(t.id)).length}/{tasks.length} {t('common.done','done')}</small></div><div className="card special-list">{tasks.map((t:any)=>{const auto=t.verification==='profile_name'||t.verification==='profile_bio';return <div className="special-row" key={t.id}><div className="square check"><AnimatedIcon name={auto?'check':'gift'} active={!done.has(t.id)}/></div><div className="special-copy"><h4>{t.title}</h4><p>{t.description||'Complete this mission and claim your reward.'}</p><div className="special-meta"><span className="special-chip reward">+{t.reward} W</span><span className="special-chip">{t.is_daily?t('tasks.daily','DAILY'):'ONE-TIME'}</span><span className="special-chip">{auto?'AUTO CHECK':'DIRECT CLAIM'}</span></div></div><button className="primary small" disabled={done.has(t.id)||busy===t.id} onClick={()=>verify(t)}>{label(t)}</button></div>})}</div></section></>;
}
