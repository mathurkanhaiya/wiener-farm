import fs from 'node:fs';
import path from 'node:path';

let changed=0;
const roots=['src'];
const exts=new Set(['.ts','.tsx','.js','.jsx']);

function one(s,re,repl,label){
  if(!re.test(s)) throw new Error(`V21 prebuild source drift: ${label}`);
  return s.replace(re,repl);
}

function patchAdminHub(s,p){
  if(!p.endsWith('AdminHub.tsx')) return s;
  s=s.replace(
    "const load=async()=>{try{setBusy(true);setD(await api('admin_get'))}catch(e:any){say(e.message)}finally{setBusy(false)}};",
    "const load=async()=>{try{setBusy(true);const raw:any=await api('admin_get');setD(raw&&typeof raw==='object'?raw:{})}catch(e:any){say(e.message);setD({})}finally{setBusy(false)}};"
  );
  s=s.replace(
    "const withdrawals=d.withdrawals||[],tasks=d.tasks||[],promos=d.promos||[],stats=d.stats||{};",
    "const withdrawals=Array.isArray(d?.withdrawals)?d.withdrawals:[],tasks=Array.isArray(d?.tasks)?d.tasks:[],promos=Array.isArray(d?.promos)?d.promos:[],stats=(d?.stats&&typeof d.stats==='object')?d.stats:{};"
  );
  s=s.replace(
    "const search=async(value=q)=>{try{setBusy(true);const r=await api('admin_user_search',{query:value});setRows(r.users||[])}catch(e:any){say(e.message)}finally{setBusy(false)}};",
    "const search=async(value=q)=>{try{setBusy(true);const r:any=await api('admin_user_search',{query:value});setRows(Array.isArray(r?.users)?r.users:[])}catch(e:any){say(e.message);setRows([])}finally{setBusy(false)}};"
  );
  return s;
}

