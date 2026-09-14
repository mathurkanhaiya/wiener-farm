import fs from 'node:fs';
const p='src/AdsPage.tsx';let s=fs.readFileSync(p,'utf8');
if(!s.includes('USL Ads — 100 ads')){
 const before='export function Ads({data,refresh,say}:{data:Snapshot;refresh:any;say:any}){';
 const component=String.raw`
async function uslApi(action:string,body:any={}){const r=await fetch('/functions/v1/wiener-usl-ad',{method:'POST',headers:{'Content-Type':'application/json','cache-control':'no-cache'},cache:'no-store',body:JSON.stringify({action,initData:getInitData(),...body})});const x=await r.json().catch(()=>({ok:false,error:'invalid_response'}));if(!r.ok||x?.ok===false)throw new Error(x?.message||x?.error||'USL Ads request failed');return x.data||x}
let uslSdkPromise:Promise<void>|null=null;
function loadUslSdk(){if((window as any).TowerAds)return Promise.resolve();if(uslSdkPromise)return uslSdkPromise;uslSdkPromise=new Promise((resolve,reject)=>{const old=document.querySelector('script[src="https://uslads.com/sdk/tower-ads-v4.js"]') as HTMLScriptElement|null;if(old){old.addEventListener('load',()=>resolve(),{once:true});old.addEventListener('error',()=>reject(new Error('USL Ads SDK unavailable')),{once:true});return}const el=document.createElement('script');el.src='https://uslads.com/sdk/tower-ads-v4.js';el.async=true;el.onload=()=>resolve();el.onerror=()=>reject(new Error('USL Ads SDK unavailable'));document.head.appendChild(el)});return uslSdkPromise}
function UslAdsBlock({refresh,say}:{refresh:any;say:any}){const [st,setSt]=useState({used:0,limit:100,reward:5}),[busy,setBusy]=useState(false),[left,setLeft]=useState(0);useEffect(()=>{uslApi('status').then(setSt).catch(()=>{})},[]);useEffect(()=>{if(left<=0)return;const t=setInterval(()=>setLeft(v=>Math.max(0,v-1)),1000);return()=>clearInterval(t)},[left]);const watch=async()=>{if(busy||left>0||st.used>=100)return;setBusy(true);try{const x=await uslApi('start');await loadUslSdk();let rewarded=false;await new Promise<void>(async(resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('USL Ads timed out')),120000);try{const ads=new (window as any).TowerAds({apiKey:'55aaf0fd9d76e523ec550bfc060fd2d7',placementId:'plc_5806cedb370f5ed9',onRewardEarned:()=>{rewarded=true;clearTimeout(timer);resolve()},onError:(e:any)=>{clearTimeout(timer);reject(new Error(String(e?.message||e||'USL Ads error')))}});await ads.loadAndShow()}catch(e){clearTimeout(timer);reject(e)}});if(!rewarded)throw new Error('Ad was not completed');let wait=Math.max(0,Number(x.wait_seconds||0));if(wait){setLeft(wait);await new Promise(r=>setTimeout(r,wait*1000));setLeft(0)}const done=await uslApi('complete',{session_id:x.session_id});setSt(v=>({...v,used:Number(done.used??v.used+1)}));say('+5 WIENER');await refresh()}catch(e:any){say(String(e?.message||'USL Ads failed'))}finally{setBusy(false)}};return <section className="card ad-card"><div className="square play"><AnimatedIcon name="ads" active={!busy&&left===0&&st.used<st.limit}/></div><div className="grow"><h3>USL Ads — 100 ads</h3><p>5 WIENER · {st.used}/{st.limit} today</p></div><button className="primary small" type="button" disabled={busy||left>0||st.used>=st.limit} onClick={watch}>{st.used>=st.limit?'DONE':busy?'…':left>0?left+'s':'WATCH'}</button></section>}

`;
 s=s.replace(before,component+before);
 // getInitData needed for server-authenticated session request
 s=s.replace("import {adApi,adUsageApi,secondaryAdApi,type Snapshot} from './lib';","import {adApi,adUsageApi,secondaryAdApi,getInitData,type Snapshot} from './lib';");
 // add block after existing bonus ad card
 const needle='<SpinEarn refresh={refresh} say={say}/>';
 s=s.replace(needle,'<UslAdsBlock refresh={refresh} say={say}/>'+needle);
 fs.writeFileSync(p,s);
}
console.log('V103 USL Ads frontend applied');