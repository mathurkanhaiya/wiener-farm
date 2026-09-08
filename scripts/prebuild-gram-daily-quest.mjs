import fs from 'node:fs';

function patch(path,fn){const before=fs.readFileSync(path,'utf8');const after=fn(before);if(after!==before){fs.writeFileSync(path,after);console.log('GRAM quest patched',path)}else console.log('GRAM quest already wired',path)}

patch('src/lib.ts',s=>{
 if(!s.includes("export const GRAM_QUEST_API=edge('wiener-gram-quest');")){
  const a="export const AD_USAGE_API=edge('wiener-ad-usage');";
  if(!s.includes(a))throw new Error('AD_USAGE_API anchor missing');
  s=s.replace(a,a+"\nexport const GRAM_QUEST_API=edge('wiener-gram-quest');");
 }
 if(!s.includes('export async function gramQuestApi(')){
  const a='export async function promoChannelApi';
  if(!s.includes(a))throw new Error('promoChannelApi anchor missing');
  s=s.replace(a,"export async function gramQuestApi(action:'status'|'claim'){return post(GRAM_QUEST_API,action)}\n"+a);
 }
 return s;
});

patch('src/AdsPage.tsx',s=>{
 if(!s.includes("import {DailyGramQuest} from './DailyGramQuest';")){
  const a="import {SpinEarn} from './SpinEarn';";
  if(!s.includes(a))throw new Error('SpinEarn import anchor missing');
  s=s.replace(a,a+"\nimport {DailyGramQuest} from './DailyGramQuest';");
 }
 if(!s.includes('<DailyGramQuest refresh={refresh} say={say}/>')){
  const a='<div className="page-title"><h2>ADS TASK</h2></div><section className="card ad-card">';
  if(!s.includes(a))throw new Error('Ads render anchor missing');
  s=s.replace(a,'<div className="page-title"><h2>ADS TASK</h2></div><DailyGramQuest refresh={refresh} say={say}/><section className="card ad-card">');
 }
 return s;
});
