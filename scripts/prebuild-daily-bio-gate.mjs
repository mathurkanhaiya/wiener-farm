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
  s=s.replace(start,"function DailyCard({data,run}:{data:Snapshot;run:any}){const [bioGate,setBioGate]=useState(false),[bioChecking,setBioChecking]=useState(false),u:any=data.user,");
}else if(!s.includes('[bioChecking,setBioChecking]')){
  s=s.replace('const [bioGate,setBioGate]=useState(false),u:any=data.user,','const [bioGate,setBioGate]=useState(false),[bioChecking,setBioChecking]=useState(false),u:any=data.user,');
}

if(!s.includes('const claimDaily=async()=>')){
  const anchor='displayWeek=done?currentWeek:nextWeek,starSlots=[0,1,2,3];';
  if(!s.includes(anchor))throw new Error('daily bio gate: claim handler anchor missing');
  const handler="displayWeek=done?currentWeek:nextWeek,starSlots=[0,1,2,3];const claimDaily=async()=>{if(done||bioChecking)return;const success=displayDay===7?'Week complete · ⭐ earned':'Daily WIENER claimed';try{setBioChecking(true);await api('daily_bio_check');await run('daily_claim',{},success)}catch(e:any){const raw=String(e?.message||e||'');if(/bio|referral|daily_bio|link/i.test(raw))setBioGate(true);else throw e}finally{setBioChecking(false)}};";
  s=s.replace(anchor,handler);
}

const oldClick="onClick={()=>run('daily_claim',{},displayDay===7?'Week complete · ⭐ earned':'Daily WIENER claimed')}";
if(s.includes(oldClick))s=s.replace(oldClick,'onClick={claimDaily}');
if(s.includes('onClick={()=>setBioGate(true)}'))s=s.replace('onClick={()=>setBioGate(true)}','onClick={claimDaily}');
if(!s.includes('onClick={claimDaily}'))throw new Error('daily bio gate: claim button anchor missing');

s=s.replace('disabled={done} onClick={claimDaily}','disabled={done||bioChecking} onClick={claimDaily}');
s=s.replace("{done?`CLAIMED · WEEK ${displayWeek} DAY ${displayDay}`:displayDay===7?`CLAIM DAY 7 + ⭐ · ${money(reward)} WIENER`:`CLAIM ${money(reward)} WIENER`}","{done?`CLAIMED · WEEK ${displayWeek} DAY ${displayDay}`:bioChecking?'CHECKING BIO…':displayDay===7?`CLAIM DAY 7 + ⭐ · ${money(reward)} WIENER`:`CLAIM ${money(reward)} WIENER`}");

if(!s.includes('<DailyBioClaimGate open={bioGate}')){
  const tail='<div className="daily-loyalty">Complete 4 weekly streaks to unlock a Loyalty Chest automatically.</div></section>}';
  if(!s.includes(tail))throw new Error('daily bio gate: DailyCard tail anchor missing');
  const replacement='<div className="daily-loyalty">Complete 4 weekly streaks to unlock a Loyalty Chest automatically.</div><DailyBioClaimGate open={bioGate} data={data} run={run} onClose={()=>setBioGate(false)} successMessage={displayDay===7?\'Week complete · ⭐ earned\':\'Daily WIENER claimed\'}/></section>}';
  s=s.replace(tail,replacement);
}

fs.writeFileSync(p,s);
console.log('Daily referral bio claim gate wired');
