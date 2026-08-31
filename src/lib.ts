const viteEnv=(import.meta as any).env||{};
export const SUPABASE_URL=viteEnv.VITE_SUPABASE_URL||'https://hvyrairuogiljplmsuat.supabase.co';
export const PUBLISHABLE_KEY=viteEnv.VITE_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_y-GU9ztfz4rcVSQMce9eBA_OUO832is';
const edge=(name:string)=>`/api/supabase?fn=${encodeURIComponent(name)}`;
export const API=edge('wiener-api');
export const ADMIN_API=edge('wiener-admin-api');
export const AD_API=edge('wiener-ad');
export const SECONDARY_AD_API=edge('wiener-tads');
export const ADSGRAM_TASK_API=edge('wiener-adsgram-task');
export const TASK_API=edge('wiener-task-api');
export const MANDATORY_API=edge('wiener-mandatory');
export const WITHDRAW_API=edge('wiener-withdraw');
export const DEVICE_API=edge('wiener-device');
export const PROMO_CHANNEL_API=edge('wiener-promo-channel');
export const SHARE_API=edge('wiener-share');
export const MISSION_API=edge('wiener-missions');
export const AMBASSADOR_API=edge('wiener-ambassador');
export const AMBASSADOR_PUBLISH_API=edge('wiener-ambassador-publish');

export type Tab='home'|'ads'|'tasks'|'invite'|'wallet'|'daily'|'claim'|'profile'|'leaderboard'|'ambassador'|'admin';
export type Snapshot={user:any;settings:any;tasks:any[];completed:any[];transactions:any[];withdrawals:any[];withdrawal_methods?:any[];referrals:any[];leaderboard?:any[];rank?:number;tasks_completed_total?:number;is_admin:boolean;admin_role?:string};
export const money=(n:any,d=0)=>Number(n||0).toLocaleString(undefined,{maximumFractionDigits:d,minimumFractionDigits:d});
export const date=(v:string)=>v?new Date(v).toLocaleString():'';
export const token=()=> 'WIENER';
export function cleanUserText(v:any){return String(v||'').replace(/\bFarming\b/gi,'WIENER').replace(/\bFarm\b/gi,'WIENER').replace(/\bFARM\b/g,'WIENER')}
export function getInitData(){return window.Telegram?.WebApp?.initData||''}
export function pageFromUrl():Tab{const qs=new URLSearchParams(window.location.search),tg=window.Telegram?.WebApp as any,p=qs.get('page')||qs.get('tgWebAppStartParam')||String(tg?.initDataUnsafe?.start_param||'');const map:Record<string,Tab>={home:'home',tasks:'tasks',referral:'invite',invite:'invite',leaderboard:'leaderboard',daily:'daily',claim:'claim',profile:'profile',wallet:'wallet',ads:'ads',earn:'ads',ambassador:'ambassador'};return map[p]||'home'}
function persistentId(key:string){try{let id=localStorage.getItem(key);if(!id){id=crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;localStorage.setItem(key,id)}return id}catch{return `volatile-${navigator.userAgent.length}-${screen.width}x${screen.height}`}}
function getDeviceId(){return persistentId('wiener_device_id_v1')}
function getInstallationId(){return persistentId('wiener_installation_id_v2')}
async function sha256(raw:string){try{const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw));return [...new Uint8Array(buf)].map(x=>x.toString(16).padStart(2,'0')).join('')}catch{return raw.slice(0,128)}}
async function getDeviceFingerprint(){const raw=[navigator.userAgent,navigator.language,(navigator as any).platform||'',String((navigator as any).hardwareConcurrency||''),String((navigator as any).deviceMemory||''),String((navigator as any).maxTouchPoints||''),Intl.DateTimeFormat().resolvedOptions().timeZone||'',`${screen.width}x${screen.height}`].join('|');return sha256(raw)}
async function getDeviceFingerprintV2(){const tg=window.Telegram?.WebApp as any;const raw=['v2',navigator.userAgent,navigator.language,(navigator as any).platform||'',String((navigator as any).hardwareConcurrency||''),String((navigator as any).deviceMemory||''),String((navigator as any).maxTouchPoints||''),Intl.DateTimeFormat().resolvedOptions().timeZone||'',`${screen.width}x${screen.height}`,String(window.devicePixelRatio||1),tg?.platform||''].join('|');return sha256(raw)}
export async function deviceContext(){const tg=window.Telegram?.WebApp as any;return {device_id:getDeviceId(),installation_id:getInstallationId(),device_fingerprint:await getDeviceFingerprint(),fingerprint_v2:await getDeviceFingerprintV2(),telegram_platform:String(tg?.platform||'').slice(0,32),language:String(navigator.language||'').slice(0,32),timezone:String(Intl.DateTimeFormat().resolvedOptions().timeZone||'').slice(0,64)}}
async function post(url:string,action:string,body:any={}){const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','apikey':PUBLISHABLE_KEY},body:JSON.stringify({action,initData:getInitData(),...body})});const x=await r.json().catch(()=>({ok:false,error:'invalid_response'}));if(!r.ok||!x.ok)throw new Error(x.message||x.error||'Request failed');return x.data??x}
export async function registerDevice(){const ctx=await deviceContext();const r=await fetch(DEVICE_API,{method:'POST',headers:{'Content-Type':'application/json','apikey':PUBLISHABLE_KEY},body:JSON.stringify({initData:getInitData(),...ctx})});const x=await r.json().catch(()=>({ok:false,error:'invalid_response'}));if(!r.ok||!x.ok)throw new Error(x.message||x.error||'Device check failed');return x.data??x}
export async function api(action:string,body:any={}){const adminAction=action.startsWith('admin_')&&action!=='admin_bootstrap';const url=action==='task_claim'?TASK_API:adminAction?ADMIN_API:API;const mapped=action==='task_claim'?'claim':action;return post(url,mapped,body)}
export async function promoChannelApi(body:{code:string;channels?:string[]}){return post(PROMO_CHANNEL_API,'publish',body)}
export async function taskApi(action:'check'|'claim',body:any={}){return post(TASK_API,action,body)}
export async function adApi(action:'start'|'complete'|'status',body:any={}){return post(AD_API,action,body)}
export async function secondaryAdApi(action:'stats'|'start'|'reward',body:any={}){return post(SECONDARY_AD_API,action,body)}
export async function adsgramTaskApi(action:'start'|'reward'|'status',body:any={}){return post(ADSGRAM_TASK_API,action,body)}
export async function mandatoryApi(action:'check'|'admin_get'|'admin_save'|'admin_delete',body:any={}){return post(MANDATORY_API,action,body)}
export async function withdrawApi(action:'methods'|'history'|'request'|'admin_boot'|'admin_method_save'|'admin_paid'|'admin_reject',body:any={}){return post(WITHDRAW_API,action,body)}
export async function shareApi(){return post(SHARE_API,'prepare')}
export async function missionApi(action:'status'|'claim',body:any={}){return post(MISSION_API,action,body)}
export async function ambassadorApi(action:string,body:any={}){return action==='admin_publish_drop'?post(AMBASSADOR_PUBLISH_API,'publish',body):post(AMBASSADOR_API,action,body)}
