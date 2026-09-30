import {useEffect,useMemo,useState} from 'react';
type Kind='success'|'reward'|'referral'|'withdraw'|'error'|'warning'|'info'|'bonus';
function classify(message:string):{kind:Kind;icon:string;title:string}{
 const m=message.toLowerCase();
 if(m.includes('withdrawal')&&/(created|submitted|request)/.test(m))return{kind:'withdraw',icon:'💸',title:'Withdrawal submitted'};
 if(m.includes('withdrawal')&&/(paid|success|successful)/.test(m))return{kind:'success',icon:'✅',title:'Withdrawal successful'};
 if(m.includes('withdrawal')&&/(failed|reject|error)/.test(m))return{kind:'error',icon:'❌',title:'Withdrawal failed'};
 if(m.includes('wallet')&&m.includes('invalid'))return{kind:'warning',icon:'⚠️',title:'Invalid wallet/address'};
 if(m.includes('insufficient'))return{kind:'warning',icon:'⚠️',title:'Insufficient balance'};
 if(m.includes('daily ad limit'))return{kind:'info',icon:'ℹ️',title:'Daily ad limit reached'};
 if(m.includes('referral')&&/(active|became)/.test(m))return{kind:'referral',icon:'👥',title:'Referral became active'};
 if(m.includes('referral')||m.includes('invite'))return{kind:'reward',icon:'🎁',title:'Referral reward received'};
 if(m.includes('bonus')||m.includes('unlocked'))return{kind:'bonus',icon:'🎉',title:'Bonus unlocked'};
 if(m.includes('reward')||m.includes('ad completed')||m.includes('ad complete'))return{kind:'reward',icon:'💰',title:'Reward received'};
 if(m.startsWith('✅')||m.includes('success'))return{kind:'success',icon:'✅',title:'Completed'};
 if(m.includes('invalid')||m.includes('unable')||m.includes('failed')||m.includes('error'))return{kind:'error',icon:'❌',title:'Something went wrong'};
 return{kind:'info',icon:'ℹ️',title:'WIENER Farm'};
}
export function PremiumNotification({message}:{message:string}){
 const meta=useMemo(()=>classify(message),[message]);
 const [visible,setVisible]=useState(false);
 useEffect(()=>{const a=requestAnimationFrame(()=>setVisible(true));const t=window.setTimeout(()=>setVisible(false),2200);return()=>{cancelAnimationFrame(a);window.clearTimeout(t)}},[message]);
 return <div className={'wf-premium-notice wf-premium-'+meta.kind+(visible?' show':'')} role="status" aria-live="polite">
   <div className="wf-premium-icon">{meta.icon}</div><div className="wf-premium-copy"><b>{meta.title}</b><span>{message.replace(/^[✅❌⚠️ℹ️🎁🎉💰👥💸]\s*/,'')}</span></div>
 </div>;
}
