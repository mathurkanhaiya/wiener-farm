import {useEffect,useMemo,useRef,type CSSProperties} from 'react';
import Lottie from 'lottie-react';
import {ungzip} from 'pako';
import {TG_TGS,type TgPackIcon} from './tgPack';
import {SELECTED_TGS,type SelectedPackIcon} from './selectedPack';

export type IconName='logo'|'home'|'ads'|'tasks'|'invite'|'wallet'|'gift'|'ticket'|'bolt'|'gear'|'download'|'check'|'share'|'coins'|'arrowUp'|'arrowDown';

const selectedPackMap:Partial<Record<IconName,SelectedPackIcon>>={
  home:'home',
  ads:'ads',
  tasks:'tasks',
  invite:'invite',
  wallet:'wallet',
  gift:'reward'
};

const packMap:Partial<Record<IconName,TgPackIcon>>={
  logo:'star',
  bolt:'bolt',
  gear:'gear',
  download:'withdraw',
  check:'check',
  share:'share'
};

function decodeTgsBase64(value:string){
  const raw=atob(value);
  const bytes=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
  const text=ungzip(bytes,{to:'string'}) as string;
  return JSON.parse(text);
}

function TelegramLottie({data64,name,size,active,className}:{data64:string;name:IconName;size:number;active:boolean;className:string}){
  const ref=useRef<any>(null);
  const reduced=typeof window!=='undefined'&&window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const data=useMemo(()=>{try{return decodeTgsBase64(data64)}catch{return null}},[data64]);
  useEffect(()=>{
    if(!ref.current||!data)return;
    if(active&&!reduced)ref.current.goToAndPlay(0,true);
    else ref.current.goToAndStop(0,true);
  },[active,reduced,data]);
  if(!data)return <FallbackIcon name={name} size={size} active={active} className={className}/>;
  return <span className={`aicon aicon-${name} tg-lottie ${active?'is-active':''} ${className}`} style={{width:size,height:size}} aria-hidden="true">
    <Lottie lottieRef={ref} animationData={data} autoplay={active&&!reduced} loop={false} style={{width:'100%',height:'100%',display:'block'}}/>
  </span>
}

export function AnimatedIcon({name,size=24,active=false,className=''}:{name:IconName;size?:number;active?:boolean;className?:string}){
  const selected=selectedPackMap[name];
  if(selected)return <TelegramLottie data64={SELECTED_TGS[selected]} name={name} size={size} active={active} className={className}/>;
  const packName=packMap[name];
  if(packName)return <TelegramLottie data64={TG_TGS[packName]} name={name} size={size} active={active} className={className}/>;
  return <FallbackIcon name={name} size={size} active={active} className={className}/>;
}

function FallbackIcon({name,size,active,className}:{name:IconName;size:number;active:boolean;className:string}){
  const style={width:size,height:size} as CSSProperties;
  return <svg className={`aicon aicon-${name} ${active?'is-active':''} ${className}`} style={style} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <g className="aicon-motion">{shape(name)}</g>
  </svg>
}

