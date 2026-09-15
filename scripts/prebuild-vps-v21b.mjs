import fs from 'node:fs';

const src=fs.readFileSync('scripts/prebuild-vps-v21.mjs','utf8');
let fixed=src;
fixed=fixed.replace(
  "/const bindConnected=async\\(w:any,silent=false\\)=>\\{.*?\\};\\n useEffect\\(\\)=>/s,bind+'\\n useEffect(()=>','safe wallet binding'",
  "/const bindConnected=async\\(w:any,silent=false\\)=>\\{.*?\\};\\n useEffect/s,bind+'\\n useEffect','safe wallet binding'"
);
fixed=fixed.replace(
  "/ useEffect\\(\\)=>\\{const ui=getTonUI\\(\\);.*?\\},\\[\\]\\);\\n useEffect\\(\\)=>\\{if\\(!cooldownUntil\\)/s,lifecycle+'\\n useEffect(()=>{if(!cooldownUntil','wallet lifecycle'",
  "/ useEffect\\(\\(\\)=>\\{const ui=getTonUI\\(\\);.*?\\},\\[\\]\\);\\n useEffect/s,lifecycle+'\\n useEffect','wallet lifecycle'"
);
if(fixed===src)throw new Error('V21B could not repair expected matcher patterns');
fs.writeFileSync('/tmp/prebuild-vps-v21-fixed.mjs',fixed);
await import(`file:///tmp/prebuild-vps-v21-fixed.mjs?v=${Date.now()}`);

const libPath='src/lib.ts';
if(fs.existsSync(libPath)){
  const before=fs.readFileSync(libPath,'utf8');
  const after=before.replace("const viteEnv=(import.meta as any).env||{};\\n// V45 TON iOS browser compatibility","const viteEnv=(import.meta as any).env||{};\n// V45 TON iOS browser compatibility");
  if(after!==before)fs.writeFileSync(libPath,after);
}

