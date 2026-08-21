import {useEffect,useRef,useState} from 'react';
import {api,getInitData,pageFromUrl,type Snapshot,type Tab} from './lib';
import {Admin} from './Admin';
import {Ads,ClaimPage,DailyPage,Home,Invite,LeaderboardPage,ProfilePage,Tasks,Wallet} from './pages';
import {AdsTicketProgress,EarnTicketsPage,HomeRaffleCard,RaffleAdmin,RafflePage,ReferralRaffleCard,TasksTicketCard} from './Raffle';
import {Brand,Nav,OpenTelegram,Splash,StateScreen} from './ui';

function App(){
  const [tab,setTab]=useState<Tab>(()=>pageFromUrl()),[data,setData]=useState<Snapshot|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[toast,setToast]=useState('');
  const openedSent=useRef(false);
  const refresh=async()=>{try{setError('');const d=await api('bootstrap');setData(d)}catch(e:any){setError(e.message)}finally{setLoading(false)}};
  useEffect(()=>{const t=window.Telegram?.WebApp;t?.ready?.();t?.expand?.();refresh()},[]);
  useEffect(()=>{if(data&&!openedSent.current){openedSent.current=true;api('app_opened').catch(()=>{})}},[data]);
  const say=(s:string)=>{setToast(s);setTimeout(()=>setToast(''),2200)};
  const run=async(action:string,b:any={},ok='Done')=>{try{await api(action,b);say(ok);await refresh()}catch(e:any){say(e.message)}};
  if(loading)return <Splash text="Securing WIENER…"/>;
  if(!getInitData())return <OpenTelegram/>;
  if(error.includes('banned'))return <StateScreen icon="⛔" title="Account restricted" text="Your WIENER account is currently unavailable."/>;
  if(error&&!data)return <StateScreen icon="⚠" title="Unable to open" text={error}/>;
  if(data?.settings?.maintenance_enabled)return <StateScreen icon="🛠" title="Maintenance" text={data.settings.maintenance_message}/>;
  if(!data)return null;
  return <div className="app-shell">
    <Brand data={data}/>
    <main className="content">
      {tab==='home'&&<><Home data={data} run={run} setTab={setTab}/><HomeRaffleCard setTab={setTab}/></>}
      {tab==='ads'&&<><Ads data={data} refresh={refresh} say={say}/><AdsTicketProgress/></>}
      {tab==='tasks'&&<><Tasks data={data} run={run}/><TasksTicketCard setTab={setTab}/></>}
      {tab==='invite'&&<><Invite data={data} say={say}/><ReferralRaffleCard setTab={setTab}/></>}
      {tab==='wallet'&&<Wallet data={data} run={run} setTab={setTab}/>} 
      {tab==='daily'&&<DailyPage data={data} run={run}/>} 
      {tab==='claim'&&<ClaimPage data={data} run={run}/>} 
      {tab==='leaderboard'&&<LeaderboardPage data={data}/>} 
      {tab==='profile'&&<ProfilePage data={data} setTab={setTab}/>} 
      {tab==='raffle'&&<RafflePage setTab={setTab}/>} 
      {tab==='tickets'&&<EarnTicketsPage setTab={setTab}/>} 
      {tab==='admin'&&data.is_admin&&<><Admin say={say}/><RaffleAdmin/></>} 
    </main>
    <Nav tab={tab} setTab={setTab} admin={data.is_admin}/>
    {toast&&<div className="toast">{toast}</div>}
  </div>
}
export default App;