function shape(name:IconName){
  const p={stroke:'currentColor',strokeWidth:1.8,strokeLinecap:'round' as const,strokeLinejoin:'round' as const};
  switch(name){
    case 'logo': return <><path {...p} d="M12 2.8 14.2 8l5.4.5-4.1 3.6 1.2 5.3L12 14.6 7.3 17.4l1.2-5.3-4.1-3.6L9.8 8 12 2.8Z"/><circle className="aicon-dot" cx="12" cy="11.5" r="2.2" fill="currentColor" opacity=".3"/></>;
    case 'home': return <><path {...p} d="m3.5 10.5 8.5-7 8.5 7"/><path {...p} d="M5.5 9.8V20h13V9.8"/><path className="aicon-pop" {...p} d="M9.5 20v-6h5v6"/></>;
    case 'ads': return <><circle {...p} cx="12" cy="12" r="8.5"/><path className="aicon-pop" d="m10 8.7 5.3 3.3-5.3 3.3V8.7Z" fill="currentColor"/></>;
    case 'tasks': return <><rect {...p} x="5" y="3.5" width="14" height="17" rx="2.5"/><path className="aicon-check" {...p} d="m8 9 1.4 1.4L12 7.8M13.7 9H16M8 15h8"/></>;
    case 'invite': return <><circle {...p} cx="9" cy="8" r="3"/><path {...p} d="M3.8 19c.5-4 2.5-6 5.2-6s4.7 2 5.2 6"/><path className="aicon-pop" {...p} d="M17 8v6M14 11h6"/></>;
    case 'wallet': return <><path {...p} d="M3.5 7.5h14a3 3 0 0 1 3 3v7a2.5 2.5 0 0 1-2.5 2.5H5.5A2.5 2.5 0 0 1 3 17.5v-12A2.5 2.5 0 0 1 5.5 3H17"/><path className="aicon-pop" {...p} d="M15.5 11h5v4h-5a2 2 0 1 1 0-4Z"/></>;
    case 'gift': return <><rect {...p} x="4" y="9" width="16" height="11" rx="2"/><path className="aicon-lid" {...p} d="M3.5 9h17V6.5h-17V9ZM12 6.5V20"/><path className="aicon-bow" {...p} d="M12 6.4c-3.4.1-5.4-.7-5.4-2.3 0-1.1.9-1.8 2-1.8 1.9 0 3.4 2.2 3.4 4.1Zm0 0c3.4.1 5.4-.7 5.4-2.3 0-1.1-.9-1.8-2-1.8-1.9 0-3.4 2.2-3.4 4.1Z"/></>;
    case 'ticket': return <><path {...p} d="M4 6h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4V6Z"/><path className="aicon-dash" {...p} d="M12 8v1.5M12 11.3v1.5M12 14.6V16"/></>;
    case 'bolt': return <path className="aicon-pop" {...p} d="m13.5 2.8-7 10h5l-1 8.4 7-11h-5l1-7.4Z"/>;
    case 'gear': return <><circle {...p} cx="12" cy="12" r="3"/><path {...p} d="M12 2.8v2M12 19.2v2M2.8 12h2M19.2 12h2M5.5 5.5l1.4 1.4M17.1 17.1l1.4 1.4M18.5 5.5l-1.4 1.4M6.9 17.1l-1.4 1.4"/><circle {...p} cx="12" cy="12" r="7"/></>;
    case 'download': return <><path {...p} d="M12 3v11"/><path className="aicon-pop" {...p} d="m8 10 4 4 4-4"/><path {...p} d="M5 20h14"/></>;
    case 'check': return <><circle {...p} cx="12" cy="12" r="8.5"/><path className="aicon-check" {...p} d="m8 12 2.4 2.5L16.5 8"/></>;
    case 'share': return <><path className="aicon-pop" {...p} d="m14 5 5 4-5 4"/><path {...p} d="M19 9h-6a8 8 0 0 0-8 8v2"/></>;
    case 'coins': return <><ellipse {...p} cx="9" cy="8" rx="5" ry="2.5"/><path {...p} d="M4 8v4c0 1.4 2.2 2.5 5 2.5.7 0 1.4-.1 2-.2M4 12v4c0 1.4 2.2 2.5 5 2.5 1.2 0 2.3-.2 3.1-.6"/><ellipse className="aicon-pop" {...p} cx="15" cy="14" rx="5" ry="2.5"/><path {...p} d="M10 14v4c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5v-4"/></>;
    case 'arrowUp': return <><path className="aicon-pop" {...p} d="M12 19V5M7.5 9.5 12 5l4.5 4.5"/></>;
    case 'arrowDown': return <><path className="aicon-pop" {...p} d="M12 5v14M7.5 14.5 12 19l4.5-4.5"/></>;
  }
}