const spinPath='src/SpinEarn.tsx';
if(fs.existsSync(spinPath)){
  const before=fs.readFileSync(spinPath,'utf8');
  let after=before.replace("const WIENER_ICON='/favicon.ico';","const WIENER_ICON='https://pixlinkhost.vercel.app/i/uRiwapMRiQ';");

  const oldCss=`.spin-earn-card{position:relative;overflow:hidden;margin-top:10px;padding:14px 14px 13px;border:1px solid rgba(255,87,87,.2);background:radial-gradient(circle at 88% 10%,rgba(255,55,70,.23),transparent 34%),linear-gradient(145deg,rgba(74,10,20,.72),rgba(20,7,12,.9));box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 12px 28px rgba(0,0,0,.18)}
 .spin-card-main{display:flex;align-items:center;gap:12px}.spin-card-icon{width:52px;height:52px;object-fit:contain;filter:drop-shadow(0 8px 16px rgba(255,47,75,.25));animation:spinFloat 2.8s ease-in-out infinite}.spin-card-copy{min-width:0;flex:1}.spin-card-copy h3{margin:0;font-size:16px}.spin-card-copy p{margin:3px 0 0;font-size:11px;opacity:.68}.spin-icons{display:flex;align-items:center;gap:5px;margin-top:7px}.spin-icons img{width:19px;height:19px;object-fit:contain;border-radius:50%;filter:drop-shadow(0 3px 6px rgba(0,0,0,.2))}.spin-icons b{font-size:10px;opacity:.78}.spin-card-action{min-width:76px}.spin-card-meta{display:flex;justify-content:space-between;gap:8px;margin-top:10px;padding-top:9px;border-top:1px solid rgba(255,255,255,.06);font-size:9px;font-weight:850;opacity:.62}.spin-live{color:#ffb6bf}`;
  const newCss=`.spin-earn-card{position:relative;overflow:hidden;margin-top:10px;padding:13px 14px 11px;border:1px solid rgba(255,145,44,.25);background:radial-gradient(circle at 86% 8%,rgba(255,118,21,.18),transparent 34%),radial-gradient(circle at 5% 100%,rgba(255,52,42,.09),transparent 38%),linear-gradient(145deg,rgba(29,18,13,.96),rgba(13,10,8,.98));box-shadow:inset 0 1px 0 rgba(255,255,255,.09),0 12px 30px rgba(0,0,0,.22),0 0 0 1px rgba(255,128,31,.035)}
 .spin-earn-card:before{content:'';position:absolute;inset:0;pointer-events:none;background:linear-gradient(110deg,transparent 18%,rgba(255,255,255,.035) 46%,transparent 72%);transform:translateX(-58%);animation:spinCardShine 5.8s ease-in-out infinite}.spin-card-main{position:relative;display:flex;align-items:center;gap:11px}.spin-card-icon-shell{width:58px;height:58px;flex:0 0 58px;display:grid;place-items:center;border-radius:18px;background:linear-gradient(145deg,rgba(255,151,54,.16),rgba(255,82,20,.07));border:1px solid rgba(255,160,65,.22);box-shadow:inset 0 1px 0 rgba(255,255,255,.11),0 9px 24px rgba(255,93,24,.12)}.spin-card-icon{width:43px;height:43px;object-fit:cover;border-radius:50%;clip-path:circle(49%);filter:saturate(1.12) contrast(1.04) drop-shadow(0 6px 12px rgba(0,0,0,.28));animation:spinFloat 3s ease-in-out infinite}.spin-card-copy{min-width:0;flex:1}.spin-card-title-row{display:flex;align-items:center;gap:6px}.spin-card-copy h3{margin:0;font-size:16px;font-weight:950;letter-spacing:-.18px}.spin-premium-badge{display:inline-flex;align-items:center;height:17px;padding:0 6px;border-radius:999px;background:rgba(255,125,25,.12);border:1px solid rgba(255,143,39,.2);color:#ffb05d;font-size:7px;font-weight:950;letter-spacing:.11em}.spin-card-copy p{margin:2px 0 0;font-size:10px;line-height:1.25;opacity:.58}.spin-jackpot{display:inline-flex;align-items:center;gap:5px;margin-top:6px;padding:4px 7px 4px 5px;border-radius:999px;background:rgba(61,167,255,.075);border:1px solid rgba(73,176,255,.13)}.spin-jackpot img{width:17px;height:17px;object-fit:contain;border-radius:50%}.spin-jackpot span{font-size:8px;opacity:.55;font-weight:850}.spin-jackpot b{font-size:9px;color:#a8dcff;letter-spacing:.01em}.spin-card-action{position:relative;min-width:83px!important;height:46px!important;border-radius:15px!important;font-size:12px!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.35),0 9px 20px rgba(255,107,21,.18)!important}.spin-card-meta{position:relative;display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,.055);font-size:8px;font-weight:850;letter-spacing:.02em;opacity:1}.spin-card-meta span:first-child{display:flex;align-items:center;gap:5px;color:rgba(255,255,255,.62)}.spin-card-meta span:first-child:before{content:'';width:6px;height:6px;border-radius:50%;background:#ff951f;box-shadow:0 0 10px rgba(255,149,31,.55)}.spin-card-meta span:last-child{color:rgba(255,187,111,.64)}.spin-live{display:none!important}@keyframes spinCardShine{0%,64%,100%{transform:translateX(-58%)}78%{transform:translateX(75%)}}`;
  if(after.includes(oldCss))after=after.replace(oldCss,newCss);

  after=after.replace('<img className="spin-card-icon" src={SPIN_ICON} alt=""/>','<div className="spin-card-icon-shell"><img className="spin-card-icon" src={SPIN_ICON} alt=""/></div>');
  after=after.replace('<div className="spin-card-copy"><h3>Spin & Earn</h3><p>Win WIENER, TON & free spins</p><div className="spin-icons"><img src={WIENER_ICON} alt=""/><img src={TON_ICON} alt=""/><img src={SPIN_ICON} alt=""/><b>0.005 TON JACKPOT</b></div></div>','<div className="spin-card-copy"><div className="spin-card-title-row"><h3>Spin & Earn</h3><span className="spin-premium-badge">REWARDS</span></div><p>Win WIENER, TON & bonus spins</p><div className="spin-jackpot"><img src={TON_ICON} alt=""/><span>Jackpot</span><b>0.005 TON</b></div></div>');

  // Exact circular masking for the uploaded spinner artwork everywhere it appears.
  after=after.replace('.spin-segment img{width:21px;height:21px;object-fit:contain}', '.spin-segment img{width:21px;height:21px;object-fit:cover;border-radius:50%;clip-path:circle(48%);background:transparent}');
  after=after.replace('.spin-hub img{width:46px;height:46px;object-fit:contain}', '.spin-hub img{width:46px;height:46px;object-fit:cover;border-radius:50%;clip-path:circle(48%);background:transparent}');
  after=after.replace('.spin-balance img{width:19px;height:19px;object-fit:contain}', '.spin-balance img{width:19px;height:19px;object-fit:cover;border-radius:50%;clip-path:circle(48%);background:transparent}');
  after=after.replace('.spin-win img{width:44px;height:44px;object-fit:contain}', '.spin-win img{width:44px;height:44px;object-fit:cover;border-radius:50%;clip-path:circle(48%);background:transparent}');

  if(after!==before)fs.writeFileSync(spinPath,after);
}
