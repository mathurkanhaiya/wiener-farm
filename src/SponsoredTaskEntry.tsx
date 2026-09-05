import {lazy,Suspense,useState} from 'react';
const Creator=lazy(()=>import('./SponsoredTaskCreator').then(m=>({default:m.SponsoredTaskCreator})));
const Manager=lazy(()=>import('./SponsoredTaskManager').then(m=>({default:m.SponsoredTaskManager})));

export function SponsoredTaskEntry(){
 const [mode,setMode]=useState<'create'|'manage'|null>(null);
 return <><div className="sponsor-entry-actions"><button className="create-sponsored-task" onClick={()=>setMode('create')}>＋ CREATE TASK</button><button className="manage-sponsored-task" onClick={()=>setMode('manage')}>⚙ MANAGE TASKS</button></div>{mode==='create'&&<Suspense fallback={<div className="card" style={{padding:14,marginBottom:12}}>Loading task creator…</div>}><Creator onClose={()=>setMode(null)} onLive={()=>setMode('manage')}/></Suspense>}{mode==='manage'&&<Suspense fallback={<div className="card" style={{padding:14,marginBottom:12}}>Loading task manager…</div>}><Manager onClose={()=>setMode(null)} onCreate={()=>setMode('create')}/></Suspense>}<style>{`.sponsor-entry-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 12px}.create-sponsored-task,.manage-sponsored-task{width:100%;height:46px;border-radius:15px;font-size:11px;font-weight:950;letter-spacing:.04em}.create-sponsored-task{border:1px solid rgba(255,224,66,.25);background:linear-gradient(180deg,rgba(255,226,53,.13),rgba(255,203,0,.07));color:#ffe65b}.manage-sponsored-task{border:1px solid rgba(95,220,160,.22);background:linear-gradient(180deg,rgba(64,207,139,.12),rgba(30,150,96,.06));color:#aef2cf}`}</style></>;
}
