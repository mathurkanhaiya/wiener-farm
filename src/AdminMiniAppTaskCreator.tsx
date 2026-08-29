import {useEffect,useState} from 'react';
import {api} from './lib';

const MINI_RE=/^https:\/\/t\.me\/[A-Za-z0-9_]{5,}(?:\/[A-Za-z0-9_]+|\?startapp(?:=[A-Za-z0-9._~-]+)?)$/i;

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

export function AdminMiniAppTaskCreator({say}:{say:(s:string)=>void}){
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[rows,setRows]=useState<any[]>([]);
  const [form,setForm]=useState<any>({title:'',description:'Open the Mini App, stay for at least 15 seconds, then return and tap CHECK.',category:'official',reward:10,url:'',enabled:true,sort_order:0});
  const load=async()=>{try{const d=await api('admin_get');setRows((d.tasks||[]).filter((x:any)=>x.task_type==='mini_app'))}catch{}};
  useEffect(()=>{load()},[]);
  const parsed=parseMini(String(form.url||'').trim());
  const valid=MINI_RE.test(String(form.url||'').trim());
  const save=async()=>{try{
    setBusy(true);
    const title=String(form.title||'').trim(),url=String(form.url||'').trim();
    if(!title)throw Error('Task title is required');
    if(!Number.isFinite(Number(form.reward))||Number(form.reward)<=0)throw Error('Reward must be above 0');
    if(!MINI_RE.test(url))throw Error('Enter a valid Telegram Mini App URL');
    await api('admin_task_save',{task:{title,description:String(form.description||'').trim()||null,category:form.category||'official',task_type:'mini_app',reward:Number(form.reward),url,telegram_chat_id:null,verification:'external_visit',enabled:form.enabled!==false,sort_order:Number(form.sort_order||0)}});
    say('✅ Mini App task created');
    setForm({title:'',description:'Open the Mini App, stay for at least 15 seconds, then return and tap CHECK.',category:'official',reward:10,url:'',enabled:true,sort_order:0});
    setOpen(false);await load();
  }catch(e:any){say(e.message||'Could not create Mini App task')}finally{setBusy(false)}};
  return <section className="adminx-panel" style={{marginTop:14}}>
    <div className="adminx-panel-head"><div><span>CONTENT · NEW TYPE</span><h3>Mini App Tasks</h3><p>{rows.length} configured · timed visit + one-time reward</p></div><button type="button" onClick={()=>setOpen(v=>!v)}>{open?'CLOSE':'+ MINI APP TASK'}</button></div>
    {open&&<div className="adminx-form">
      <div className="adminx-grid">
        <label className="adminx-field"><span>Task title</span><input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Open Wiener Mini App"/></label>
        <label className="adminx-field"><span>Reward WIENER</span><input type="number" min="0.01" step="0.01" value={form.reward} onChange={e=>setForm({...form,reward:e.target.value})}/></label>
        <label className="adminx-field"><span>Placement</span><select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}><option value="official">Official</option><option value="partner">Partner</option><option value="exclusive">Exclusive</option></select></label>
        <label className="adminx-field"><span>Sort order</span><input type="number" value={form.sort_order} onChange={e=>setForm({...form,sort_order:e.target.value})}/></label>
      </div>
      <label className="adminx-field"><span>Telegram Mini App URL</span><input value={form.url} onChange={e=>setForm({...form,url:e.target.value})} placeholder="https://t.me/WienerDogeFarmBot?startapp=ref_2139807311"/></label>
      <small style={{display:'block',margin:'-4px 0 12px',opacity:.64,lineHeight:1.5}}>Accepted: https://t.me/BotName/app · https://t.me/BotName?startapp · https://t.me/BotName?startapp=payload</small>
      {form.url&&<div style={{padding:'12px 14px',border:'1px solid rgba(255,255,255,.09)',borderRadius:14,marginBottom:12,background:'rgba(255,255,255,.035)'}}><b style={{display:'block',fontSize:13}}>{valid?'✓ Valid Mini App link':'⚠ Invalid Mini App link'}</b>{valid&&<small style={{display:'block',marginTop:5,opacity:.7}}>Bot: @{parsed.bot}{parsed.app?` · App: ${parsed.app}`:''}{parsed.hasStart?` · Start payload: ${parsed.payload||'none'}`:''}</small>}</div>}
      <label className="adminx-field"><span>Description</span><input value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label>
      <label className="adminx-switch"><input type="checkbox" checked={form.enabled!==false} onChange={e=>setForm({...form,enabled:e.target.checked})}/><span>Task enabled</span></label>
      <div className="adminx-form-actions"><button type="button" onClick={()=>setOpen(false)}>CANCEL</button><button type="button" className="adminx-primary" disabled={busy||!valid} onClick={save}>{busy?'SAVING…':'CREATE MINI APP TASK'}</button></div>
    </div>}
    {!open&&rows.length>0&&<div className="adminx-list">{rows.slice(0,8).map((x:any)=><div key={x.id}><div><b>{x.title}</b><small>MINI APP · {String(x.category||'official').toUpperCase()} · {x.completed_count||0} completions</small></div><div><strong>+{x.reward}</strong><span className={`aui-badge ${x.enabled!==false?'good':'bad'}`}>{x.enabled!==false?'ACTIVE':'OFF'}</span></div></div>)}</div>}
  </section>;
}
