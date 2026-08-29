import {useEffect,useRef,useState} from 'react';
import {api,getInitData,pageFromUrl,registerDevice,type Snapshot,type Tab} from './lib';
import {AdminHub} from './AdminHub';
import {AdminPromoCreator} from './AdminPromoCreator';
import {AdminMiniAppTaskCreator} from './AdminMiniAppTaskCreator';
import {EconomyUiPatch} from './EconomyUiPatch';
import {Ads} from './AdsPage';
import {Invite} from './InviteShare';
import {MandatoryGate,checkMandatoryAccess} from './MandatoryJoin';
import {ClaimPage,DailyPage} from './pages';
import {LeaderboardPageV2,ProfilePageV2} from './ProfileLeaderboardV2';
import {HomeWithPromo} from './PromoClaim';
import {Tasks} from './TasksPage';
import {WalletV2} from './WithdrawV2';
import {Brand,Nav,OpenTelegram,Splash,StateScreen} from './ui';
import {FarmClaimModal} from './FarmClaimModal';
import {TreasuryPage} from './Treasury';
import {useI18n} from './i18n';

function MultiAccountBlocked(){const {t}=useI18n(),support=()=>window.Telegram?.WebApp?.openTelegramLink?.('https://t.me/WienerSupport');return <div style={{minHeight:'100vh',display:'grid',placeItems:'center',padding:'24px',background:'radial-gradient(circle at 50% 42%,rgba(24,108,63,.28),transparent 36%),#002b18'}}><div style={{width:'min(100%,400px)',padding:'42px 28px',textAlign:'center',borderRadius:'36px',border:'1px solid rgba(255,255,255,.16)',background:'linear-gradient(145deg,rgba(255,255,255,.10),rgba(255,255,255,.045))',boxShadow:'inset 0 1px 0 rgba(255,255,255,.12),0 28px 70px rgba(0,0,0,.28)',backdropFilter:'blur(26px)',WebkitBackdropFilter:'blur(26px)'}}><div style={{fontSize:'70px',lineHeight:1}}>🚫</div><h1 style={{margin:'26px 0 8px',fontSize:'30px',letterSpacing:'-.7px'}}>{t('system.blocked')}</h1><p style={{margin:'0 auto',maxWidth:'290px',fontSize:'15px',lineHeight:1.55,opacity:.62}}>Multiple accounts detected on this device.<br/>Only one WIENER Farm account is allowed per device.</p><p style={{margin:'22px 0 14px',fontSize:'12px',opacity:.55}}>Think this is a mistake?</p><button onClick={support} style={{width:'100%',height:'58px',border:0,borderRadius:'18px',background:'linear-gradient(180deg,#fff05d,#ffd20b 64%,#eeb900)',color:'#211b00',fontSize:'14px',fontWeight:950}}>{t('system.contactSupport')}</button></div></div>}
function App(){
 const {t}=useI18n();
 const [tab,setTab]=useState<Tab>(()=>pageFromUrl()),[data,setData]=useState<Snapshot|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[toast,setToast]=useState(''),[mandatory,setMandatory]=useState<any>(null),[multiBlocked,setMultiBlocked]=useState(false),[farmClaimOpen,setFarmClaimOpen]=useState(false);const openedSent=useRef(false),openAdShown=useRef(false);
 const refresh=async()=>{try{setError('');const d=await api('bootstrap');setData(d);return d}catch(e:any){setError(e.message);return null}};
 useEffect(()=>{const tg=window.Telegram?.WebApp;tg?.ready?.();tg?.expand?.();(async()=>{const d=await refresh();if(d){if(!d.is_admin){try{const device:any=await registerDevice();setMultiBlocked(device?.blocked===true)}catch(e:any){const m=String(e?.message||'');if(/multiple|same_or_reused_device|device.*linked|device.*account/i.test(m))setMultiBlocked(true)}}else setMultiBlocked(false);if(!d.is_admin){try{setMandatory(await checkMandatoryAccess())}catch{setMandatory({all_joined:true,items:[]})}}else setMandatory({all_joined:true,items:[]})}setLoading(false)})()},[]);
 useEffect(()=>{if(data&&!openedSent.current){openedSent.current=true;api('app_opened').catch(()=>{})}},[data]);
 useEffect(()=>{if(loading||!data||multiBlocked||error||!mandatory?.all_joined||openAdShown.current)return;let cancelled=false;const timer=window.setTimeout(async()=>{if(cancelled||openAdShown.current)return;try{let tries=0;while(!window.Adsgram?.init&&tries<10&&!cancelled){await new Promise(r=>setTimeout(r,200));tries++}if(cancelled||!window.Adsgram?.init)return;const controller=window.Adsgram.init({blockId:'int-44861'});if(!controller)return;openAdShown.current=true;await controller.show()}catch(e){console.warn('opening_interstitial_failed',e)}},2000);return()=>{cancelled=true;window.clearTimeout(timer)}},[loading,multiBlocked,error,mandatory?.all_joined]);
 const say=(s:string)=>{setToast(s);setTimeout(()=>setToast(''),2200)};
 const run=async(action:string,b:any={},ok=t('common.done'))=>{try{await api(action,b);say(ok);await refresh()}catch(e:any){say(e.message)}};
 const runFarm=async(action:string,b:any={},ok=t('common.done'))=>{if(action!=='farm_claim')return run(action,b,ok);if(!data)return;setFarmClaimOpen(true)};
 if(loading)return <Splash text="Securing WIENER…"/>;if(!getInitData())return <OpenTelegram/>;if(multiBlocked)return <MultiAccountBlocked/>;if(error.includes('banned'))return <StateScreen icon="⛔" title={t('system.restricted')} text="Your WIENER account is currently unavailable."/>;if(error&&!data)return <StateScreen icon="⚠" title={t('system.unable')} text={error}/>;if(data?.settings?.maintenance_enabled&&!data.is_admin)return <StateScreen icon="🛠" title={t('system.maintenance')} text={data.settings.maintenance_message}/>;if(!data)return null;if(!data.is_admin&&mandatory&&!mandatory.all_joined)return <MandatoryGate initial={mandatory} onUnlocked={()=>setMandatory((x:any)=>({...x,all_joined:true}))}/>;
 return <div className="app-shell"><EconomyUiPatch/><Brand data={data}/><main className="content">{tab==='home'&&<HomeWithPromo data={data} run={runFarm} setTab={setTab} refresh={refresh} say={say}/>} {tab==='ads'&&<Ads data={data} refresh={refresh} say={say}/>} {tab==='tasks'&&<Tasks data={data} run={run} say={say} refresh={refresh}/>} {tab==='invite'&&<Invite data={data} say={say}/>} {tab==='wallet'&&<WalletV2 data={data} setTab={setTab}/>} {tab==='daily'&&<DailyPage data={data} run={run}/>} {tab==='claim'&&<ClaimPage data={data} run={runFarm}/>} {tab==='leaderboard'&&<LeaderboardPageV2 data={data}/>} {tab==='profile'&&<ProfilePageV2 data={data} setTab={setTab}/>} {tab==='treasury'&&<TreasuryPage data={data} refresh={refresh} say={say} setTab={setTab}/>} {tab==='admin'&&data.is_admin&&<><AdminHub say={say}/><AdminMiniAppTaskCreator say={say}/><AdminPromoCreator say={say}/></>}</main><Nav tab={tab} setTab={setTab} admin={data.is_admin}/><FarmClaimModal open={farmClaimOpen} data={data} onClose={()=>setFarmClaimOpen(false)} refresh={refresh} say={say}/>{toast&&<div className="toast">{toast}</div>}</div>
}
export default App;
