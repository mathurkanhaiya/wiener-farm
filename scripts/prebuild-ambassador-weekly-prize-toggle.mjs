import fs from 'node:fs';

const file='src/Ambassador.tsx';
if(!fs.existsSync(file))throw new Error(`Missing ${file}`);
let s=fs.readFileSync(file,'utf8');
const MARK='AMBASSADOR_WEEKLY_PRIZE_TOGGLE_V72';
if(s.includes(MARK)){
  console.log('Ambassador weekly prize toggle already applied');
  process.exit(0);
}

function one(oldText,newText,label){
  if(!s.includes(oldText))throw new Error(`Ambassador weekly toggle anchor missing: ${label}`);
  s=s.replace(oldText,newText);
}

one(
  "import {ambassadorApi,PUBLISHABLE_KEY,getInitData,type Snapshot,type Tab} from './lib';",
  "import {api,ambassadorApi,PUBLISHABLE_KEY,getInitData,type Snapshot,type Tab} from './lib';",
  'lib import'
);

one(
  "const league=board?.leaderboard||o?.leaderboard||[],prize=board?.weekly_prize_pool_usdt??c?.weekly_prize_pool_usdt??2.5,roundEnd=board?.round_end_at||c?.weekly_round_end_at;",
  "const league=board?.leaderboard||o?.leaderboard||[],prize=Number(c?.weekly_prize_pool_usdt??board?.weekly_prize_pool_usdt??2.5),prizesEnabled=prize>0,roundEnd=board?.round_end_at||c?.weekly_round_end_at;",
  'league state'
);

one(
  '<span>🏆 ${usd(prize,2)} weekly pool</span>',
  '{prizesEnabled?<span>🏆 ${usd(prize,2)} weekly pool</span>:<span>🏆 Weekly leaderboard active</span>}',
  'hero weekly benefit'
);

one(
  '<p className="amb-money-inline"><UsdtIcon size={16}/><b>${usd(prize,2)} USDT</b> prize pool · ends Sunday</p>',
  '{prizesEnabled?<p className="amb-money-inline"><UsdtIcon size={16}/><b>${usd(prize,2)} USDT</b> prize pool · ends Sunday</p>:<p>Leaderboard active · weekly prizes paused</p>}',
  'league prize headline'
);

const prizeCards='<div className="amb-prizes"><div><RankIcon rank={1} size={28}/><span>1st Prize</span><b><UsdtIcon size={14}/>$1.25</b></div><div><RankIcon rank={2} size={28}/><span>2nd Prize</span><b><UsdtIcon size={14}/>$0.75</b></div><div><RankIcon rank={3} size={28}/><span>3rd Prize</span><b><UsdtIcon size={14}/>$0.50</b></div></div>';
one(
  prizeCards,
  `{prizesEnabled?${prizeCards}:<div className="amb-deadline">Weekly prizes are currently paused. Rankings and valid-claim tracking continue normally.</div>}`,
  'weekly prize cards'
);

one(
  '<AdminAmbassador data={admin} busy={adminBusy} setBusy={setAdminBusy} reload={loadAdmin} say={say}/>',
  '<AdminAmbassador data={admin} settings={c} busy={adminBusy} setBusy={setAdminBusy} reload={async()=>{await load();await loadBoard();await loadAdmin()}} say={say}/>',
  'admin component props'
);

one(
  'function AdminAmbassador({data,busy,setBusy,reload,say}:{data:any;busy:boolean;setBusy:any;reload:any;say:any}){',
  'function AdminAmbassador({data,settings,busy,setBusy,reload,say}:{data:any;settings:any;busy:boolean;setBusy:any;reload:any;say:any}){',
  'admin signature'
);

one(
  "  const latest=today[0],lastAt=latest?new Date(latest.created_at).getTime():0,nextAt=lastAt+4*60*60*1000,cooldown=lastAt>0&&Date.now()<nextAt,limit=today.length>=2;",
  "  const latest=today[0],lastAt=latest?new Date(latest.created_at).getTime():0,nextAt=lastAt+4*60*60*1000,cooldown=lastAt>0&&Date.now()<nextAt,limit=today.length>=2,leaguePrizesEnabled=Number(settings?.weekly_prize_pool_usdt||0)>0;",
  'admin league state'
);

const adminHead='<div className="section-head"><div><div className="eyebrow">ADMIN ONLY</div><h3>Ambassador Management</h3><p>Applications, global promo drops and USDT withdrawals.</p></div></div>';
one(
  adminHead,
  `${adminHead}\n    <div className="amb-publisher"><div className="amb-publish-head"><div><h4>Weekly League Prizes</h4><p>Leaderboard, rankings and valid-claim tracking stay active even when prizes are OFF.</p></div><span className={\`amb-pill \${leaguePrizesEnabled?'good':''}\`}>{leaguePrizesEnabled?'ON':'OFF'}</span></div><button className={leaguePrizesEnabled?'secondary':'primary'} disabled={busy} onClick={()=>action(()=>api('admin_settings_save',{settings:{weekly_prize_pool_usdt:leaguePrizesEnabled?0:2.5}}),leaguePrizesEnabled?'Weekly league prizes turned OFF':'Weekly league prizes turned ON')}>{busy?'SAVING…':leaguePrizesEnabled?'TURN PRIZES OFF':'TURN PRIZES ON'}</button><div className="tiny center">{leaguePrizesEnabled?'Top 3 prize pool: $2.50 USDT':'No weekly prize amounts are shown or awarded while OFF.'}</div></div>`,
  'admin header'
);

s=s.replace('const ambCss=`',`// ${MARK}\nconst ambCss=\``);
fs.writeFileSync(file,s);
console.log('Applied Ambassador weekly prize ON/OFF toggle; leaderboard remains active');
