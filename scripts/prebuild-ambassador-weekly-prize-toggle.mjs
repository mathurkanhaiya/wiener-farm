import fs from 'node:fs';

const file='src/Ambassador.tsx';
if(!fs.existsSync(file))throw new Error(`Missing ${file}`);
let s=fs.readFileSync(file,'utf8');
const MARK='AMBASSADOR_WEEKLY_PRIZE_TOGGLE_V72';

if(
  s.includes(MARK) ||
  (s.includes('weekly_prizes_enabled') &&
   s.includes('TURN WEEKLY PRIZES OFF') &&
   s.includes('Weekly prizes are paused'))
){
  if(s.includes('prizesEnabled?{prizesEnabled?')) throw new Error('Ambassador weekly prize toggle duplicate JSX detected');
  console.log('Ambassador weekly prize toggle already applied');
  process.exit(0);
}

function one(oldText,newText,label){
  if(!s.includes(oldText))throw new Error(`Ambassador weekly toggle anchor missing: ${label}`);
  s=s.replace(oldText,newText);
}

one(
  "type Board={weekly_prize_pool_usdt:number;round_start_at:string;round_end_at:string;leaderboard:any[];my_rank:number|null;my_claims:number};",
  "type Board={weekly_prizes_enabled?:boolean;weekly_prize_pool_usdt:number;configured_weekly_prize_pool_usdt?:number;round_start_at:string;round_end_at:string;leaderboard:any[];my_rank:number|null;my_claims:number};",
  'board type'
);
one(
  "const league=board?.leaderboard||o?.leaderboard||[],prize=board?.weekly_prize_pool_usdt??c?.weekly_prize_pool_usdt??2.5,roundEnd=board?.round_end_at||c?.weekly_round_end_at;",
  "const league=board?.leaderboard||o?.leaderboard||[],prizesEnabled=(board?.weekly_prizes_enabled??c?.weekly_prizes_enabled)!==false,prize=prizesEnabled?(board?.weekly_prize_pool_usdt??c?.weekly_prize_pool_usdt??2.5):0,roundEnd=board?.round_end_at||c?.weekly_round_end_at;",
  'league state'
);
one(
  '<span>🏆 ${usd(prize,2)} weekly pool</span>',
  "<span>{prizesEnabled?`🏆 $${usd(prize,2)} weekly pool`:'🏆 Weekly leaderboard active'}</span>",
  'hero weekly benefit'
);
one(
  '<p className="amb-money-inline"><UsdtIcon size={16}/><b>${usd(prize,2)} USDT</b> prize pool · ends Sunday</p>',
  '<p className="amb-money-inline">{prizesEnabled?<><UsdtIcon size={16}/><b>${usd(prize,2)} USDT</b> prize pool · ends Sunday</>:<><b>Leaderboard active</b> · weekly prizes paused</>}</p>',
  'league prize headline'
);
const prizeCards='<div className="amb-prizes"><div><RankIcon rank={1} size={28}/><span>1st Prize</span><b><UsdtIcon size={14}/>$1.25</b></div><div><RankIcon rank={2} size={28}/><span>2nd Prize</span><b><UsdtIcon size={14}/>$0.75</b></div><div><RankIcon rank={3} size={28}/><span>3rd Prize</span><b><UsdtIcon size={14}/>$0.50</b></div></div>';
one(
  prizeCards,
  `{prizesEnabled?${prizeCards}:<div className="amb-alert"><b>Weekly prizes are paused</b><p>Leaderboard, ranks and valid-claim tracking continue normally.</p></div>}`,
  'weekly prize cards'
);
const adminAnchor='<div className="amb-publisher">';
const adminToggle='<div className="amb-publisher"><div className="amb-publish-head"><div><h4>Weekly League Prizes</h4><p>Turn off prizes without disabling rankings, claim counts or the leaderboard.</p></div><span className={`amb-pill ${data?.settings?.weekly_prizes_enabled!==false?\'good\':\'\'}`}>{data?.settings?.weekly_prizes_enabled!==false?\'ON\':\'OFF\'}</span></div><button className={data?.settings?.weekly_prizes_enabled!==false?\'secondary\':\'primary\'} disabled={busy} onClick={()=>action(()=>ambassadorApi(\'admin_settings\',{weekly_prizes_enabled:data?.settings?.weekly_prizes_enabled===false}),data?.settings?.weekly_prizes_enabled===false?\'Weekly League prizes enabled\':\'Weekly League prizes disabled\')}>{data?.settings?.weekly_prizes_enabled!==false?\'TURN WEEKLY PRIZES OFF\':\'TURN WEEKLY PRIZES ON\'}</button><div className="tiny center">Leaderboard always stays active. Disabled weeks are not paid from the leaderboard route.</div></div>\n    <div className="amb-publisher">';
one(adminAnchor,adminToggle,'admin publisher');
s=s.replace('const ambCss=`',`// ${MARK}\nconst ambCss=\``);
if(s.includes('prizesEnabled?{prizesEnabled?')) throw new Error('Ambassador weekly prize toggle duplicate JSX detected');
fs.writeFileSync(file,s);
console.log('Applied Ambassador weekly prize ON/OFF toggle; leaderboard remains active');
