import {useEffect,useState} from 'react';
import {api} from './lib';

const MINI_RE=/^https:\/\/t\.me\/[A-Za-z0-9_]{5,}(?:\/[A-Za-z0-9_]+|\?startapp(?:=[A-Za-z0-9._~-]+)?)$/i;
const PRIVATE_RE=/^https:\/\/t\.me\/\+[A-Za-z0-9_-]{6,}$/i;

function parseMini(url:string){
  try{
    const u=new URL(url);
    const parts=u.pathname.split('/').filter(Boolean);
    const bot=parts[0]||'';
    const app=parts[1]||'';
    const hasStart=u.searchParams.has('startapp');
    const payload=u.searchParams.get('startapp')||'';
    return {bot,app,hasStart,payload};
  }catch{return {bot:'',app:'',hasStart:false,payload:''}}
}

const fresh=(type:'mini_app'|'private_channel'='mini_app')=>({
  title:'',
  description:type==='private_channel'?'Join the private channel using the invite link, then return and tap CHECK.':'Open the Mini App, stay for at least 15 seconds, then return and tap CHECK.',
  category:'official',reward:10,url:'',enabled:true,sort_order:0,task_type:type
});

export function AdminMiniAppTaskCreator({say}:{say:(s:string)=>void}){
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[rows,setRows]=useState<any[]>([]);
  const [form,setForm]=useState<any>(fresh());
  const load=async()=>{try{const d=await api('admin_get');setRows((d.tasks||[]).filter((x:any)=>x.task_type==='mini_app'||x.task_type==='private_channel'))}catch{}};
  useEffect(()=>{load()},[]);
  const isPrivate=form.task_type==='private_channel';
  const parsed=parseMini(String(form.url||'').trim());
  const valid=isPrivate?PRIVATE_RE.test(String(form.url||'').trim()):MINI_RE.test(String(form.url||'').trim());
  const setType=(type:'mini_app'|'private_channel')=>setForm({...fresh(type),category:form.category,reward:form.reward,enabled:form.enabled,sort_order:form.sort_order});
  const save=async()=>{try{
    setBusy(true);
    const title=String(form.title||'').trim(),url=String(form.url||'').trim();
    if(!title)throw Error('Task title is required');
    if(!Number.isFinite(Number(form.reward))||Number(form.reward)<=0)throw Error('Reward must be above 0');
    if(isPrivate&&!PRIVATE_RE.test(url))throw Error('Enter a valid private Telegram invite link like https://t.me/+xxxx');
    if(!isPrivate&&!MINI_RE.test(url))throw Error('Enter a valid Telegram Mini App URL');
    await api('admin_task_save',{task:{
      title,
      description:String(form.description||'').trim()||null,
      category:form.category||'official',
      task_type:isPrivate?'private_channel':'mini_app',
      reward:Number(form.reward),
      url,
      telegram_chat_id:null,
      verification:isPrivate?'none':'external_visit',
      enabled:form.enabled!==false,
      sort_order:Number(form.sort_order||0)
    }});
    say(isPrivate?'✅ Private channel task created':'✅ Mini App task created');
    setForm(fresh());
    setOpen(false);await load();
  }catch(e:any){say(e.message||'Could not create task')}finally{setBusy(false)}};
  return <section className="adminx-panel" style={{marginTop:14}}>
    <div className="adminx-panel-head"><div><span>CONTENT · EXTRA TYPES</span><h3>Mini App & Private Channel Tasks</h3><p>{rows.length} configured · private channels use invite-link tasks without membership verification</p></div><button type="button" onClick={()=>setOpen(v=>!v)}>{open?'CLOSE':'+ NEW TASK'}</button></div>
    {open&&<div className="adminx-form">
      <div className="adminx-grid">
        <label className="adminx-field"><span>Task type</span><select value={form.task_type} onChange={e=>setType(e.target.value as 'mini_app'|'private_channel')}><option value="mini_app">Mini App</option><option value="private_channel">Private Channel · No Verification</option></select></label>
        <label className="adminx-field"><span>Task title</span><input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder={isPrivate?'Join Private Channel':'Open Wiener Mini App'}/></label>
        <label className="adminx-field"><span>Reward WIENER</span><input type="number" min="0.01" step="0.01" value={form.reward} onChange={e=>setForm({...form,reward:e.target.value})}/></label>
        <label className="adminx-field"><span>Placement</span><select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}><option value="official">Official</option><option value="partner">Partner</option><option value="exclusive">Exclusive</option></select></label>
        <label className="adminx-field"><span>Sort order</span><input type="number" value={form.sort_order} onChange={e=>setForm({...form,sort_order:e.target.value})}/></label>
      </div>
      <label className="adminx-field"><span>{isPrivate?'Private Telegram Invite Link':'Telegram Mini App URL'}</span><input value={form.url} onChange={e=>setForm({...form,url:e.target.value})} placeholder={isPrivate?'https://t.me/+lrAy1mq1JfoyZjY0':'https://t.me/WienerDogeFarmBot?startapp=ref_2139807311'}/></label>
      <small style={{display:'block',margin:'-4px 0 12px',opacity:.64,lineHeight:1.5}}>{isPrivate?'Accepted: private invite links like https://t.me/+lrAy1mq1JfoyZjY0 · membership is NOT verified automatically.':'Accepted: https://t.me/BotName/app · https://t.me/BotName?startapp · https://t.me/BotName?startapp=payload'}</small>
      {form.url&&<div style={{padding:'12px 14px',border:'1px solid rgba(255,255,255,.09)',borderRadius:14,marginBottom:12,background:'rgba(255,255,255,.035)'}}><b style={{display:'block',fontSize:13}}>{valid?`✓ Valid ${isPrivate?'private invite':'Mini App'} link`:`⚠ Invalid ${isPrivate?'private invite':'Mini App'} link`}</b>{valid&&!isPrivate&&<small style={{display:'block',marginTop:5,opacity:.7}}>Bot: @{parsed.bot}{parsed.app?` · App: ${parsed.app}`:''}{parsed.hasStart?` · Start payload: ${parsed.payload||'none'}`:''}</small>}{valid&&isPrivate&&<small style={{display:'block',marginTop:5,opacity:.7}}>No Telegram membership verification will be required for this task.</small>}</div>}
      <label className="adminx-field"><span>Description</span><input value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label>
      <label className="adminx-switch"><input type="checkbox" checked={form.enabled!==false} onChange={e=>setForm({...form,enabled:e.target.checked})}/><span>Task enabled</span></label>
      <div className="adminx-form-actions"><button type="button" onClick={()=>setOpen(false)}>CANCEL</button><button type="button" className="adminx-primary" disabled={busy||!valid} onClick={save}>{busy?'SAVING…':isPrivate?'CREATE PRIVATE CHANNEL TASK':'CREATE MINI APP TASK'}</button></div>
    </div>}
    {!open&&rows.length>0&&<div className="adminx-list">{rows.slice(0,10).map((x:any)=><div key={x.id}><div><b>{x.title}</b><small>{x.task_type==='private_channel'?'PRIVATE CHANNEL · NO VERIFY':'MINI APP'} · {String(x.category||'official').toUpperCase()} · {x.completed_count||0} completions</small></div><div><strong>+{x.reward}</strong><span className={`aui-badge ${x.enabled!==false?'good':'bad'}`}>{x.enabled!==false?'ACTIVE':'OFF'}</span></div></div>)}</div>}
  </section>;
}
