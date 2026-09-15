import fs from 'node:fs';

// Keep this build step to clean VPS checkouts modified by the old V103 installer.
const p='src/AdsPage.tsx';
const original=fs.readFileSync(p,'utf8');
let s=original;
s=s.replace(/<UslAdsBlock\b[^>]*\/>/g,'');
s=s.replace(/\nasync function uslApi\([\s\S]*?(?=\nexport function Ads\()/,'\n');
if(/UslAdsBlock|uslApi|loadUslSdk|TowerAds|uslads\.com/.test(s)){
 throw new Error('USL cleanup incomplete: inspect AdsPage.tsx before building');
}
// Apply the custom Adsgram icon after earlier frontend patches.
const oldIcon="<AnimatedIcon name=\"ads\" active={!mainDisabled}/>";
const adsgramIcon="<img src=\"https://pixlinkhost.vercel.app/i/2O4rXYYJTA\" alt=\"Adsgram\" width={44} height={44} style={{display:'block',objectFit:'contain',background:'transparent'}}/>";
if(!s.includes(adsgramIcon)&&!s.includes('wf-ads-section')){
 if(!s.includes(oldIcon))throw new Error('Adsgram icon anchor missing');
 s=s.replace(oldIcon,adsgramIcon);
}
// Keep icon alignment without the square tile's background, border or shadow.
s=s.replace('<div className="square play">'+adsgramIcon+'</div>',
 '<div style={{width:44,height:44,flexShrink:0,display:"grid",placeItems:"center",background:"transparent",border:0,boxShadow:"none"}}>'+adsgramIcon+'</div>');

// Two distinct sections with responsive cards; reward and ad handlers stay in place.
if(!s.includes('wf-ads-section')){
 const heading='<div className="page-title"><h2>ADS TASK</h2></div>';
 const cardStart=s.indexOf('<section className="card ad-card">');
 const cardEnd=s.indexOf('</section>',cardStart);
 if(cardStart<0||cardEnd<0)throw new Error('Ads card layout anchor missing');
 const headingStart=s.lastIndexOf(heading,cardStart);
 if(headingStart<0||headingStart+heading.length!==cardStart)throw new Error('Ads heading layout anchor missing');
 s=s.slice(0,headingStart)+"<section className=\"wf-ads-section\" aria-label=\"Ads Task\"><style>{\"\\n.wf-ad-heading{display:flex;align-items:center;gap:10px;margin:24px 2px 12px;color:#fff5e8}.wf-ad-heading:before{content:\\\"\\\";width:4px;height:22px;border-radius:6px;background:linear-gradient(#ffd36b,#ff8500)}.wf-ad-heading h2{margin:0;font-size:18px;font-weight:900;letter-spacing:-.3px}.wf-ad-heading span{margin-left:auto;color:#b6b9ae;font-size:11px}\\n.wf-ad-offer.card{display:block!important;padding:20px!important;margin:0!important;border-radius:24px!important;border:1px solid #b87a333d!important;background:radial-gradient(ellipse at 100% 0%,#ff9e161c,transparent 65%),linear-gradient(145deg,#221a10,#101a13)!important;box-shadow:inset 0 1px 0 #fff1,0 12px 30px #0002!important}\\n.wf-ad-top{display:flex;align-items:center;gap:14px}.wf-ad-top img{width:54px;height:54px;object-fit:contain;background:transparent;border:0;box-shadow:none}.wf-ad-copy{flex:1;min-width:0}.wf-ad-copy h3{margin:0!important;font-size:20px!important;letter-spacing:-.5px}.wf-ad-copy p{margin:4px 0 0!important;color:#b7bcae;font-size:12px!important}.wf-ad-reward{display:inline-flex;align-items:center;gap:5px;color:#ffca68;font-size:13px;font-weight:850;margin-top:16px;padding:7px 11px;background:#ffb43e0d;border:1px solid #ffb43e24;border-radius:10px}\\n.wf-ad-progress-label{display:flex;justify-content:space-between;gap:10px;margin:18px 0 8px;font-size:11px;color:#b7bcae}.wf-ad-progress-label b{color:#fff1d2;font-variant-numeric:tabular-nums}.wf-ad-progress{height:6px;border-radius:20px;background:#ffffff0d;overflow:hidden}.wf-ad-progress span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#ff9500,#ffdb80);transition:width .35s}\\n.wf-ad-offer .wf-ad-watch{width:100%!important;min-height:48px!important;margin-top:18px!important;border-radius:14px!important;background:linear-gradient(110deg,#ffb82e,#ff8000)!important;border:1px solid #ffd681!important;color:#211405!important;font-size:13px!important;font-weight:900!important;box-shadow:0 6px 18px #ff8a001a!important;transition:transform .15s,opacity .15s}.wf-ad-watch:active{transform:scale(.98)}.wf-ad-watch:disabled{opacity:.5;cursor:default}.wf-ad-watch:focus-visible,.wf-earn-section button:focus-visible{outline:2px solid #ffe0a1;outline-offset:4px}\\n.wf-earn-section{margin-top:30px;padding-bottom:12px}.wf-earn-section .wf-ad-heading{margin-top:0}.wf-earn-section .spin-earn-card.card{margin:0!important;padding:20px!important;border-radius:24px!important;border:1px solid #d1a55533!important;background:radial-gradient(ellipse at 0% 0%,#ffd06514,transparent 65%),linear-gradient(145deg,#1e2315,#131910)!important;box-shadow:inset 0 1px 0 #fff1,0 12px 30px #0002!important}.wf-earn-section .spin-card-main{display:grid;grid-template-columns:54px minmax(0,1fr)!important;gap:14px!important}.wf-earn-section .spin-card-icon{width:54px!important;height:54px!important;object-fit:contain!important;background:transparent!important}.wf-earn-section .spin-card-copy h3{font-size:20px!important;letter-spacing:-.5px}.wf-earn-section .spin-card-copy p{font-size:12px!important;line-height:1.5}.wf-earn-section .spin-card-action{grid-column:1/-1;width:100%!important;min-height:46px!important;margin-top:3px;border-radius:14px!important;background:#ffc34a12!important;color:#ffd283!important;border:1px solid #ffd28345!important;box-shadow:none!important}.wf-earn-section .spin-card-meta{flex-wrap:wrap!important;line-height:1.6!important;font-size:10px!important}.wf-earn-section .spin-icons{flex-wrap:wrap}.wf-earn-section .spin-live{color:#d1dba7}\\n@media(prefers-reduced-motion:reduce){.wf-ad-progress span{transition:none}.wf-earn-section .spin-card-icon{animation:none!important}}\\n\"}</style><div className=\"wf-ad-heading\"><h2>Ads Task</h2><span>Daily rewards</span></div><section className=\"card wf-ad-offer\"><div className=\"wf-ad-top\"><img src=\"https://pixlinkhost.vercel.app/i/2O4rXYYJTA\" alt=\"\" width={54} height={54}/><div className=\"wf-ad-copy\"><h3>Adsgram Ad</h3><p>Watch an ad. Collect WIENER.</p></div></div><div className=\"wf-ad-reward\">+{Number(s.ad_reward||5)} WIENER <span>per ad</span></div><div className=\"wf-ad-progress-label\"><span>Today's progress</span><b>{used} / {s.daily_ad_limit}</b></div><div className=\"wf-ad-progress\" role=\"progressbar\" aria-label=\"Daily ads completed\" aria-valuemin={0} aria-valuemax={Math.max(1,Number(s.daily_ad_limit||0))} aria-valuenow={Math.min(used,Math.max(1,Number(s.daily_ad_limit||0)))}><span style={{width:`${Math.min(100,Math.max(0,used/Math.max(1,Number(s.daily_ad_limit||0))*100))}%`}}/></div><button className=\"primary wf-ad-watch\" type=\"button\" disabled={mainDisabled} onClick={()=>watch('main')}>{mainAtLimit?'DAILY LIMIT REACHED':busy==='main'?'OPENING AD…':cooldown>0?`NEXT AD IN ${cooldown}s`:'WATCH AD'}</button></section></section>"+s.slice(cardEnd+'</section>'.length);
 const spin='<SpinEarn refresh={refresh} say={say}/>';
 if(!s.includes(spin))throw new Error('Spin card layout anchor missing');
 s=s.replace(spin,"<section className=\"wf-earn-section\" aria-label=\"Earn\"><div className=\"wf-ad-heading\"><h2>Earn</h2><span>Try your luck</span></div><SpinEarn refresh={refresh} say={say}/></section>");
}
if(s!==original)fs.writeFileSync(p,s);
console.log('USL Ads removed from frontend');
