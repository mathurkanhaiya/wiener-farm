import fs from 'node:fs';

const p='src/pages.tsx';
let s=fs.readFileSync(p,'utf8');

if(!s.includes("import {DailyBioClaimGate} from './DailyBioClaimGate';")){
  const anchor="import {AnimatedIcon} from './icons';";
  if(!s.includes(anchor))throw new Error('daily bio gate: import anchor missing');
  s=s.replace(anchor,`${anchor}\nimport {DailyBioClaimGate} from './DailyBioClaimGate';`);
}

if(!s.includes('const [bioGate,setBioGate]=useState(false)')){
  const start="function DailyCard({data,run}:{data:Snapshot;run:any}){const u:any=data.user,";
  if(!s.includes(start))throw new Error('daily bio gate: DailyCard start anchor missing');
  s=s.replace(start,"function DailyCard({data,run}:{data:Snapshot;run:any}){const [bioGate,setBioGate]=useState(false),u:any=data.user,");
}

const oldClick="onClick={()=>run('daily_claim',{},displayDay===7?'Week complete · ⭐ earned':'Daily WIENER claimed')}";
if(s.includes(oldClick))s=s.replace(oldClick,"onClick={()=>setBioGate(true)}");
else if(!s.includes('onClick={()=>setBioGate(true)}'))throw new Error('daily bio gate: claim button anchor missing');

if(!s.includes('<DailyBioClaimGate open={bioGate}')){
  const tail='<div className="daily-loyalty">Complete 4 weekly streaks to unlock a Loyalty Chest automatically.</div></section>}';
  if(!s.includes(tail))throw new Error('daily bio gate: DailyCard tail anchor missing');
  const replacement='<div className="daily-loyalty">Complete 4 weekly streaks to unlock a Loyalty Chest automatically.</div><DailyBioClaimGate open={bioGate} data={data} run={run} onClose={()=>setBioGate(false)} successMessage={displayDay===7?\'Week complete · ⭐ earned\':\'Daily WIENER claimed\'}/></section>}';
  s=s.replace(tail,replacement);
}

fs.writeFileSync(p,s);
console.log('Daily referral bio claim gate wired');
