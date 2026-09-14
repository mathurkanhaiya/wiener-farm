import fs from 'node:fs';
const p='src/AdsPage.tsx';
let s=fs.readFileSync(p,'utf8');
// Remove client interaction / advertiser-click tracking and league visit bonuses from monetary ad flow.
s=s.replace("import {adApi,adUsageApi,secondaryAdApi,getInitData,type Snapshot} from './lib';","import {adApi,adUsageApi,secondaryAdApi,type Snapshot} from './lib';");
s=s.replace("import {trackAdInteraction} from './adInteraction';\n",'');
s=s.replace(/const sleep=\(ms:number\)=>new Promise\(r=>setTimeout\(r,ms\)\);\n/,'');
s=s.replace("type Result={source:Source;reward:number;bonus_unlocked:boolean;interaction_detected:boolean;league_visit_points:number};","type Result={source:Source;reward:number};");
s=s.replace(/\nasync function leagueVisitBonus[\s\S]*?return Number\(x\?\.awarded_points\|\|0\);\n}\n/,'\n');
s=s.replace(",[leagueRefresh,setLeagueRefresh]=useState(0)","");
s=s.replace(/const finish=\(src:Source,st:any,leaguePts=0\)=>setResult\([^;]+;\n/,"const finish=(src:Source,st:any)=>setResult({source:src,reward:Number(st?.reward||0)});\n");
s=s.replace(/ const openBonusGuide=.*?;\n const watch=/s,' const watch=');
// Keep callback verification, but do not send interaction flags or calculate visit bonuses.
s=s.replace("const tracker=trackAdInteraction({allowBlur:true,minBlurMs:5000});try{","try{");
s=s.replace(/tracker\.start\(\);/g,'');
s=s.replace(/const visitMs=tracker\.interactionMs\(\);const visited5s=visitMs>=5000;/g,'');
s=s.replace("adApi('complete',{session_id:x.session_id,interacted:visited5s} as any)","adApi('complete',{session_id:x.session_id})");
s=s.replace("secondaryAdApi('reward',{session_id:x.session_id,interacted:visited5s} as any)","secondaryAdApi('reward',{session_id:x.session_id})");
s=s.replace(/const leaguePts=await leagueVisitBonus\(String\(x\.session_id\|\|''\),visitMs\)\.catch\(\(\)=>0\);/g,'');
s=s.replace(/finish\('main',st,leaguePts\);/g,"finish('main',st);");
s=s.replace(/finish\('secondary',st,leaguePts\);/g,"finish('secondary',st);");
s=s.replace(/setLeagueRefresh\(v=>v\+1\)/g,'');
s=s.replace(/finally\{tracker\.stop\(\);setBusy\(null\)\}/g,'finally{setBusy(null)}');
// Remove league UI and all click/full-reward guidance text from Ads page.
s=s.replace(/<WeeklyAdLeagueV88[^>]*\/>/g,'');
s=s.replace("import {WeeklyAdLeagueV88} from './WeeklyAdLeagueV88';\n",'');
s=s.replace('<p>Visit/open the advertiser for at least 5 seconds to earn +2 League Points.</p>','<p>Please wait while the ad opens…</p>');
s=s.replace(/<div className=\"ad-result-backdrop\"><div className=\{`ad-result-card \$\{result\.bonus_unlocked\?'bonus':''\}`\}>[\s\S]*?<button className=\"primary\" type=\"button\" onClick=\{\(\)=>setResult\(null\)\}>GOT IT<\/button><\/div><\/div>/,"<div className=\"ad-result-backdrop\"><div className=\"ad-result-card\"><div className=\"ad-result-badge\">✅</div><small>REWARD RECEIVED</small><div className=\"ad-result-earned\">+{result.reward} WIENER</div><h3>Reward credited successfully.</h3><button className=\"primary\" type=\"button\" onClick={()=>setResult(null)}>GOT IT</button></div></div>");
fs.writeFileSync(p,s);
console.log('V102 fixed ad reward UI applied');