export const WIENER_PER_USDT=25000;
export const AD_PROVIDERS={
  adsgram:{key:'adsgram',label:'AdsGram',reward:50,limit:15,maxDaily:750},
  monetag:{key:'monetag',label:'Monetag',reward:30,limit:10,maxDaily:300},
  adexium:{key:'adexium',label:'Adexium',reward:50,limit:5,maxDaily:250},
} as const;
export const WITHDRAWAL_MIN_USDT=0.03;
export const WITHDRAWAL_FEE_USDT=0.01;
export const REFERRAL_REWARDS={join:125,active:250,total:375} as const;
export const REFERRAL_USD={join:0.005,active:0.01,total:0.015} as const;
export type AdProvider=keyof typeof AD_PROVIDERS;
export const providerConfig=(settings:any,provider:AdProvider)=>{
 const base=AD_PROVIDERS[provider],s=settings||{};
 return {...base,reward:Number(s[`${provider}_ad_reward`]||base.reward),limit:Number(s[`${provider}_daily_limit`]||base.limit),blockId:String(s[`${provider}_block_id`]||s[`${provider}_zone_id`]||''),sdkUrl:String(s[`${provider}_sdk_url`]||'')};
};
