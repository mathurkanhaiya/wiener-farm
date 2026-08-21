import type {Snapshot,Tab} from './lib';
import {money} from './lib';
import {AnimatedIcon,type IconName} from './icons';

export function Splash({text}:{text:string}){return <div className="center-screen"><div className="coin big">W</div><h1>WIENER</h1><p>{text}</p><div className="loader"/></div>}
export function OpenTelegram(){return <div className="center-screen"><div className="brand-star"><AnimatedIcon name="logo" size={36} active/></div><h1>WIENER</h1><p>This Mini App uses signed Telegram authentication. Open it from <b>@WienerDogeFarmBot</b>.</p><a className="primary linkbtn" href="https://t.me/WienerDogeFarmBot">OPEN WIENER</a></div>}
export function StateScreen({icon,title,text}:{icon:string;title:string;text:string}){return <div className="center-screen"><div className="state-icon">{icon}</div><h2>{title}</h2><p>{text}</p></div>}
export function Brand({data}:{data:Snapshot}){return <header className="brand"><div className="brand-star"><AnimatedIcon name="logo" size={40} active/></div><div className="brand-copy"><b>WIENER</b><span>Earn WIENER Daily</span></div><div className="balance-pill"><span className="mini-coin">W</span>{money(data.user.balance)}</div><div className="avatar">{data.user.photo_url?<img src={data.user.photo_url}/>:String(data.user.first_name||'W')[0]}</div></header>}
export function Nav({tab,setTab,admin}:{tab:Tab;setTab:(t:Tab)=>void;admin:boolean}){
  const list:[Tab,string,IconName][]=[['home','Home','home'],['ads','Ads','ads'],['tasks','Task','tasks'],['invite','Invite','invite'],['wallet','Wallet','wallet']];
  return <nav className="bottom-nav">{list.map(([k,l,icon])=><button key={k} className={tab===k?'active '+k:k} onClick={()=>setTab(k)}><AnimatedIcon name={icon} active={tab===k}/><span>{l}</span></button>)}{admin&&<button className="admin-fab" aria-label="Open admin" onClick={()=>setTab('admin')}><AnimatedIcon name="gear" active={tab==='admin'}/></button>}</nav>
}