function patchWallet(s,p){
  if(!p.endsWith('WithdrawV3.tsx')) return s;
  if(s.includes('WIENER_WALLET_RELIABILITY_V21')) return s;

  s=one(s,/import \{useEffect,useState\} from 'react';/,"import {useEffect,useRef,useState} from 'react';\n// WIENER_WALLET_RELIABILITY_V21",'wallet ref import');

  const api=`function friendlyTonError(e:any){
  const raw=String(e?.message||e||'').trim();
  if(/ton_wallet_already_used/i.test(raw))return 'This TON wallet is already connected to another WIENER Farm account.';
  if(/walletnotconnected|wallet not connected|not connected/i.test(raw))return 'Wallet already disconnected.';
  if(/user.*(reject|cancel)|cancelled|canceled/i.test(raw))return 'Wallet action cancelled.';
  if(/429|too many requests|rate.?limit/i.test(raw))return 'TON network is busy. Please wait a moment and try again.';
  if(/ton_price_unavailable|price.*unavailable/i.test(raw))return 'Live TON price is temporarily unavailable. Please try again shortly.';
  if(/cooldown/i.test(raw))return 'Withdrawal cooldown is still active.';
  if(/pending.*withdraw/i.test(raw))return 'You already have a pending withdrawal.';
  if(/insufficient|balance/i.test(raw))return 'Insufficient WIENER balance for this withdrawal.';
  if(/bridge|session|unknown app|connection.*closed/i.test(raw))return 'Wallet session expired. Reconnect your TON wallet.';
  if(/abort|timeout|timed out/i.test(raw))return 'TON service timed out. Please try again.';
  if(/network|fetch|failed to fetch/i.test(raw))return 'TON service is temporarily unavailable. Please try again.';
  return 'Wallet service is temporarily unavailable. Please reconnect and try again.';
}
async function tonApi(action:string,body:any={}){
  const controller=new AbortController(),timer=window.setTimeout(()=>controller.abort(),15000);
  try{
    const r=await fetch('/functions/v1/wiener-ton-wallet',{method:'POST',headers:{'Content-Type':'application/json','apikey':PUBLISHABLE_KEY,'cache-control':'no-cache'},cache:'no-store',signal:controller.signal,body:JSON.stringify({action,initData:getInitData(),...body})});
    const raw=await r.text();let x:any={ok:false,error:'invalid_response'};
    if(raw){try{x=JSON.parse(raw)}catch{x={ok:false,error:raw.slice(0,160)}}}
    if(r.status===429)throw new Error('ton_rate_limited');
    if(!r.ok||!x.ok)throw new Error(x.message||x.error||'ton_wallet_request_failed');
    return x.data??x;
  }catch(e:any){
    if(e?.name==='AbortError')throw new Error('ton_timeout');
    if(e instanceof TypeError)throw new Error('ton_network');
    throw e;
  }finally{window.clearTimeout(timer)}
}`;
  s=one(s,/async function tonApi\(action:string,body:any=\{\}\)\{.*?\}\n\nfunction GramIcon/s,api+'\n\nfunction GramIcon','TON API wrapper');

  s=one(s,
    / const \[step,setStep\]=useState<Step>\('wallet'\).*?\[syncing,setSyncing\]=useState\(false\);/s,
    " const [step,setStep]=useState<Step>('wallet'),[amount,setAmount]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[history,setHistory]=useState<any[]>(Array.isArray(data.withdrawals)?data.withdrawals:[]),[selected,setSelected]=useState<any>(null),[balance,setBalance]=useState(Number(data.user.balance||0)),[cooldownUntil,setCooldownUntil]=useState<string|null>(null),[cooldownMs,setCooldownMs]=useState(0),[hasPending,setHasPending]=useState((Array.isArray(data.withdrawals)?data.withdrawals:[]).some((w:any)=>String(w.status)==='pending')),[globalEnabled,setGlobalEnabled]=useState(!!data.settings.withdrawals_enabled),[tonWallet,setTonWallet]=useState(''),[tonProvider,setTonProvider]=useState(''),[tonUsd,setTonUsd]=useState<number|null>(null),[tonBusy,setTonBusy]=useState(false),[syncing,setSyncing]=useState(false);const loadRef=useRef<Promise<void>|null>(null),disconnectingRef=useRef(false),statusBusyRef=useRef(false),lastSyncAtRef=useRef(0);",
    'wallet state'
  );

  const load=` const loadCore=async(showError=false)=>{try{setSyncing(true);const [m,h,t]=await Promise.all([withdrawApi('methods'),withdrawApi('history'),tonApi('status')]);const methods=Array.isArray((m as any)?.methods)?(m as any).methods:[],gram=methods.find((x:Method)=>x.method_key==='gram_ton')||(t as any)?.method||null,hist=Array.isArray(h)?h:Array.isArray((h as any)?.history)?(h as any).history:[];setMethod(gram);setBalance(v=>Number((m as any)?.balance??v));setCooldownUntil((m as any)?.cooldown_until||null);setCooldownMs(remaining((m as any)?.cooldown_until||null));setHasPending(!!(m as any)?.has_pending);setGlobalEnabled((m as any)?.settings?.withdrawals_enabled!==false);setHistory(hist);setTonUsd((t as any)?.ton_usd==null?null:Number((t as any).ton_usd));if((t as any)?.wallet?.address){setTonWallet(String((t as any).wallet.address));setTonProvider(String((t as any).wallet.provider||'TON Connect'))}else{setTonWallet('');setTonProvider('')}}catch(e:any){if(showError||!preloaded.length)setMessage(friendlyTonError(e))}finally{setSyncing(false)}};
 const load=async(showError=false)=>{if(loadRef.current)return loadRef.current;const task=loadCore(showError);loadRef.current=task;try{await task}finally{if(loadRef.current===task)loadRef.current=null}};`;
  s=one(s,/ const load=async\(showError=false\)=>\{.*?\};\n const bindConnected=/s,load+'\n const bindConnected=','deduplicated wallet load');

  const bind=`const bindConnected=async(w:any,silent=false)=>{if(disconnectingRef.current||!w?.account?.address)return false;const rawAddress=String(w.account.address),provider=String(w.device?.appName||w.device?.name||'TON Connect');try{const bound=await tonApi('bind',{address:rawAddress,provider});setTonWallet(String(bound.address));setTonProvider(String(bound.provider||provider));if(!silent)setMessage('✅ Gram wallet connected');return true}catch(e:any){const msg=friendlyTonError(e);if(/another WIENER Farm account/i.test(msg)){disconnectingRef.current=true;try{const ui=getTonUI();if((ui as any).wallet)await Promise.race([ui.disconnect(),new Promise((_,rej)=>setTimeout(()=>rej(new Error('ton_disconnect_timeout')),5000))])}catch{}finally{disconnectingRef.current=false}setTonWallet('');setTonProvider('')}setMessage(msg);return false}};`;
  s=one(s,/const bindConnected=async\(w:any,silent=false\)=>\{.*?\};\n useEffect\(\)=>/s,bind+'\n useEffect(()=>','safe wallet binding');

  const lifecycle=` useEffect(()=>{let alive=true,ui:TonConnectUI;try{ui=getTonUI()}catch(e:any){setMessage(friendlyTonError(e));return()=>{alive=false}}const syncNow=async(force=false)=>{if(!alive||disconnectingRef.current||statusBusyRef.current)return;const now=Date.now();if(!force&&now-lastSyncAtRef.current<1200)return;lastSyncAtRef.current=now;statusBusyRef.current=true;try{const current=(ui as any).wallet;if(current?.account?.address)await bindConnected(current,true);await load(false)}catch(e:any){if(alive)setMessage(friendlyTonError(e))}finally{statusBusyRef.current=false}};void syncNow(true);const off=ui.onStatusChange(async(w:any)=>{if(!alive||disconnectingRef.current)return;try{if(w?.account?.address){await bindConnected(w);await load(false)}else{setTonWallet('');setTonProvider('');await load(false)}}catch(e:any){if(alive)setMessage(friendlyTonError(e))}});const onFocus=()=>{void syncNow(false)},onVisible=()=>{if(document.visibilityState==='visible')void syncNow(false)};window.addEventListener('focus',onFocus);document.addEventListener('visibilitychange',onVisible);return()=>{alive=false;try{off()}catch{}window.removeEventListener('focus',onFocus);document.removeEventListener('visibilitychange',onVisible)}},[]);`;
  s=one(s,/ useEffect\(\)=>\{const ui=getTonUI\(\);.*?\},\[\]\);\n useEffect\(\)=>\{if\(!cooldownUntil\)/s,lifecycle+'\n useEffect(()=>{if(!cooldownUntil','wallet lifecycle');

  const actions=` const connect=async()=>{if(tonBusy||disconnectingRef.current)return;try{setTonBusy(true);setMessage('');const ui=getTonUI(),current=(ui as any).wallet;if(current?.account?.address){await bindConnected(current);await load(true);return}await ui.openModal()}catch(e:any){setMessage(friendlyTonError(e))}finally{setTonBusy(false)}};
 const disconnect=async()=>{if(tonBusy||disconnectingRef.current)return;setTonBusy(true);disconnectingRef.current=true;let sdkNote='',unbound=false;try{try{const ui=getTonUI();if((ui as any).wallet)await Promise.race([ui.disconnect(),new Promise((_,rej)=>setTimeout(()=>rej(new Error('ton_disconnect_timeout')),5000))])}catch(e:any){const m=friendlyTonError(e);if(!/already disconnected/i.test(m))sdkNote=m}for(let attempt=0;attempt<2&&!unbound;attempt++){try{await tonApi('unbind');unbound=true}catch{if(attempt===0)await new Promise(r=>setTimeout(r,450));else setMessage('Wallet disconnected locally, but server sync is pending. Tap DISCONNECT again.')}}if(unbound){setTonWallet('');setTonProvider('');setAmount('');setStep('wallet');setMessage(sdkNote&&/expired|temporarily/i.test(sdkNote)?'✅ Wallet disconnected. Previous wallet session was already unavailable.':'✅ TON wallet disconnected.')}}finally{disconnectingRef.current=false;setTonBusy(false);await load(false)}};`;
  s=one(s,/ const connect=async\(\)=>\{.*?\};\n const disconnect=async\(\)=>\{.*?\};\n const quick=/s,actions+'\n const quick=','connect/disconnect lifecycle');

  s=s.replace(/const raw=String\(e\.message\|\|e\);setMessage\(raw\.includes\('ton_price_unavailable'\).*?\)\}/s,"setMessage(friendlyTonError(e))}");
  return s;
}

function walk(dir){
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,ent.name);
    if(ent.isDirectory()) walk(p);
    else if(exts.has(path.extname(ent.name))){
      let s=fs.readFileSync(p,'utf8'),before=s;
      s=s.replace(/\$\{SUPABASE_URL\}\/functions\/v1\/([A-Za-z0-9_-]+)/g,'/functions/v1/$1');
      s=s.replace(/https:\/\/[A-Za-z0-9.-]*supabase\.co\/functions\/v1\/([A-Za-z0-9_-]+)/g,'/functions/v1/$1');
      s=s.replace(/\/api\/supabase\?fn=([A-Za-z0-9_-]+)/g,'/functions/v1/$1');
      s=patchAdminHub(s,p);
      s=patchWallet(s,p);
      if(s!==before){fs.writeFileSync(p,s);changed++;console.log('V21 direct rewrite:',p)}
    }
  }
}
for(const r of roots)if(fs.existsSync(r))walk(r);
console.log(`V21 prebuild complete; ${changed} source file(s) rewritten.`);
