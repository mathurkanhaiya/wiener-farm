export const SUPABASE_URL=import.meta.env.VITE_SUPABASE_URL||'https://hvyrairuogiljplmsuat.supabase.co';
export const PUBLISHABLE_KEY=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_y-GU9ztfz4rcVSQMce9eBA_OUO832is';
export const API=`${SUPABASE_URL}/functions/v1/wiener-api`;

export type Tab='home'|'ads'|'tasks'|'invite'|'wallet'|'admin';
export type Snapshot={user:any;settings:any;tasks:any[];completed:any[];transactions:any[];withdrawals:any[];referrals:any[];is_admin:boolean;admin_role?:string};

export const icons={home:'⌂',ads:'▻',tasks:'✓',invite:'♙+',wallet:'▣',admin:'⚙'};
export const money=(n:any,d=0)=>Number(n||0).toLocaleString(undefined,{maximumFractionDigits:d,minimumFractionDigits:d});
export const date=(v:string)=>v?new Date(v).toLocaleString():'';

export function getInitData(){return window.Telegram?.WebApp?.initData||''}
export async function api(action:string,body:any={}){
  const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json','apikey':PUBLISHABLE_KEY},body:JSON.stringify({action,initData:getInitData(),...body})});
  const x=await r.json().catch(()=>({ok:false,error:'invalid_response'}));
  if(!r.ok||!x.ok)throw new Error(x.message||x.error||'Request failed');
  return x.data??x;
}
