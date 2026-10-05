import {useEffect,useState} from 'react';
import {api,feedback} from './lib';

const empty={type:'website',title:'',description:'',targetUrl:'',targetGroup:'',reward:10,verificationType:'visibility',verificationDuration:15,commentTopic:'',commentFacts:'',availabilityStart:'',availabilityEnd:'',expiry:'',enabled:true,priority:0};
export function QuickTaskAdmin({say}:{say:(s:string)=>void}){
 const [rows,setRows]=useState<any[]>([]),[edit,setEdit]=useState<any>(null),[busy,setBusy]=useState(false);
 const load=async()=>{try{const x:any=await api('admin_quick_tasks');setRows(Array.isArray(x?.tasks)?x.tasks:[])}catch(e:any){say(e.message)}};
 useEffect(()=>{void load()},[]);
 const save=async()=>{if(!edit)return;try{setBusy(true);if(!edit.title.trim())throw Error('Task title is required');if(Number(edit.reward)<1)throw Error('Reward must be positive');if(Number(edit.reward)>20)throw Error('Quick Task reward must be 20 WIENER or less');await api('admin_quick_task_save',{task:{...edit,reward:Number(edit.reward),verificationDuration:Number(edit.verificationDuration||0),priority:Number(edit.priority||0)}});feedback('success');say('✅ Quick Task saved');setEdit(null);await load()}catch(e:any){feedback('error');say(e.message)}finally{setBusy(false)}};
 const toggle=async(r:any)=>{try{await api('admin_quick_task_save',{task:{...r,enabled:!r.enabled}});feedback('success');await load()}catch(e:any){feedback('error');say(e.message)}};
 return <section className="adminx-panel" style={{marginTop:12}}>
  <div className="adminx-panel-head"><div><span>QUICK TASK ENGINE</span><h3>Tasks & scheduling</h3></div><button className="adminx-primary" onClick={()=>setEdit({...empty})}>+ NEW TASK</button></div>
  <p style={{fontSize:11,opacity:.58}}>Backend controls availability, attempts, verification, daily eligibility and rewards. No deployment is required to enable or disable a task.</p>
  <div style={{display:'grid',gap:8}}>{rows.map(r=><div key={r.id} style={{padding:10,border:'1px solid rgba(255,255,255,.08)',borderRadius:14,display:'grid',gridTemplateColumns:'1fr auto',gap:8}}><div><b>{r.title}</b><small style={{display:'block',opacity:.5}}>{r.type} · +{r.reward} WIENER · {r.enabled?'ENABLED':'DISABLED'}</small></div><div style={{display:'flex',gap:6}}><button className="secondary" onClick={()=>setEdit({...r})}>EDIT</button><button className={r.enabled?'secondary':'adminx-primary'} onClick={()=>void toggle(r)}>{r.enabled?'DISABLE':'ENABLE'}</button></div></div>)}</div>
  {edit&&<div style={{marginTop:12,padding:12,borderRadius:16,border:'1px solid rgba(108,235,170,.14)',background:'rgba(0,0,0,.14)'}}>
   <div style={{display:'grid',gap:8}}>
    <select value={edit.type} onChange={e=>setEdit({...edit,type:e.target.value})}><option value="website">Website</option><option value="ad_provider">Ad Provider URL</option><option value="comment">Group Comment</option></select>
    <input value={edit.title} onChange={e=>setEdit({...edit,title:e.target.value})} placeholder="Task title"/>
    <textarea value={edit.description} onChange={e=>setEdit({...edit,description:e.target.value})} placeholder="Short description"/>
    <input type="number" min="1" max="20" value={edit.reward} onChange={e=>setEdit({...edit,reward:e.target.value})} placeholder="Reward WIENER"/>
    <input value={edit.targetUrl||''} onChange={e=>setEdit({...edit,targetUrl:e.target.value})} placeholder="Target URL"/>
    {edit.type==='comment'&&<><input value={edit.targetGroup||''} onChange={e=>setEdit({...edit,targetGroup:e.target.value})} placeholder="@targetgroup or https://t.me/..."/><input value={edit.commentTopic||''} onChange={e=>setEdit({...edit,commentTopic:e.target.value})} placeholder="Comment topic"/><textarea value={edit.commentFacts||''} onChange={e=>setEdit({...edit,commentFacts:e.target.value})} placeholder="Comment facts (one per line)"/></>}
    <input value={edit.verificationType||''} onChange={e=>setEdit({...edit,verificationType:e.target.value})} placeholder="Verification type"/>
    <input type="number" min="0" value={edit.verificationDuration||0} onChange={e=>setEdit({...edit,verificationDuration:e.target.value})} placeholder="Verification duration (seconds)"/>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}><input value={edit.availabilityStart||''} onChange={e=>setEdit({...edit,availabilityStart:e.target.value})} placeholder="Availability start"/><input value={edit.availabilityEnd||''} onChange={e=>setEdit({...edit,availabilityEnd:e.target.value})} placeholder="Availability end"/></div>
    <input value={edit.expiry||''} onChange={e=>setEdit({...edit,expiry:e.target.value})} placeholder="Expiry"/>
    <div style={{display:'flex',gap:8}}><button className="adminx-primary" disabled={busy} onClick={()=>void save()}>{busy?'SAVING…':'SAVE TASK'}</button><button className="secondary" onClick={()=>setEdit(null)}>CANCEL</button></div>
   </div>
  </div>}
 </section>
}