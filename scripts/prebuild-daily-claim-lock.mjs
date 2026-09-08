import fs from 'node:fs';

const file='src/pages.tsx';
if(!fs.existsSync(file)) throw new Error(`Missing ${file}`);
let s=fs.readFileSync(file,'utf8');
const MARK='DAILY_CLAIM_LOCK_COUNTDOWN_V74';

if(s.includes(MARK)){
  console.log('Daily claim lock countdown already applied');
  process.exit(0);
}

// DailyBioClaimGate runs before this patch and adds its own state to DailyCard.
// Patch the current function shape instead of depending on one exact old string.
const fn=/function DailyCard\(\{data,run\}:\{data:Snapshot;run:any\}\)\{const ([\s\S]*?),u:any=data\.user,/;
const match=s.match(fn);
if(!match) throw new Error('Daily claim lock anchor missing: DailyCard state');
let state=match[1];
if(!state.includes('[clock,setClock]')) state=`${state},[clock,setClock]=useState(Date.now())`;
s=s.replace(fn,`function DailyCard({data,run}:{data:Snapshot;run:any}){const ${state},u:any=data.user,`);

const handlerAnchor='const claimDaily=async()=>';
const pos=s.indexOf(handlerAnchor);
if(pos<0) throw new Error('Daily claim lock anchor missing: claimDaily handler');
const timerCode=`useEffect(()=>{if(!done)return;const x=window.setInterval(()=>setClock(Date.now()),1000);return()=>window.clearInterval(x)},[done]);const nextReset=Date.UTC(new Date(clock).getUTCFullYear(),new Date(clock).getUTCMonth(),new Date(clock).getUTCDate()+1),left=Math.max(0,nextReset-clock),sec=Math.ceil(left/1000),hh=Math.floor(sec/3600),mm=Math.floor(sec%3600/60),ss=sec%60,claimLockText=\`🔒 CLAIMED · NEXT IN \${String(hh).padStart(2,'0')}:\${String(mm).padStart(2,'0')}:\${String(ss).padStart(2,'0')}\`;/* ${MARK} */`;
s=s.slice(0,pos)+timerCode+s.slice(pos);

const label=/\{done\?`CLAIMED · WEEK \$\{displayWeek\} DAY \$\{displayDay\}`:/;
if(!label.test(s)) throw new Error('Daily claim lock anchor missing: button label');
s=s.replace(label,'{done?claimLockText:');

fs.writeFileSync(file,s);
console.log('Daily Bonus now locks after claim and shows live reset countdown');
