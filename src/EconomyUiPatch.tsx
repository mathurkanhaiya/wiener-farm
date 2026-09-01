import {useEffect} from 'react';

export function EconomyUiPatch(){
  useEffect(()=>{
    const sync=()=>{
      document.querySelectorAll('.amb-info-grid').forEach((grid)=>{
        const cards=grid.querySelectorAll(':scope > div');
        if(cards[1])cards[1].innerHTML='<b>1</b><span>code/drop</span>';
        if(cards[2])cards[2].innerHTML='<b>10</b><span>WIENER/code</span>';
        if(cards[3])cards[3].innerHTML='<b>24h</b><span>auto expiry</span>';
      });
      document.querySelectorAll('.amb-info .tiny.center').forEach((el)=>{
        el.textContent='Each successful code claim counts separately for Ambassador commission and leaderboard.';
      });
      document.querySelectorAll('.amb-message-preview').forEach((el)=>{
        el.innerHTML='<b>👤 First 100 Active Users Only!</b><br/>🎁 Reward: 10 WIENER per code<br/><br/>🎟 Claim Code: <strong>UNIQUE_CODE</strong><br/><br/>⏳ Expires in 24 hours<br/>🔥 Redeem your code and claim your FREE WIENER before all rewards are claimed!';
      });
      document.querySelectorAll('.amb-publisher .tiny').forEach((el)=>{
        if(el.textContent?.includes('Code 1')||el.textContent?.includes('Code 2'))el.textContent='Every approved channel receives one unique code per post. Ambassadors cannot generate codes themselves.';
      });
    };
    sync();
    const obs=new MutationObserver(sync);
    obs.observe(document.body,{childList:true,subtree:true});
    return()=>obs.disconnect();
  },[]);
  return <style>{`.treasury-home-badge{font-size:0!important}.treasury-home-badge::after{content:'UP TO 375';font-size:9px!important}.treasury-tap span{font-size:0!important}.treasury-tap span::after{content:'Rewards up to 375 WIENER';font-size:11px!important}`}</style>;
}
