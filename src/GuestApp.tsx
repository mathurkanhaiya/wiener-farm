import {lazy,Suspense,useState} from 'react';
const GamesPage=lazy(()=>import('./GamesPage').then(m=>({default:m.GamesPage})));

type GuestTab='games'|'home'|'earn'|'tasks'|'profile';

const BOT_URL='https://t.me/WienerDogeFarmBot/app';

export default function GuestApp(){
  const [tab,setTab]=useState<GuestTab>('home');
  const openTelegram=()=>{ window.location.href=BOT_URL };
  const locked=(label:string)=>alert(`${label} requires a Wiener Farm account. Open Wiener Farm in Telegram to continue.`);
  return <div className="app-shell guest-app">
    <header style={{padding:'18px 18px 8px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
      <div><div style={{fontSize:11,fontWeight:900,letterSpacing:1.5,opacity:.55}}>WIENER FARM</div><div style={{fontSize:22,fontWeight:950}}>Guest User</div></div>
      <button className="secondary" style={{width:'auto',padding:'10px 14px'}} onClick={openTelegram}>OPEN TELEGRAM</button>
    </header>
    <main className="content" style={{paddingBottom:100}}>
      {tab==='home'&&<>
        <section className="card" style={{textAlign:'center',padding:'28px 20px'}}><div style={{fontSize:48}}>🌭</div><h1 style={{margin:'8px 0 5px'}}>Welcome to Wiener Farm</h1><p style={{margin:0,opacity:.62,lineHeight:1.5}}>You’re browsing as a Guest User. Explore Wiener Farm normally; connect through Telegram when you want to earn or use account features.</p></section>
        <section className="card"><div className="eyebrow">GUEST MODE</div><h3 style={{margin:'5px 0 8px'}}>Explore Wiener Farm</h3><p style={{margin:'0 0 14px',opacity:.62,fontSize:13,lineHeight:1.5}}>Games and public content can be used without Telegram. Balance, farming, rewards, referrals and withdrawals stay protected.</p><button className="primary" onClick={openTelegram}>OPEN IN TELEGRAM TO EARN</button></section>
        <div className="quick-grid"><button className="card" onClick={()=>setTab('earn')}>💰<br/><b>Earn</b></button><button className="card" onClick={()=>setTab('tasks')}>✅<br/><b>Tasks</b></button><button className="card" onClick={()=>setTab('profile')}>👤<br/><b>Profile</b></button></div>
      </>}
      {tab==='games'&&<Suspense fallback={<p role="status">Loading games…</p>}><GamesPage/></Suspense>}
      {tab==='earn'&&<section className="card"><div style={{fontSize:38}}>💰</div><h2>Earn WIENER</h2><p style={{opacity:.65}}>Earning requires a verified Telegram account so rewards are credited securely.</p><button className="primary" onClick={()=>locked('Earning')}>START EARNING</button></section>}
      {tab==='tasks'&&<section className="card"><div style={{fontSize:38}}>✅</div><h2>Tasks</h2><p style={{opacity:.65}}>Task rewards are available after opening Wiener Farm through Telegram.</p><button className="primary" onClick={()=>locked('Tasks')}>OPEN TASKS</button></section>}
      {tab==='profile'&&<section className="card"><div style={{fontSize:48}}>👤</div><h2>Guest User</h2><p style={{opacity:.65}}>No Telegram account is connected. Guest browsing does not create a balance or withdrawal account.</p><button className="primary" onClick={openTelegram}>CONNECT WITH TELEGRAM</button></section>}
    </main>
    <nav style={{position:'fixed',left:12,right:12,bottom:12,zIndex:50,display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:6,padding:7,borderRadius:22,background:'rgba(10,20,16,.88)',border:'1px solid rgba(255,255,255,.1)',backdropFilter:'blur(20px)'}}>
      {([['home','🏠','Home'],['games','🎮','Games'],['earn','💰','Earn'],['tasks','✅','Tasks'],['profile','👤','Profile']] as const).map(([id,icon,label])=><button key={id} onClick={()=>setTab(id)} style={{border:0,borderRadius:15,padding:'9px 4px',background:tab===id?'rgba(255,255,255,.1)':'transparent',color:'inherit',fontWeight:800}}><span style={{display:'block',fontSize:18}}>{icon}</span><span style={{fontSize:10}}>{label}</span></button>)}
    </nav>
  </div>
}
