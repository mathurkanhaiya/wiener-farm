import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';

type Toast={id:number,text:string,kind:'win'|'ton'|'spin'|'info'};

const isSpinUrl=(input:RequestInfo|URL)=>{
  try{
    const u=typeof input==='string'?input:input instanceof URL?input.toString():input.url;
    return typeof u==='string'&&u.includes('/functions/v1/wiener-spin');
  }catch{return false}
};

const readAction=(init?:RequestInit)=>{
  try{
    if(!init?.body||typeof init.body!=='string')return '';
    return String(JSON.parse(init.body)?.action||'');
  }catch{return ''}
};

const unwrap=(x:any)=>x?.data??x;

export function SpinNotificationLayer(){
  const [toast,setToast]=useState<Toast|null>(null);
  const seq=useRef(0),timer=useRef<number|undefined>(undefined);

  useEffect(()=>{
    let cleanupFetch:(()=>void)|null=null;
    const show=(text:string,kind:Toast['kind'])=>{
      window.clearTimeout(timer.current);
      setToast({id:++seq.current,text,kind});
      timer.current=window.setTimeout(()=>setToast(null),3200);
    };

    const handleCustomNotify=(e:Event)=>{
      const detail=(e as CustomEvent)?.detail;
      if(detail?.text)show(String(detail.text),detail.kind||'info');
    };
    window.addEventListener('wiener-spin-notify',handleCustomNotify as EventListener);

    try{
      const descriptor=Object.getOwnPropertyDescriptor(window,'fetch')||Object.getOwnPropertyDescriptor(Object.getPrototypeOf(window),'fetch');
      if(descriptor&&descriptor.writable===false&&!descriptor.set){
        // window.fetch is readonly in this environment (e.g. strict Telegram webview/Safari)
      }else{
        const original=window.fetch;
        if(typeof original==='function'){
          const wrappedFetch=async(input:RequestInfo|URL,init?:RequestInit)=>{
            const action=isSpinUrl(input)?readAction(init):'';
            const res=await original.call(window,input,init);
            if(action&&res.ok){
              try{
                const body=unwrap(await res.clone().json());
                if(action==='spin'&&body){
                  const type=String(body.type||'');
                  const amount=Number(body.amount||0);
                  if(type==='ton'&&amount>=0.005)show(`🔥 JACKPOT! You won ${amount} TON`,'ton');
                  else if(type==='ton')show(`💎 You won ${amount} TON`,'ton');
                  else if(type==='spin')show(`🎁 +${amount} bonus ${amount===1?'spin':'spins'} won`,'spin');
                  else if(type==='wiener')show(`🎉 You won ${amount} WIENER`,'win');
                }else if(action==='ad_complete')show('✅ +1 Spin added','spin');
                else if(action==='withdraw'){
                  const amount=Number(body?.amount_ton||body?.amount||0);
                  show(amount>0?`⏳ ${amount} TON withdrawal requested`:'⏳ Spin TON withdrawal requested','info');
                }
              }catch{/* notification parsing must never affect the app request */}
            }
            return res;
          };

          try{
            window.fetch=wrappedFetch;
            cleanupFetch=()=>{try{window.fetch=original}catch{}};
          }catch{
            // If direct assignment throws readonly error, attempt defineProperty safely
            try{
              Object.defineProperty(window,'fetch',{value:wrappedFetch,configurable:true,writable:true});
              cleanupFetch=()=>{try{Object.defineProperty(window,'fetch',{value:original,configurable:true,writable:true})}catch{}};
            }catch{/* read-only fetch environment */}
          }
        }
      }
    }catch{/* ignore fetch hook failures */}

    return()=>{
      if(cleanupFetch)cleanupFetch();
      window.removeEventListener('wiener-spin-notify',handleCustomNotify as EventListener);
      window.clearTimeout(timer.current);
    };
  },[]);

  if(!toast)return null;
  return createPortal(<div className={`spin-global-toast ${toast.kind}`} key={toast.id} role="status" aria-live="polite"><span>{toast.text}</span></div>,document.body);
}
