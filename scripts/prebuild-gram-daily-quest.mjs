import fs from 'node:fs';

function patch(path,fn){const before=fs.readFileSync(path,'utf8');const after=fn(before);if(after!==before){fs.writeFileSync(path,after);console.log('Limited GRAM task patched',path)}else console.log('Limited GRAM task already wired',path)}

patch('src/DailyGramQuest.tsx',s=>{
 if(!s.includes("import './gram-quest.css';")){
  const a="import {getInitData,PUBLISHABLE_KEY} from './lib';";
  if(!s.includes(a))throw new Error('GRAM quest lib import anchor missing');
  s=s.replace(a,a+"\nimport './gram-quest.css';");
 }
 return s;
});

patch('src/AdsPage.tsx',s=>{
 if(!s.includes("import {DailyGramQuest} from './DailyGramQuest';")){
  const a="import {SpinEarn} from './SpinEarn';";
  if(!s.includes(a))throw new Error('SpinEarn import anchor missing');
  s=s.replace(a,a+"\nimport {DailyGramQuest} from './DailyGramQuest';");
 }
 // Remove the old V79 placement if a previous build already patched the source.
 s=s.replace('<div className="page-title"><h2>ADS TASK</h2></div><DailyGramQuest refresh={refresh} say={say}/><section className="card ad-card">','<div className="page-title"><h2>ADS TASK</h2></div><section className="card ad-card">');
 if(!s.includes('<DailyGramQuest refresh={refresh} say={say}/><SpinEarn refresh={refresh} say={say}/>')){
  const a='<SpinEarn refresh={refresh} say={say}/>';
  if(!s.includes(a))throw new Error('SpinEarn render anchor missing');
  s=s.replace(a,'<DailyGramQuest refresh={refresh} say={say}/>'+a);
 }
 return s;
});
