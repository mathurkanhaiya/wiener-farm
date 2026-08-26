import type {Snapshot,Tab} from './lib';
import {money} from './lib';
import {AnimatedIcon,type IconName} from './icons';

const WIENER_LOGO='https://pixlinkhost.vercel.app/i/uRiwapMRiQ';
function WienerLogo({size=42}:{size?:number}){return <img src={WIENER_LOGO} alt="WIENER Farm" style={{width:size,height:size,objectFit:'contain',display:'block'}}/>}

export function Splash({text}:{text:string}){return <div className="center-screen liquid-splash"><div className="splash-orb"><div className="splash-logo"><WienerLogo size={68}/></div><span className="splash-ring ring-one"/><span className="splash-ring ring-two"/></div><div className="splash-copy"><span>WIENER</span><h1>Loading your rewards</h1><p>{text}</p></div><div className="liquid-loader"><i/><i/><i/></div><small className="splash-secure">Secure Telegram session</small></div>}
export function OpenTelegram(){return <div className="center-screen"><div className="brand-star"><WienerLogo size={44}/></div><h1>WIENER</h1><p>This Mini App uses signed Telegram authentication. Open it from <b>@WienerDogeFarmBot</b>.</p><a className="primary linkbtn" href="https://t.me/WienerDogeFarmBot">OPEN WIENER</a></div>}
export function StateScreen({icon,title,text}:{icon:string;title:string;text:string}){return <div className="center-screen"><div className="state-icon">{icon}</div><h2>{title}</h2><p>{text}</p></div>}
export function Brand({data}:{data:Snapshot}){return <header className="brand"><div className="brand-star"><WienerLogo size={38}/></div><div className="brand-copy"><b>WIENER</b><span>Earn · Invite · Reward</span></div><div className="balance-pill"><span className="mini-coin">W</span>{money(data.user.balance)}</div><div className="avatar">{data.user.photo_url?<img src={data.user.photo_url}/>:String(data.user.first_name||'W')[0]}</div></header>}
export function Nav({tab,setTab,admin}:{tab:Tab;setTab:(t:Tab)=>void;admin:boolean}){
  const list:[Tab,string,IconName][]=[['home','Home','home'],['ads','Ads','ads'],['tasks','Tasks','tasks'],['invite','Invite','invite'],['wallet','Wallet','wallet']];
  return <nav className="bottom-nav">{list.map(([k,l,icon])=><button key={k} className={tab===k?'active '+k:k} onClick={()=>setTab(k)}><AnimatedIcon name={icon} active={tab===k}/><span>{l}</span></button>)}{admin&&<button className="admin-fab" aria-label="Open admin" onClick={()=>setTab('admin')}><AnimatedIcon name="gear" active={tab==='admin'}/></button>}</nav>
}
