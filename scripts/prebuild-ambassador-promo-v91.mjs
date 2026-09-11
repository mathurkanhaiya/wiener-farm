import fs from 'node:fs';
const p='src/Ambassador.tsx';
let s=fs.readFileSync(p,'utf8');
let changed=0;
const reps=[
  ["<div><b>5</b><span>WIENER/code</span></div>","<div><b>{Number(c?.promo_reward_wiener||20)}</b><span>WIENER/code ({(Number(c?.promo_reward_wiener||20)/20000).toFixed(3)}$)</span></div>"],
  ["{p.valid_claims}/{p.max_claims} valid claims · {p.reward_wiener} WIENER","{p.valid_claims}/{p.max_claims} valid claims · {p.reward_wiener} WIENER ({(Number(p.reward_wiener||0)/20000).toFixed(3)}$)"],
  ["🎁 Reward: 5 WIENER<br/>","🎁 Reward: 20 WIENER (0.001$)<br/>"]
];
for(const [a,b] of reps){
  if(s.includes(a)){s=s.replace(a,b);changed++;}
  else if(!s.includes(b)) throw new Error('Ambassador V91 UI anchor missing: '+a.slice(0,50));
}
fs.writeFileSync(p,s);
console.log(`Ambassador V91 promo UI ready; changes=${changed}`);
