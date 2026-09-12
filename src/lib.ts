const viteEnv=(import.meta as any).env||{};
// V45 TON iOS browser compatibility
// Legacy names are kept only so older components compile. Runtime traffic is same-origin VPS only.
export const SUPABASE_URL='';
export const PUBLISHABLE_KEY='vps';
const edge=(name:string)=>`/functions/v1/${encodeURIComponent(name)}`;
export const API=edge('wiener-api');
export const ADMIN_API=edge('wiener-admin-api');
export const AD_API=edge('wiener-ad');
export const AD_USAGE_API=edge('wiener-ad-usage');
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

export type Tab='home'|'earn'|'ads'|'tasks'|'invite'|'wallet'|'daily'|'claim'|'profile'|'leaderboard'|'ambassador'|'admin';
export type Snapshot={user:any;settings:any;tasks:any[];completed:any[];transactions:any[];withdrawals:any[];withdrawal_methods?:any[];referrals:any[];leaderboard?:any[];rank?:number;tasks_completed_total?:number;is_admin:boolean;admin_role?:string};

// UI amounts should preserve meaningful precision but never pad zeroes.
// Examples: 20.000000 -> 20, 20.500000 -> 20.5, 0.050000 -> 0.05.
export const money=(n:any,d=6)=>Number(n||0).toLocaleString(undefined,{maximumFractionDigits:Math.max(0,d),minimumFractionDigits:0});
function trimDecimalString(v:string){
  if(!/^-?\d+\.\d+$/.test(v))return v;
  const x=v.replace(/(\.\d*?[1-9])0+$/,'$1').replace(/\.0+$/,'');
  return x==='-0'?'0':x;
}
function normalizeUiNumbers(v:any):any{
  if(typeof v==='string')return trimDecimalString(v);
  if(Array.isArray(v))return v.map(normalizeUiNumbers);
  if(v&&typeof v==='object'){
    const out:any={};
    for(const [k,val] of Object.entries(v))out[k]=normalizeUiNumbers(val);
    return out;
  }
  return v;
}

const REQUEST_TIMEOUT_MS=15000;
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
function requestError(status:number,x:any){
  const raw=String(x?.message||x?.error||'').trim();
  if([502,503,504].includes(status))return new Error('Server is reconnecting. Try again in a moment.');
  if(status===429)return new Error(raw||'Too many requests. Please wait a moment.');
  if(status>=500)return new Error(raw||'Temporary server error. Please try again.');
  return new Error(raw||'Request failed');
}
async function fetchJson(url:string,init:RequestInit,timeoutMs=REQUEST_TIMEOUT_MS){
  const controller=new AbortController(),timer=window.setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const r=await fetch(url,{...init,signal:controller.signal});
    const raw=await r.text();
    let x:any={ok:false,error:'invalid_response'};
    if(raw){try{x=JSON.parse(raw)}catch{x={ok:false,error:r.ok?'invalid_response':raw.slice(0,180)}}}
    if(!r.ok||x?.ok===false)throw requestError(r.status,x);
    return x;
  }catch(e:any){
    if(e?.name==='AbortError')throw new Error('Connection timed out. Please try again.');
    if(e instanceof TypeError)throw new Error('Network connection failed. Please try again.');
    throw e;
  }finally{window.clearTimeout(timer)}
}
function isTransientBootstrapError(e:any){return /reconnecting|temporary server|network connection|timed out/i.test(String(e?.message||e||''))}
function sanitizeAdminSettings(input:any){
  if(!input||typeof input!=='object'||Array.isArray(input))return {};
  const blocked=new Set(['id','updated_at','telegram_webhook_secret','notification_cron_secret','adsgram_reward_secret_hash','bot_webhook_synced_at','payout_last_config_check_at','payout_low_balance_last_alert_at','payout_last_alert_reason','treasury_last_scan_block','sponsored_min_reward','sponsored_max_reward']);
  const out:any={};
  for(const [k,v] of Object.entries(input))if(!blocked.has(k)&&v!==undefined)out[k]=v;
  return out;
}

export function hapticImpact(style:'light'|'medium'|'heavy'|'rigid'|'soft'='light'){
  try{(window.Telegram?.WebApp as any)?.HapticFeedback?.impactOccurred?.(style)}catch{}
}
export function hapticSelection(){
  try{(window.Telegram?.WebApp as any)?.HapticFeedback?.selectionChanged?.()}catch{}
}

// remainder intentionally preserved by build-safe prepatch
export async function post(url:string,body:any={}){return fetchJson(url,{method:'POST',headers:{'Content-Type':'application/json','apikey':PUBLISHABLE_KEY},body:JSON.stringify({...body,initData:getInitData()})})}
export function getInitData(){return window.Telegram?.WebApp?.initData||''}
export async function api(action:string,body:any={}){const x=await post(API,{action,...body});return normalizeUiNumbers(x.data??x)}
export function pageFromUrl():Tab{const p=new URLSearchParams(location.search).get('page') as Tab|null;return p||'home'}
export async function registerDevice(){return post(DEVICE_API,{action:'register'})}
