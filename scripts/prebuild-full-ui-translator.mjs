import fs from 'node:fs';

const translator='src/FullUiTranslator.tsx';
const app='src/App.tsx';
if(!fs.existsSync(translator)||!fs.existsSync(app))throw new Error('Full UI translator files missing');
let tr=fs.readFileSync(translator,'utf8');
tr=tr.replace("const originalPlaceholder=new WeakMap<HTMLInputElement|string extends never?never:any,string>();\n",'');
fs.writeFileSync(translator,tr);

let s=fs.readFileSync(app,'utf8');
const imp="import {FullUiTranslator} from './FullUiTranslator';";
if(!s.includes(imp)){
 const anchor="import {RestrictedSticker} from './RestrictedSticker';";
 if(!s.includes(anchor))throw new Error('Full UI translator import anchor missing');
 s=s.replace(anchor,`${anchor}\n${imp}`);
}
if(!s.includes('<FullUiTranslator/>')){
 const anchor='return <div className="app-shell"><EconomyUiPatch/>';
 if(!s.includes(anchor))throw new Error('Full UI translator mount anchor missing');
 s=s.replace(anchor,'return <div className="app-shell"><FullUiTranslator/><EconomyUiPatch/>');
}
fs.writeFileSync(app,s);
console.log('Full UI translator wired');
