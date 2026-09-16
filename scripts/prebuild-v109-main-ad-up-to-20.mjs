import fs from 'node:fs';

const p='src/AdsPage.tsx';
let s=fs.readFileSync(p,'utf8');

// V109 runs after V102. Restore interaction telemetry for the MAIN AdsGram card only.
if(!s.includes("import {trackAdInteraction} from './adInteraction';")){
  s=s.replace("import {AnimatedIcon} from './icons';", "import {AnimatedIcon} from './icons';\nimport {trackAdInteraction} from './adInteraction';");
}

// V102 reduces Result to source/reward. Add fields used by the new result popup.
s=s.replace(
  "type Result={source:Source;reward:number};",
  "type Result={source:Source;reward:number;bonus_unlocked:boolean;interaction_detected:boolean;base_reward:number;bonus_reward:number};"
);
s=s.replace(
  "const finish=(src:Source,st:any)=>setResult({source:src,reward:Number(st?.reward||0)});",
  "const finish=(src:Source,st:any)=>{const total=Number(st?.reward||0),base=Number(st?.base_reward??st?.normal_reward??total),bonus=Math.max(0,Number(st?.bonus_reward??(total-base)));setResult({source:src,reward:total,bonus_unlocked:!!(st?.bonus_unlocked??st?.interaction_detected??bonus>0),interaction_detected:!!st?.interaction_detected,base_reward:base,bonus_reward:bonus})};"
);

// Restore tracker at 3 seconds. It is telemetry/eligibility signal, not a claim of an SDK CTA callback.
s=s.replace("const watch=async(src:Source)=>{if(busy)return;", "const watch=async(src:Source)=>{if(busy)return;");
s=s.replace("try{setBusy(src);setResult(null);if(src==='main'){", "const tracker=trackAdInteraction({allowBlur:true,minBlurMs:3000});try{setBusy(src);setResult(null);if(src==='main'){");
s=s.replace("const shown=await c.show();if(shown&&shown.done===false)throw Error(shown.description||'Ad was not completed');const st=await adApi('complete',{session_id:x.session_id});", "tracker.start();const shown=await c.show();if(shown&&shown.done===false)throw Error(shown.description||'Ad was not completed');const visitMs=tracker.interactionMs();const visibilityQualified=visitMs>=3000;const st=await adApi('complete',{session_id:x.session_id,interacted:visibilityQualified,interaction_ms:visitMs} as any);");
s=s.replace("}finally{setBusy(null)}};", "}finally{tracker.stop();setBusy(null)}};");

// Main card: fixed reward -> up-to-20 presentation. Bonus ad card remains unchanged.
s=s.replace(
  /<section className=\"card ad-card\"><div className=\"square play\"><AnimatedIcon name=\"ads\" active=\{!mainDisabled\}\/><\/div><div className=\"grow\"><h3>AdsGram — \{s\.daily_ad_limit\} ads<\/h3><p>\{Number\(s\.ad_reward\|\|5\)\} WIENER · \{used\}\/\{s\.daily_ad_limit\} today<\/p><\/div><button className=\"primary small\"/,
  '<section className="card ad-card main-ad-v109"><div className="square play"><AnimatedIcon name="ads" active={!mainDisabled}/></div><div className="grow"><h3>AdsGram Ad</h3><p><b>⚡ UP TO +20 WIENER</b> · {used}/{s.daily_ad_limit} today</p><small className="ad-up-to-note">Complete the ad to earn. Eligible advertiser engagement can unlock a higher reward.</small></div><button className="primary small"'
);

// Replace V102 result popup with V109 reward feedback. Secondary remains compatible.
s=s.replace(
  /\{result&&<div className=\"ad-result-backdrop\"><div className=\"ad-result-card\"><div className=\"ad-result-badge\">✅<\/div><small>REWARD RECEIVED<\/small><div className=\"ad-result-earned\">\+\{result\.reward\} WIENER<\/div><h3>Reward credited successfully\.<\/h3><button className=\"primary\" type=\"button\" onClick=\{\(\)=>setResult\(null\)\}>GOT IT<\/button><\/div><\/div>\}/,
  `{result&&<div className="ad-result-backdrop"><div className={\`ad-result-card \${result.source==='main'&&result.bonus_unlocked?'bonus':''}\`}><div className="ad-result-badge">{result.source==='main'&&result.bonus_unlocked?'⚡':'🪙'}</div><small>{result.source==='main'&&result.bonus_unlocked?'HIGHER REWARD UNLOCKED':'AD COMPLETED'}</small><div className="ad-result-earned">+{result.reward} WIENER</div>{result.source==='main'&&result.bonus_unlocked&&result.bonus_reward>0&&<div className="ad-reward-breakdown"><span>Ad reward <b>+{result.base_reward}</b></span><span>Engagement bonus <b>+{result.bonus_reward}</b></span></div>}{result.source==='main'&&!result.bonus_unlocked&&<h3 className="ad-missed-bonus">You could have earned up to +20 WIENER with eligible advertiser engagement.</h3>}{result.source!=='main'&&<h3>Reward credited successfully.</h3>}<button className="primary" type="button" onClick={()=>setResult(null)}>WATCH NEXT / CLOSE</button></div></div>}`
);

// Loading copy + small styling additions.
s=s.replace('<p>Please wait while the ad opens…</p>', '<p>Complete the ad to earn WIENER. Higher eligible engagement can unlock more.</p>');
s=s.replace('</style><div className="page-title">', '.main-ad-v109 .ad-up-to-note{display:block;margin-top:4px;font-size:9px;line-height:1.3;opacity:.58}.ad-reward-breakdown{display:grid;gap:6px;margin:8px 0 12px;padding:10px;border-radius:13px;background:rgba(255,255,255,.06);font-size:11px}.ad-reward-breakdown span{display:flex;justify-content:space-between}.ad-missed-bonus{font-size:12px!important;font-weight:800;opacity:.8}</style><div className="page-title">');

fs.writeFileSync(p,s);
console.log('V109 main AdsGram up-to-20 UI + 3s engagement telemetry applied');
