import {useEffect,useRef,useState} from 'react';
import {api,getInitData,pageFromUrl,registerDevice,type Snapshot,type Tab} from './lib';
import {Admin} from './Admin';
import {Ads} from './AdsPage';
import {MandatoryAdmin,MandatoryGate,checkMandatoryAccess} from './MandatoryJoin';
import {ClaimPage,DailyPage,Invite,LeaderboardPage,ProfilePage} from './pages';
import {HomeWithPromo} from './PromoClaim';
import {Tasks} from './TasksPage';
import {WalletV2,AdminWithdrawUpgrade} from './WithdrawV2';
import {Brand,Nav,OpenTelegram,Splash,StateScreen} from './ui';

function App(){
  const [tab,setTab]=useState<Tab>(()=>pageFromUrl()),[data,setData]=useState<Snapshot|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[toast,setToast]=useState(''),[mandatory,setMandatory]=useState<any>(null);
  const openedSent=useRef(false);
  const refresh=async()=>{try{setError('');const d=await api('bootstrap');setData(d);return d}catch(e:any){setError(e.message);return null}};
  useEffect(()=>{const t=window.Telegram?.WebApp;t?.ready?.();t?.expand?.();(async()=>{const d=await refresh();if(d){try{await registerDevice()}catch{}if(!d.is_admin){try{setMandatory(await checkMandatoryAccess())}catch{setMandatory({all_joined:true,items:[]})}}else setMandatory({all_joined:true,items:[]})}setLoading(false)})()},[]);
  useEffect(()=>{if(data&&!openedSent.current){openedSent.current=true;api('app_opened').catch(()=>{})}},[data]);
  const say=(s:string)=>{setToast(s);setTimeout(()=>setToast(''),2200)};
  const run=async(action:string,b:any={},ok='Done')=>{try{await api(action,b);say(ok);await refresh()}catch(e:any){say(e.message)}};
  if(loading)return <Splash text="Securing WIENER…"/>;
  if(!getInitData())return <OpenTelegram/>;
  if(error.includes('banned'))return <StateScreen icon="⛔" title="Account restricted" text="Your WIENER account is currently unavailable."/>;
  if(error&&!data)return <StateScreen icon="⚠" title="Unable to open" text={error}/>;
  if(data?.settings?.maintenance_enabled)return <StateScreen icon="🛠" title="Maintenance" text={data.settings.maintenance_message}/>;
  if(!data)return null;
  if(!data.is_admin&&mandatory&&!mandatory.all_joined)return <MandatoryGate initial={mandatory} onUnlocked={()=>setMandatory((x:any)=>({...x,all_joined:true}))}/>;
  return <div className="app-shell"><Brand data={data}/><main className="content">{tab==='home'&&<HomeWithPromo data={data} run={run} setTab={setTab} refresh={refresh} say={say}/>} {tab==='ads'&&<Ads data={data} refresh={refresh} say={say}/>} {tab==='tasks'&&<Tasks data={data} run={run} say={say}/>} {tab==='invite'&&<Invite data={data} say={say}/>} {tab==='wallet'&&<WalletV2 data={data} setTab={setTab}/>} {tab==='daily'&&<DailyPage data={data} run={run}/>} {tab==='claim'&&<ClaimPage data={data} run={run}/>} {tab==='leaderboard'&&<LeaderboardPage data={data}/>} {tab==='profile'&&<ProfilePage data={data} setTab={setTab}/>} {tab==='admin'&&data.is_admin&&<><MandatoryAdmin say={say}/><AdminWithdrawUpgrade say={say}/><Admin say={say}/></>}</main><Nav tab={tab} setTab={setTab} admin={data.is_admin}/>{toast&&<div className="toast">{toast}</div>}</div>
}
export default App;
