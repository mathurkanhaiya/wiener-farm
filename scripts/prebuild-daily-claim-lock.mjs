import fs from 'node:fs';

const file='src/pages.tsx';
if(!fs.existsSync(file)) throw new Error(`Missing ${file}`);
let s=fs.readFileSync(file,'utf8');
const MARK='DAILY_CLAIM_LOCK_COUNTDOWN_V74';

if(s.includes(MARK)){
  console.log('Daily claim lock countdown already applied');
  process.exit(0);
}

const head="function DailyCard({data,run}:{data:Snapshot;run:any}){const u:any=data.user,{done,currentDay,currentWeek,nextDay,nextWeek,multiplier,reward,stars}=nextDaily(data),displayDay=done?Math.max(1,currentDay):nextDay,displayWeek=done?currentWeek:nextWeek,starSlots=[0,1,2,3];return <section";
if(!s.includes(head)) throw new Error('Daily claim lock anchor missing: DailyCard head');

const replacement="function DailyCard({data,run}:{data:Snapshot;run:any}){const u:any=data.user,[clock,setClock]=useState(Date.now()),{done,currentDay,currentWeek,nextDay,nextWeek,multiplier,reward,stars}=nextDaily(data),displayDay=done?Math.max(1,currentDay):nextDay,displayWeek=done?currentWeek:nextWeek,starSlots=[0,1,2,3];useEffect(()=>{if(!done)return;const x=window.setInterval(()=>setClock(Date.now()),1000);return()=>window.clearInterval(x)},[done]);const nextReset=Date.UTC(new Date(clock).getUTCFullYear(),new Date(clock).getUTCMonth(),new Date(clock).getUTCDate()+1),left=Math.max(0,nextReset-clock),sec=Math.ceil(left/1000),hh=Math.floor(sec/3600),mm=Math.floor(sec%3600/60),ss=sec%60,claimLockText=`🔒 CLAIMED · NEXT IN ${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;/* ${MARK} */return <section";
s=s.replace(head,replacement);

const oldButton="{done?`CLAIMED · WEEK ${displayWeek} DAY ${displayDay}`:displayDay===7?`CLAIM DAY 7 + ⭐ · ${money(reward)} WIENER`:`CLAIM ${money(reward)} WIENER`}";
if(!s.includes(oldButton)) throw new Error('Daily claim lock anchor missing: button label');
s=s.replace(oldButton,"{done?claimLockText:displayDay===7?`CLAIM DAY 7 + ⭐ · ${money(reward)} WIENER`:`CLAIM ${money(reward)} WIENER`}");

fs.writeFileSync(file,s);
console.log('Daily Bonus now locks after claim and shows live reset countdown');
