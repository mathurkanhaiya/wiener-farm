import {useCallback,useEffect,useState} from 'react';
import {mandatoryApi} from './lib';

type JoinItem={
  id:string;title:string;subtitle?:string|null;join_type:'channel'|'group';telegram_chat_id:string;join_url:string;
  enabled:boolean;sort_order:number;joined?:boolean;check_error?:string|null;
};

function openTelegram(url:string){
  const tg=window.Telegram?.WebApp as any;
  try{if(tg?.openTelegramLink){tg.openTelegramLink(url);return}}catch{}
  window.open(url,'_blank','noopener,noreferrer');
}

export function MandatoryGate({disabled=false}:{disabled?:boolean}){
  const [items,setItems]=useState<JoinItem[]>([]),[loading,setLoading]=useState(!disabled),[checking,setChecking]=useState(false),[ready,setReady]=useState(disabled),[error,setError]=useState('');
  const check=useCallback(async(silent=false)=>{
    if(disabled)return;
    try{
      if(!silent)setChecking(true);
      setError('');
      const r=await mandatoryApi('check');
      setItems(r.items||[]);
      setReady(!!r.all_joined);
    }catch(e:any){setError(e.message||'Unable to verify membership')}finally{setLoading(false);setChecking(false)}
  },[disabled]);

  useEffect(()=>{if(disabled){setReady(true);setLoading(false);return}check();},[check,disabled]);
  useEffect(()=>{
    if(disabled)return;
    const delay=ready?45000:7000;
    const id=window.setInterval(()=>check(true),delay);
    const onFocus=()=>check(true);
    const onVisible=()=>{if(document.visibilityState==='visible')check(true)};
    window.addEventListener('focus',onFocus);document.addEventListener('visibilitychange',onVisible);
    return()=>{clearInterval(id);window.removeEventListener('focus',onFocus);document.removeEventListener('visibilitychange',onVisible)};
  },[check,disabled,ready]);

  if(disabled||(!loading&&ready))return null;
  const missing=items.filter(x=>!x.joined);
  return <div className="mandatory-overlay" role="dialog" aria-modal="true" aria-label="Required Telegram communities">
    <div className="mandatory-orb mandatory-orb-a"/><div className="mandatory-orb mandatory-orb-b"/>
    <section className="mandatory-card">
      <div className="mandatory-shield"><span>✓</span></div>
      <div className="mandatory-kicker">WIENER ACCESS</div>
      <h1>One Last Step</h1>
      <p className="mandatory-copy">Join the required communities to unlock WIENER. Membership is checked live.</p>

      {loading?<div className="mandatory-loading"><i/>Checking your memberships…</div>:<div className="mandatory-list">
        {items.map((x,i)=><div className={`mandatory-row ${x.joined?'is-joined':''}`} key={x.id} style={{'--delay':`${i*80}ms`} as any}>
          <div className="mandatory-row-icon">{x.joined?'✓':x.join_type==='group'?'👥':'✦'}</div>
          <div className="mandatory-row-copy"><b>{x.title}</b><small>{x.subtitle||`${x.join_type==='group'?'Community group':'Official channel'} · Required`}</small>{x.check_error&&<em>Bot cannot verify this chat yet</em>}</div>
          {x.joined?<button className="mandatory-joined" disabled>✓ JOINED</button>:<button className="mandatory-join" onClick={()=>openTelegram(x.join_url)}>JOIN</button>}
        </div>)}
        {!items.length&&!error&&<div className="mandatory-empty">No mandatory communities are active.</div>}
      </div>}

      {error&&<div className="mandatory-error">{error}</div>}
      <button className="mandatory-check" disabled={checking||loading} onClick={()=>check()}><span>{checking?'CHECKING…':'CHECK & CONTINUE'}</span></button>
      <small className="mandatory-hint">Already joined? Return here — status updates automatically.</small>
      {!!missing.length&&missing.some(x=>x.check_error)&&<small className="mandatory-bot-note">Admin note: WIENER bot must be an admin/member with permission to check members in every required chat.</small>}
    </section>
  </div>
}

