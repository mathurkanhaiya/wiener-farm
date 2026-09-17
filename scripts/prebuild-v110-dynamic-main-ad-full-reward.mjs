import fs from 'node:fs';

const p='src/AdsPage.tsx';
let s=fs.readFileSync(p,'utf8');

// V110 runs after V109. Keep AdsGram's existing successful callback as the
// completion gate; visibility >=3s only selects partial vs full reward.
s=s.replace(
  "type Result={source:Source;reward:number;bonus_unlocked:boolean;interaction_detected:boolean;base_reward:number;bonus_reward:number};",
  "type Result={source:Source;reward:number;bonus_unlocked:boolean;interaction_detected:boolean;base_reward:number;bonus_reward:number;full_reward:number};"
);
s=s.replace(
  /const finish=\(src:Source,st:any\)=>\{const total=Number\(st\?\.reward\|\|0\),base=Number\(st\?\.base_reward\?\?st\?\.normal_reward\?\?total\),bonus=Math\.max\(0,Number\(st\?\.bonus_reward\?\?\(total-base\)\)\);setResult\(\{source:src,reward:total,bonus_unlocked:!!\(st\?\.bonus_unlocked\?\?st\?\.interaction_detected\?\?bonus>0\),interaction_detected:!!st\?\.interaction_detected,base_reward:base,bonus_reward:bonus\}\)\};/,
  "const finish=(src:Source,st:any)=>{const total=Number(st?.reward||0),full=Number(st?.full_reward??st?.configured_reward??total),base=Number(st?.base_reward??st?.normal_reward??total),bonus=Math.max(0,Number(st?.bonus_reward??(total-base)));setResult({source:src,reward:total,bonus_unlocked:!!(st?.bonus_unlocked??st?.interaction_detected??bonus>0),interaction_detected:!!st?.interaction_detected,base_reward:base,bonus_reward:bonus,full_reward:full})};"
);

// Dynamic card: never hard-code 20. Admin setting is the advertised maximum.
s=s.replace('⚡ UP TO +20 WIENER', '⚡ UP TO +{Number(s.ad_reward||0)} WIENER');
s=s.replace('Complete the ad to earn. Eligible advertiser engagement can unlock a higher reward.', 'Complete the ad to earn. Open the advertiser and stay away for 3+ seconds to unlock the full reward.');

// Make the result instructions explicit and dynamic.
s=s.replace("'HIGHER REWARD UNLOCKED'", "'FULL REWARD UNLOCKED'");
s=s.replace(
  /\{result\.source==='main'&&!result\.bonus_unlocked&&<h3 className=\"ad-missed-bonus\">You could have earned up to \+20 WIENER with eligible advertiser engagement\.<\/h3>\}/,
  "{result.source==='main'&&!result.bonus_unlocked&&<div className=\"ad-unlock-guide\"><b>Unlock full +{result.full_reward} WIENER next time</b><span>Open the advertiser from the ad and stay outside WIENER Farm for at least 3 seconds.</span><small>Potential bonus missed: +{Math.max(0,result.full_reward-result.reward)} WIENER</small></div>}"
);
s=s.replace(
  "{result.source==='main'&&result.bonus_unlocked&&result.bonus_reward>0&&<div className=\"ad-reward-breakdown\"><span>Ad reward <b>+{result.base_reward}</b></span><span>Engagement bonus <b>+{result.bonus_reward}</b></span></div>}",
  "{result.source==='main'&&result.bonus_unlocked&&<div className=\"ad-reward-breakdown\"><span>✓ Ad successfully completed</span><span>✓ 3-second advertiser visit detected</span><span>⚡ Full reward <b>+{result.full_reward} WIENER</b></span></div>}"
);
s=s.replace('Complete the ad to earn WIENER. Higher eligible engagement can unlock more.', 'Complete the ad to earn WIENER. Open the advertiser and stay away for 3+ seconds to unlock the full reward.');
s=s.replace('.ad-missed-bonus{font-size:12px!important;font-weight:800;opacity:.8}', '.ad-missed-bonus{font-size:12px!important;font-weight:800;opacity:.8}.ad-unlock-guide{display:grid;gap:6px;margin:10px 0 12px;padding:11px;border-radius:14px;background:rgba(255,255,255,.06);font-size:11px;line-height:1.35}.ad-unlock-guide b{font-size:13px}.ad-unlock-guide span{opacity:.82}.ad-unlock-guide small{opacity:.65}')

fs.writeFileSync(p,s);
console.log('V110 dynamic main AdsGram partial/full reward UI applied');
