const viteEnv=(import.meta as any).env||{};
export const SUPABASE_URL=viteEnv.VITE_SUPABASE_URL||'https://hvyrairuogiljplmsuat.supabase.co';
export const PUBLISHABLE_KEY=viteEnv.VITE_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_y-GU9ztfz4rcVSQMce9eBA_OUO832is';
export const API=`${SUPABASE_URL}/functions/v1/wiener-api`;
export const AD_API=`${SUPABASE_URL}/functions/v1/wiener-ad`;
export const SECONDARY_AD_API=`${SUPABASE_URL}/functions/v1/wiener-tads`;
export const ADSGRAM_TASK_API=`${SUPABASE_URL}/functions/v1/wiener-adsgram-task`;
export const TASK_API=`${SUPABASE_URL}/functions/v1/wiener-task-api`;
export const MANDATORY_API=`${SUPABASE_URL}/functions/v1/wiener-mandatory`;
export const WITHDRAW_API=`${SUPABASE_URL}/functions/v1/wiener-withdraw`;
export const DEVICE_API=`${SUPABASE_URL}/functions/v1/wiener-device`;

export type Tab='home'|'ads'|'tasks'|'invite'|'wallet'|'daily'|'claim'|'profile'|'leaderboard'|'admin';
export type Snapshot={user:any;settings:any;tasks:any[];completed:any[];transactions:any[];withdrawals:any[];referrals:any[];leaderboard?:any[];rank?:number;tasks_completed_total?:number;is_admin:boolean;admin_role?:string};
export const money=(n:any,d=0)=>Number(n||0).toLocaleString(undefined,{maximumFractionDigits:d,minimumFractionDigits:d});
export const date=(v:string)=>v?new Date(v).toLocaleString():'';
export const token=()=> 'WIENER';
export function cleanUserText(v:any){return String(v||'').replace(/\bFarming\b/gi,'WIENER').replace(/\bFarm\b/gi,'WIENER').replace(/\bFARM\b/g,'WIENER')}
export function getInitData(){return window.Telegram?.WebApp?.initData||''}
export function pageFromUrl():Tab{const p=new URLSearchParams(window.location.search).get('page')||'';const map:Record<string,Tab>={home:'home',tasks:'tasks',referral:'invite',invite:'invite',leaderboard:'leaderboard',daily:'daily',claim:'claim',profile:'profile',wallet:'wallet',ads:'ads'};return map[p]||'home'}
function getDeviceId(){const key='wiener_device_id_v1';try{let id=localStorage.getItem(key);if(!id){id=crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;localStorage.setItem(key,id)}return id}catch{return `volatile-${navigator.userAgent.length}-${screen.width}x${screen.height}`}}
async function getDeviceFingerprint(){const raw=[navigator.userAgent,navigator.language,(navigator as any).platform||'',String((navigator as any).hardwareConcurrency||''),String((navigator as any).deviceMemory||''),String((navigator as any).maxTouchPoints||''),Intl.DateTimeFormat().resolvedOptions().timeZone||'',`${screen.width}x${screen.height}`].join('|');try{const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw));return [...new Uint8Array(buf)].map(x=>x.toString(16).padStart(2,'0')).join('')}catch{return raw.slice(0,128)}}
export async function deviceContext(){return {device_id:getDeviceId(),device_fingerprint:await getDeviceFingerprint()}}
async function post(url:string,action:string,body:any={}){const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','apikey':PUBLISHABLE_KEY},body:JSON.stringify({action,initData:getInitData(),...body})});const x=await r.json().catch(()=>({ok:false,error:'invalid_response'}));if(!r.ok||!x.ok)throw new Error(x.message||x.error||'Request failed');return x.data??x}
export async function registerDevice(){const ctx=await deviceContext();const r=await fetch(DEVICE_API,{method:'POST',headers:{'Content-Type':'application/json','apikey':PUBLISHABLE_KEY},body:JSON.stringify({initData:getInitData(),...ctx})});const x=await r.json().catch(()=>({ok:false,error:'invalid_response'}));if(!r.ok||!x.ok)throw new Error(x.message||x.error||'Device check failed');return x.data??x}
export async function api(action:string,body:any={}){return post(action==='task_claim'?TASK_API:API,action==='task_claim'?'claim':action,body)}
export async function taskApi(action:'check'|'claim',body:any={}){return post(TASK_API,action,body)}
export async function adApi(action:'start'|'complete'|'status',body:any={}){return post(AD_API,action,body)}
export async function secondaryAdApi(action:'stats'|'start'|'reward',body:any={}){return post(SECONDARY_AD_API,action,body)}
export async function adsgramTaskApi(action:'start'|'reward'|'status',body:any={}){return post(ADSGRAM_TASK_API,action,body)}
export async function mandatoryApi(action:'check'|'admin_get'|'admin_save'|'admin_delete',body:any={}){return post(MANDATORY_API,action,body)}
export async function withdrawApi(action:'methods'|'history'|'request'|'admin_boot'|'admin_method_save'|'admin_paid'|'admin_reject',body:any={}){return post(WITHDRAW_API,action,body)}