export function MandatoryAdmin({say}:{say:(s:string)=>void}){
  const blank={title:'',subtitle:'',join_type:'channel' as const,telegram_chat_id:'',join_url:'',enabled:true,sort_order:0};
  const [rows,setRows]=useState<JoinItem[]>([]),[edit,setEdit]=useState<any>(null),[busy,setBusy]=useState(false),[open,setOpen]=useState(false);
  const load=async()=>{try{setBusy(true);setRows(await mandatoryApi('admin_get'))}catch(e:any){say(e.message)}finally{setBusy(false)}};
  useEffect(()=>{load()},[]);
  const start=(x?:JoinItem)=>{setEdit(x?{...x}:{...blank,sort_order:rows.length*10});setOpen(true)};
  const save=async()=>{try{setBusy(true);await mandatoryApi('admin_save',{item:edit});say('✅ Mandatory join saved');setOpen(false);setEdit(null);await load()}catch(e:any){say(e.message)}finally{setBusy(false)}};
  const del=async(id:string)=>{if(!confirm('Delete this mandatory join?'))return;try{setBusy(true);await mandatoryApi('admin_delete',{id});say('✅ Mandatory join deleted');await load()}catch(e:any){say(e.message)}finally{setBusy(false)}};
  return <section className="mandatory-admin">
    <div className="mandatory-admin-head"><div><span>🔐 ACCESS GATE</span><h3>Mandatory Join</h3><p>Add channels or groups users must stay joined to. Leaving one makes the gate appear again on the next live check.</p></div><button onClick={()=>start()}>+ ADD</button></div>
    <div className="mandatory-admin-note">For reliable live verification, add <b>@WienerDogeFarmBot</b> to each required channel/group as admin so Telegram allows member checks.</div>
    {rows.map(x=><div className="mandatory-admin-row" key={x.id}><div><b>{x.title}</b><small>{x.join_type.toUpperCase()} · {x.telegram_chat_id} · {x.enabled?'ACTIVE':'OFF'}</small></div><button onClick={()=>start(x)}>EDIT</button><button className="danger" onClick={()=>del(x.id)}>DELETE</button></div>)}
    {!rows.length&&!busy&&<div className="mandatory-admin-empty">No mandatory joins yet.</div>}
    {open&&edit&&<div className="mandatory-admin-editor">
      <div className="mandatory-editor-title"><b>{edit.id?'Edit mandatory join':'Add mandatory join'}</b><button onClick={()=>setOpen(false)}>×</button></div>
      <label><span>Title</span><input value={edit.title} onChange={e=>setEdit({...edit,title:e.target.value})} placeholder="WIENER Updates"/></label>
      <label><span>Subtitle</span><input value={edit.subtitle||''} onChange={e=>setEdit({...edit,subtitle:e.target.value})} placeholder="Official announcements"/></label>
      <div className="mandatory-type"><button className={edit.join_type==='channel'?'active':''} onClick={()=>setEdit({...edit,join_type:'channel'})}>📢 Channel</button><button className={edit.join_type==='group'?'active':''} onClick={()=>setEdit({...edit,join_type:'group'})}>👥 Group</button></div>
      <label><span>Telegram @username or chat ID</span><input value={edit.telegram_chat_id} onChange={e=>setEdit({...edit,telegram_chat_id:e.target.value})} placeholder="@WienerFarmUpdates"/></label>
      <label><span>Join URL</span><input value={edit.join_url} onChange={e=>setEdit({...edit,join_url:e.target.value})} placeholder="https://t.me/WienerFarmUpdates"/></label>
      <label><span>Sort order</span><input type="number" value={edit.sort_order} onChange={e=>setEdit({...edit,sort_order:Number(e.target.value)})}/></label>
      <label className="mandatory-toggle"><input type="checkbox" checked={edit.enabled!==false} onChange={e=>setEdit({...edit,enabled:e.target.checked})}/><span>Enabled</span></label>
      <div className="mandatory-editor-actions"><button onClick={()=>setOpen(false)}>CANCEL</button><button className="primary" disabled={busy||!edit.title||!edit.telegram_chat_id} onClick={save}>{busy?'SAVING…':'SAVE'}</button></div>
    </div>}
  </section>
}
