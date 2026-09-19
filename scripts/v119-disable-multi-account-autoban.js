const fs=require('fs');
const p='/opt/wiener-backend/server.mjs';
let s=fs.readFileSync(p,'utf8');
const old="if(u.device_blocked===true||u.referral_reward_eligible===false&&/(same.?device|multi|device)/.test(badReason)){await refBanV98(id,'multi_account_referral');return{banned:true,reason:'multi_account_referral'}}";
const neu="if(u.device_blocked===true||u.referral_reward_eligible===false&&/(same.?device|multi|device)/.test(badReason)){return{banned:false,reason:'multi_account_signal_ignored'}}";
if(!s.includes(old)) throw new Error('V119 target not found; refusing patch');
s=s.replace(old,neu);
fs.writeFileSync(p,s);
