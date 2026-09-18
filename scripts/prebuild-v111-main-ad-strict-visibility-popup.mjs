import fs from 'node:fs';
const p='src/AdsPage.tsx';
let s=fs.readFileSync(p,'utf8');

// Strict visibility only: AdsGram/modal focus blur must NEVER qualify full reward.
s=s.replace("trackAdInteraction({allowBlur:true,minBlurMs:3000})","trackAdInteraction({allowBlur:false,minBlurMs:3000})");

// Clear, compact popup. Dynamic full reward comes from the server/admin reward snapshot.
const old=`{result&&<div className="ad-result-backdrop"><div className={\`ad-result-card \${result.source==='main'&&result.bonus_unlocked?'bonus':''}\`}><div className="ad-result-badge">{result.source==='main'&&result.bonus_unlocked?'⚡':'🪙'}</div><small>{result.source==='main'&&result.bonus_unlocked?'FULL REWARD UNLOCKED':'AD COMPLETED'}</small><div className="ad-result-earned">+{result.reward} WIENER</div>{result.source==='main'&&result.bonus_unlocked&&<div className="ad-reward-breakdown"><span>✓ Ad successfully completed</span><span>✓ 3-second advertiser visit detected</span><span>⚡ Full reward <b>+{result.full_reward} WIENER</b></span></div>}{result.source==='main'&&!result.bonus_unlocked&&<div className="ad-unlock-guide"><b>Unlock full +{result.full_reward} WIENER next time</b><span>Open the advertiser from the ad and stay outside WIENER Farm for at least 3 seconds.</span><small>Potential bonus missed: +{Math.max(0,result.full_reward-result.reward)} WIENER</small></div>}{result.source!=='main'&&<h3>Reward credited successfully.</h3>}<button className="primary" type="button" onClick={()=>setResult(null)}>WATCH NEXT / CLOSE</button></div></div>}`;
const next=`{result&&<AdRewardPopup reward={result.reward} fullReward={result.source==='main'?result.full_reward:result.reward} onClose={()=>setResult(null)}/>} ` .trim();

if(!s.includes(old)) throw new Error('V111 result popup anchor not found');
s=s.replace(old,next);

// V101 callback retries must preserve the same visibility evidence on every attempt.
if(!s.includes("import {AdRewardPopup}"))s="import {AdRewardPopup} from './AdRewardPopup';\n"+s;
const mainStart=s.indexOf("if(src==='main'){",s.indexOf('const watch='));
const mainEnd=s.indexOf("}else{const x=await secondaryAdApi('start')",mainStart);
if(mainStart<0||mainEnd<0)throw Error('Main ad flow not found');
let main=s.slice(mainStart,mainEnd);
if(!main.includes('tracker.start();'))main=main.replace('const shown=await c.show();','tracker.start();const shown=await c.show();');
if(!main.includes('const visitMs=tracker.interactionMs();'))main=main.replace('let st:any=null,lastErr:any=null;', 'const visitMs=tracker.interactionMs();const visibilityQualified=visitMs>=3000;let st:any=null,lastErr:any=null;');
main=main.replace("adApi('complete',{session_id:x.session_id} as any)","adApi('complete',{session_id:x.session_id,interacted:visibilityQualified,interaction_ms:visitMs} as any)");
if(!main.includes('tracker.start();')||!main.includes('interaction_ms:visitMs')||!main.includes('visitMs>=3000'))throw Error('Main ad visibility tracking incomplete');
s=s.slice(0,mainStart)+main+s.slice(mainEnd);
s=s.replace(/<p>Complete the ad to earn WIENER\.[^<]*<\/p>/g,'<p>Your ad is opening…</p>');
fs.writeFileSync(p,s);
console.log('Clean ad result and 3-second visibility telemetry applied');
