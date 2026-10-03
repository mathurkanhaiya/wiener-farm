import {useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {Snapshot,Tab} from './lib';import {money,feedback} from './lib';import {AnimatedIcon,type IconName} from './icons';import {LANGUAGES,useI18n,type LangCode} from './i18n';
import './nav-six.css';
import './styles-language.css';
import './maintenance.css';

const WIENER_LOGO='https://pixlinkhost.vercel.app/i/uRiwapMRiQ';function WienerLogo({size=42}:{size?:number}){return <img src={WIENER_LOGO} alt="WIENER Farm" loading="eager" decoding="sync" fetchPriority="high" style={{width:size,height:size,objectFit:'cover',display:'block',borderRadius:'50%'}}/>}
export {Splash} from './Splash';
export function OpenTelegram(){const{t}=useI18n();return <div className="center-screen"><WienerLogo size={108}/><h1>WIENER</h1><p>This Mini App uses signed Telegram authentication. Open it from <b>@WienerDogeFarmBot</b>.</p><a className="primary linkbtn" href="https://t.me/WienerDogeFarmBot">{t('system.openTelegram')}</a></div>}
export function StateScreen({icon,title,text}:{icon:string;title:string;text:string}){return <div className="center-screen"><div className="state-icon">{icon}</div><h2>{title}</h2><p>{text}</p></div>}
export function MaintenanceScreen({message}:{message?:string}){
  const notice=message?.trim()||'We’re making a few upgrades to Wiener Farm. The farm will be back shortly with a smoother and better experience.';
  const openChannel=()=>{try{const tg=(window as any).Telegram?.WebApp;if(tg?.openTelegramLink)tg.openTelegramLink('https://t.me/WienerFarm');else window.open('https://t.me/WienerFarm','_blank','noopener,noreferrer')}catch{}};
  return <main className="maintenance-screen" role="main">
    <div className="maintenance-glow maintenance-glow-a"/>
    <div className="maintenance-glow maintenance-glow-b"/>
    <section className="maintenance-card">
      <div className="maintenance-art" aria-hidden="true">
        <div className="maintenance-code code-a">{'{ }'}</div>
        <div className="maintenance-code code-b">&lt;/&gt;</div>
        <div className="maintenance-monitor"><span/><span/><span/></div>
        <div className="maintenance-developer"><span className="maintenance-head">👨‍💻</span><span className="maintenance-body">▰</span></div>
        <div className="maintenance-desk"/>
      </div>
      <div className="maintenance-badge"><span className="maintenance-dot"/> MAINTENANCE</div>
      <h1>We’ll be back soon</h1>
      <p className="maintenance-message">{notice}</p>
      <div className="maintenance-note"><span>⚡</span><span>We’re working behind the scenes to keep your farm running smoothly.</span></div>
      <button className="maintenance-channel" type="button" onClick={openChannel}>
        <span className="maintenance-bell" aria-hidden="true">🔔</span>
        <span><b>Get updates</b><small>Join Wiener Farm Channel</small></span>
        <span className="maintenance-arrow">›</span>
      </button>
      <small className="maintenance-footer">Thanks for your patience · Wiener Farm</small>
    </section>
  </main>
}
export function LanguagePicker(){
  const {language,lang,setLang,t}=useI18n(),[open,setOpen]=useState(false),[q,setQ]=useState('');
  const filtered=useMemo(()=>{const s=q.trim().toLowerCase();return s?LANGUAGES.filter(x=>`${x.name} ${x.native} ${x.code}`.toLowerCase().includes(s)):LANGUAGES},[q]);
  const dialogRef=useRef<HTMLElement>(null),triggerRef=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    if(!open)return;
    const dialog=dialogRef.current;
    const previousOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    dialog?.querySelector<HTMLInputElement>('input')?.focus();
    const onKey=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();setOpen(false);return}
      if(event.key!=='Tab'||!dialog)return;
      const elements=Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),[tabindex="0"]'));
      const first=elements[0],last=elements[elements.length-1];
      if(!first){event.preventDefault();dialog.focus();return}
      if(event.shiftKey&&(document.activeElement===first||!dialog.contains(document.activeElement))){event.preventDefault();last.focus()}
      else if(!event.shiftKey&&(document.activeElement===last||!dialog.contains(document.activeElement))){event.preventDefault();first.focus()}
    };
    document.addEventListener('keydown',onKey);
    return()=>{document.removeEventListener('keydown',onKey);document.body.style.overflow=previousOverflow;triggerRef.current?.focus()};
  },[open]);
  const choose=(code:LangCode)=>{setLang(code);setOpen(false);setQ('')};
  return <>
    <button ref={triggerRef} aria-haspopup="dialog" aria-expanded={open} className="language-trigger" aria-label={t('language.title')} onClick={()=>setOpen(true)}>
      <span>🌐</span><small>{language.code.toUpperCase()}</small>
    </button>
    {open && createPortal(<div className="language-backdrop" onClick={()=>setOpen(false)}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="language-picker-title" tabIndex={-1} className="language-sheet" data-no-i18n="true" onClick={e=>e.stopPropagation()}>
        <div className="language-grabber"/>
        <div className="language-head">
          <h3 id="language-picker-title">{t('language.choose','Choose language')}</h3>
          <button aria-label="Close language picker" onClick={()=>setOpen(false)}>×</button>
        </div>
        <div className="language-search">
          <span>🔍</span>
          <input aria-label={t('language.search','Search language')} value={q} onChange={e=>setQ(e.target.value)} placeholder={t('language.search','Search language')}/>
        </div>
        <div className="language-list">
          {filtered.map(x=><button key={x.code} className={x.code===lang?'active':''} onClick={()=>choose(x.code)}>
            <span>{x.flag}</span>
            <div><b>{x.native}</b><small>{x.name}</small></div>
            {x.code===lang && <em style={{marginLeft:'auto',fontStyle:'normal',color:'#ffe44a',fontWeight:900}}>✓</em>}
          </button>)}
        </div>
      </section>
    </div>, document.body)}
  </>;
}
export function Brand({data}:{data:Snapshot}){ return null; }
export function Nav({tab,setTab,admin}:{tab:Tab;setTab:(t:Tab)=>void;admin:boolean}){
  const{t}=useI18n();
  const items:[Tab,string,IconName][]=[['home',t('nav.home','Home'),'home'],['ads','Earn','bolt'],['tasks',t('nav.tasks','Tasks'),'tasks'],['invite',t('nav.invite','Invite'),'invite'],['profile','Me','wallet']];
  const item=([k,l,icon]:[Tab,string,IconName])=><button key={k} className={tab===k?'active '+k:k} onClick={()=>{feedback('tap');setTab(k)}}><span className={k==='profile'?'me-nav-icon':''}>{k==='profile'?<img src="https://pixlinkhost.vercel.app/i/Ay2hCTiswA" alt="" aria-hidden="true"/>:<AnimatedIcon name={icon} active={tab===k}/>}</span><span>{l}</span></button>;
  return <nav className="bottom-nav game-nav">{items.map(item)}{admin&&<button className="admin-fab" aria-label="Open admin" onClick={()=>{feedback('tap');setTab('admin')}}><AnimatedIcon name="gear" active={tab==='admin'}/></button>}</nav>;
}


