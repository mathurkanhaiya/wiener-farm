import fs from 'node:fs';
const p='src/AdsPage.tsx';
let s=fs.readFileSync(p,'utf8');

// V111 replaces the V109/V110 result presentation with one compact proof card.
const old=/\{result&&<div className="ad-result-backdrop">[\s\S]*?<\/button><\/div><\/div>\}/;
const popup=`{result&&<div className="ad-result-backdrop"><div className={\`ad-result-card v111-proof \${result.source==='main'&&result.bonus_unlocked?'full':''}\`}><div className="v111-proof-icon">{result.source==='main'&&result.bonus_unlocked?'⚡':'✓'}</div><small>{result.source==='main'?(result.bonus_unlocked?'FULL REWARD':'AD COMPLETED'):'REWARD RECEIVED'}</small><div className="ad-result-earned">+{result.reward} WIENER</div>{result.source==='main'&&result.bonus_unlocked?<div className="v111-proof-box"><b>Full reward unlocked</b><span>✓ Successful ad callback</span><span>✓ 3+ sec visibility detected</span></div>:result.source==='main'?<div className="v111-proof-box"><b>Unlock full +{result.full_reward} next ad</b><span>Open the advertiser and stay outside WIENER Farm for at least 3 seconds.</span><strong>+{Math.max(0,result.full_reward-result.reward)} WIENER more available</strong></div>:<div className="v111-proof-box"><b>Reward credited successfully</b></div>}<button className="primary v111-proof-btn" type="button" onClick={()=>setResult(null)}>WATCH NEXT AD</button></div></div>}`;
if(!old.test(s)) throw new Error('V111 popup anchor missing; refusing partial UI patch');
s=s.replace(old,popup);

s=s.replace('</style><div className="page-title">',`.v111-proof{width:min(86vw,360px)!important;padding:22px 18px 18px!important;border-radius:24px!important;text-align:center!important;overflow:hidden}.v111-proof-icon{width:52px;height:52px;margin:0 auto 12px;display:grid;place-items:center;border-radius:50%;font-size:25px;font-weight:950;background:rgba(255,180,0,.14);border:1px solid rgba(255,190,40,.24)}.v111-proof .ad-result-earned{font-size:38px!important;line-height:1!important;margin:10px 0 16px!important;white-space:nowrap}.v111-proof-box{display:grid;gap:7px;text-align:left;padding:13px 14px;margin:0 0 15px;border-radius:16px;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.08);font-size:12px;line-height:1.35}.v111-proof-box b{font-size:14px}.v111-proof-box span{opacity:.78}.v111-proof-box strong{font-size:12px}.v111-proof-btn{width:100%!important;margin:0!important}</style><div className="page-title">`);
fs.writeFileSync(p,s);
console.log('V111 proof popup applied');
