const viteEnv=(import.meta as any).env||{};
export const SUPABASE_URL=viteEnv.VITE_SUPABASE_URL||'https://hvyrairuogiljplmsuat.supabase.co';
export const PUBLISHABLE_KEY=viteEnv.VITE_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_y-GU9ztfz4rcVSQMce9eBA_OUO832is';
export const API=`${SUPABASE_URL}/functions/v1/wiener-api`;

export type Tab='home'|'ads'|'draw'|'tasks'|'invite'|'wallet'|'daily'|'claim'|'profile'|'leaderboard'|'raffle'|'tickets'|'admin';
export type Snapshot={
  user:any;settings:any;tasks:any[];completed:any[];transactions:any[];withdrawals:any[];referrals:any[];
  leaderboard?:any[];rank?:number;tasks_completed_total?:number;is_admin:boolean;admin_role?:string
};

export const money=(n:any,d=0)=>Number(n||0).toLocaleString(undefined,{maximumFractionDigits:d,minimumFractionDigits:d});
export const date=(v:string)=>v?new Date(v).toLocaleString():'';
export const token=()=> 'WIENER';
export function cleanUserText(v:any){return String(v||'').replace(/\bFarming\b/gi,'WIENER').replace(/\bFarm\b/gi,'WIENER').replace(/\bFARM\b/g,'WIENER')}

export function getInitData(){return window.Telegram?.WebApp?.initData||''}
export function pageFromUrl():Tab{
  const p=new URLSearchParams(window.location.search).get('page')||'';
  const map:Record<string,Tab>={home:'home',tasks:'tasks',referral:'invite',invite:'invite',leaderboard:'leaderboard',daily:'daily',claim:'claim',profile:'profile',wallet:'wallet',ads:'ads',draw:'draw',raffle:'draw',tickets:'tickets'};
  return map[p]||'home';
}
export async function api(action:string,body:any={}){
  const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json','apikey':PUBLISHABLE_KEY},body:JSON.stringify({action,initData:getInitData(),...body})});
  const x=await r.json().catch(()=>({ok:false,error:'invalid_response'}));
  if(!r.ok||!x.ok)throw new Error(x.message||x.error||'Request failed');
  return x.data??x;
}
