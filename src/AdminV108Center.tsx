import {useMemo} from 'react';
import {money} from './lib';

export function AdminV108Center({data,section}:{data:any;section:'analytics'|'security'}){
 const x=useMemo(()=>{
  const w=data?.withdrawals||[], t=data?.tasks||[], p=data?.promos||[], s=data?.stats||{};
  const pending=w.filter((v:any)=>v.status==='pending');
  const paid=w.filter((v:any)=>v.status==='paid');
  const rejected=w.filter((v:any)=>v.status==='rejected');
  const activeTasks=t.filter((v:any)=>v.enabled);
  const activePromos=p.filter((v:any)=>v.enabled&&(!v.expires_at||Date.parse(v.expires_at)>Date.now()));
  return {s,pending,paid,rejected,activeTasks,activePromos,w};
 },[data]);
 if(section==='security') return <div className="adminx-page">
  <div className="adminx-section-title"><div><span>SECURITY CENTER · V108</span><h3>Anti-Script & Account Safety</h3><p>Review account risk without changing the current earning or payout flow.</p></div></div>
  <div className="adminx-kpis"><K label="Anti-Script" value="OBSERVE" note="V107 monitor only"/><K label="Banned" value={Number(x.s.banned_users||0)} note="existing account bans"/><K label="Pending review" value={x.pending.length} note="withdrawals to inspect"/><K label="Mode" value="SAFE" note="no IP auto-ban"/></div>
  <section className="adminx-panel"><div className="adminx-panel-head"><div><span>PROTECTION</span><h3>Current safeguards</h3></div></div><div className="adminx-status"><S ok text="Anti-Script observation active"/><S ok text="No automatic IP bans"/><S ok text="Existing user ban/unban preserved"/><S ok text="Existing payout checks preserved"/></div></section>
  <section className="adminx-panel"><div className="adminx-panel-head"><div><span>INVESTIGATION FLOW</span><h3>Safe review</h3></div></div><div className="adminx-alerts"><div><i>1</i><span>Open Users and inspect account timeline, ads, tasks, referrals and money.</span></div><div><i>2</i><span>Check Security tab for existing device/account abuse signals.</span></div><div><i>3</i><span>Use manual restrict/ban actions only after evidence review.</span></div></div></section>
 </div>;
 return <div className="adminx-page">
  <div className="adminx-section-title"><div><span>LIVE ANALYTICS · V108</span><h3>Operations overview</h3><p>Read-only analytics calculated from the existing admin data.</p></div></div>
  <div className="adminx-kpis"><K label="Total users" value={Number(x.s.total_users||0)} note={`${Number(x.s.active_24h||0)} active 24h`}/><K label="New 24h" value={Number(x.s.new_24h||0)} note="new accounts"/><K label="Pending" value={x.pending.length} note={`${x.paid.length} paid · ${x.rejected.length} rejected`}/><K label="Active content" value={x.activeTasks.length+x.activePromos.length} note={`${x.activeTasks.length} tasks · ${x.activePromos.length} promos`}/></div>
  <section className="adminx-panel"><div className="adminx-panel-head"><div><span>WITHDRAWALS</span><h3>Queue health</h3></div></div><div className="adminx-status"><S ok={x.pending.length<50} text={`${x.pending.length} pending`}/><S ok text={`${x.paid.length} paid`}/><S ok={x.rejected.length===0} text={`${x.rejected.length} rejected`}/></div></section>
  <section className="adminx-panel"><div className="adminx-panel-head"><div><span>CONTENT</span><h3>Availability</h3></div></div><div className="adminx-status"><S ok={x.activeTasks.length>0} text={`${x.activeTasks.length} active tasks`}/><S ok={x.activePromos.length>0} text={`${x.activePromos.length} active promos`}/><S ok={!!data?.settings?.ads_enabled} text={data?.settings?.ads_enabled?'Ads enabled':'Ads disabled'}/><S ok={!!data?.settings?.withdrawals_enabled} text={data?.settings?.withdrawals_enabled?'Withdrawals enabled':'Withdrawals disabled'}/></div></section>
 </div>
}
function K({label,value,note}:{label:string;value:any;note:string}){return <div><small>{label}</small><b>{value}</b><span>{note}</span></div>}
function S({ok,text}:{ok:boolean;text:string}){return <span className={ok?'ok':'warn'}><i/> {text}</span>}
