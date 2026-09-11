import fs from 'node:fs';

const file='src/App.tsx';
let s=fs.readFileSync(file,'utf8');
const marker='WIENER V2 ADMIN TESTING V92';
if(s.includes(marker)){
  console.log('V92 V2 admin testing already patched');
  process.exit(0);
}

const importAnchor="import {RestrictedSticker} from './RestrictedSticker';";
if(!s.includes(importAnchor))throw new Error('V92 import anchor not found');
s=s.replace(importAnchor,`${importAnchor}\nimport {V2App} from './v2/V2App';\n// ${marker}`);

const stateAnchor="const [tab,setTab]=useState<Tab>('home'),[data,setData]=useState<Snapshot|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[toast,setToast]=useState(''),[mandatory,setMandatory]=useState<any>(null),[multiBlocked,setMultiBlocked]=useState(false),[farmClaimOpen,setFarmClaimOpen]=useState(false);const openedSent=useRef(false),openAdShown=useRef(false);";
if(!s.includes(stateAnchor))throw new Error('V92 state anchor not found');
const stateReplacement="const [tab,setTab]=useState<Tab>('home'),[data,setData]=useState<Snapshot|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[toast,setToast]=useState(''),[mandatory,setMandatory]=useState<any>(null),[multiBlocked,setMultiBlocked]=useState(false),[farmClaimOpen,setFarmClaimOpen]=useState(false),[v2Testing,setV2Testing]=useState(()=>new URLSearchParams(window.location.search).get('v2')==='1');const openedSent=useRef(false),openAdShown=useRef(false);";
s=s.replace(stateAnchor,stateReplacement);

const gateAnchor="return <div className=\"app-shell\"><EconomyUiPatch/>";
if(!s.includes(gateAnchor))throw new Error('V92 render anchor not found');
const gate=`if(data.is_admin&&v2Testing)return <V2App data={data} refresh={refresh} say={say} run={run} runFarm={runFarm} onExit={()=>{setV2Testing(false);try{const u=new URL(window.location.href);u.searchParams.delete('v2');window.history.replaceState({},'',u.toString())}catch{}}}/>;\n ${gateAnchor}`;
s=s.replace(gateAnchor,gate);

const adminAnchor="{tab==='admin'&&data.is_admin&&<><AdminBoundary name=\"Admin Control Center\"><AdminHub say={say}/></AdminBoundary>";
if(!s.includes(adminAnchor))throw new Error('V92 admin anchor not found');
const adminCard=`{tab==='admin'&&data.is_admin&&<><section className=\"card\" style={{marginBottom:12,border:'1px solid rgba(52,210,111,.22)',background:'linear-gradient(145deg,rgba(25,120,70,.18),rgba(255,255,255,.025))'}}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}><div><div className=\"eyebrow\">ADMIN ONLY · V2</div><h3 style={{margin:'4px 0'}}>🧪 Mini App V2 Testing</h3><p style={{margin:0,fontSize:11,opacity:.58}}>Private V2 preview. Normal users stay on the current V1 app.</p></div><button className=\"secondary\" style={{width:'auto',minWidth:112}} onClick={()=>{setV2Testing(true);try{const u=new URL(window.location.href);u.searchParams.set('v2','1');window.history.replaceState({},'',u.toString())}catch{}}}>OPEN V2</button></div></section><AdminBoundary name=\"Admin Control Center\"><AdminHub say={say}/></AdminBoundary>`;
s=s.replace(adminAnchor,adminCard);

fs.writeFileSync(file,s);
console.log('V92 admin-only V2 testing patch applied');
