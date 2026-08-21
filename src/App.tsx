import {useEffect,useRef,useState} from 'react';
import {api,getInitData,pageFromUrl,type Snapshot,type Tab} from './lib';
import {Admin} from './Admin';
import {Ads,ClaimPage,DailyPage,Home,Invite,LeaderboardPage,ProfilePage,Tasks,Wallet} from './pages';
import {Brand,Nav,OpenTelegram,Splash,StateScreen} from './ui';

function App(){
  const [tab,setTab]=useState<Tab>(()=>pageFromUrl());
  const [data,setData]=useState<Snapshot|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [toast,setToast]=useState('');
  const openedSent=useRef(false);

  const refresh=async()=>{try{setError('');setData(await api('bootstrap'))}catch(e:any){setError(e.message)}finally{setLoading(false)}};
  useEffect(()=>{const t=window.Telegram?.WebApp;t?.ready?.();t?.expand?.();refresh()},[]);
  useEffect(()=>{if(data&&!openedSent.current){openedSent.current=true;api('app_opened').catch(()=>{})}},[data]);
  useEffect(()=>{const onPop=()=>setTab(pageFromUrl());window.addEventListener('popstate',onPop);return()=>window.removeEventListener('popstate',onPop)},[]);

  const go=(next:Tab)=>{setTab(next);const map:any={invite:'referral'};const p=map[next]||next;const u=new URL(window.location.href);if(next==='home')u.searchParams.delete('page');else u.searchParams.set('page',p);history.replaceState({},'',u)};
  const say=(s:string)=>{setToast(s);setTimeout(()=>setToast(''),2200)};
  const run=async(action:string,b:any={},ok='Done')=>{try{await api(action,b);say(ok);await refresh()}catch(e:any){say(e.message)}};

  if(loading)return <Splash text="Securing WIENER…"/>;
  if(!getInitData())return <OpenTelegram/>;
  if(error.toLowerCase().includes('banned')||error.toLowerCase().includes('restricted'))return <StateScreen icon="🚫" title="Account Restricted" text={error||'Your WIENER account is restricted.'}/>;
  if(error&&!data)return <StateScreen icon="⚠" title="Unable to open" text={error}/>;
  if(!data)return null;
  if(data.settings?.maintenance_enabled&&!data.is_admin)return <StateScreen icon="🛠" title="WIENER is under maintenance" text={data.settings.maintenance_message||"We're making improvements. Please check back soon."}/>;

  return <div className="app-shell">
    <Brand data={data}/>
    <main className="content">
      {tab==='home'&&<Home data={data} run={run} setTab={go}/>} 
      {tab==='ads'&&<Ads data={data} refresh={refresh} say={say}/>} 
      {tab==='tasks'&&<Tasks data={data} run={run}/>} 
      {tab==='invite'&&<Invite data={data} say={say}/>} 
      {tab==='wallet'&&<Wallet data={data} run={run} setTab={go}/>} 
      {tab==='daily'&&<DailyPage data={data} run={run}/>} 
      {tab==='claim'&&<ClaimPage data={data} run={run}/>} 
      {tab==='leaderboard'&&<LeaderboardPage data={data}/>} 
      {tab==='profile'&&<ProfilePage data={data} setTab={go} say={say} refresh={refresh}/>} 
      {tab==='admin'&&data.is_admin&&<Admin say={say}/>} 
    </main>
    <Nav tab={tab} setTab={go} admin={data.is_admin}/>
    {toast&&<div className="toast">{toast}</div>}
  </div>
}
export default App;
