import {useEffect,useState} from 'react';
import {api,getInitData,type Snapshot,type Tab} from './lib';
import {Admin} from './Admin';
import {Ads,Home,Invite,Tasks,Wallet} from './pages';
import {Brand,Nav,OpenTelegram,Splash,StateScreen} from './ui';

function App(){
  const [tab,setTab]=useState<Tab>('home'),[data,setData]=useState<Snapshot|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[toast,setToast]=useState('');
  const refresh=async()=>{try{setError('');const d=await api('bootstrap');setData(d)}catch(e:any){setError(e.message)}finally{setLoading(false)}};
  useEffect(()=>{const t=window.Telegram?.WebApp;t?.ready?.();t?.expand?.();refresh()},[]);
  const say=(s:string)=>{setToast(s);setTimeout(()=>setToast(''),2200)};
  const run=async(action:string,b:any={},ok='Done')=>{try{await api(action,b);say(ok);await refresh()}catch(e:any){say(e.message)}};
  if(loading)return <Splash text="Securing WIENER FARM…"/>;
  if(!getInitData())return <OpenTelegram/>;
  if(error.includes('banned'))return <StateScreen icon="⛔" title="Account restricted" text="Your WIENER FARM account is currently unavailable."/>;
  if(error&&!data)return <StateScreen icon="⚠" title="Unable to open" text={error}/>;
  if(data?.settings?.maintenance_enabled)return <StateScreen icon="🛠" title="Maintenance" text={data.settings.maintenance_message}/>;
  if(!data)return null;
  return <div className="app-shell">
    <Brand data={data}/>
    <main className="content">
      {tab==='home'&&<Home data={data} run={run} setTab={setTab}/>} 
      {tab==='ads'&&<Ads data={data} refresh={refresh} say={say}/>} 
      {tab==='tasks'&&<Tasks data={data} run={run}/>} 
      {tab==='invite'&&<Invite data={data} say={say}/>} 
      {tab==='wallet'&&<Wallet data={data} run={run} setTab={setTab}/>} 
      {tab==='admin'&&data.is_admin&&<Admin say={say}/>} 
    </main>
    <Nav tab={tab} setTab={setTab} admin={data.is_admin}/>
    {toast&&<div className="toast">{toast}</div>}
  </div>
}
export default App;
