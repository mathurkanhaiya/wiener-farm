import fs from 'node:fs';
const f='src/AdminHub.tsx';
let s=fs.readFileSync(f,'utf8');
if(!s.includes("./AdminV108Center")) s=s.replace("import {Splash} from './ui';", "import {Splash} from './ui';\nimport {AdminV108Center} from './AdminV108Center';");
s=s.replace("type MainTab='dashboard'|'users'|'content'|'money'|'system';", "type MainTab='dashboard'|'users'|'content'|'money'|'analytics'|'security'|'system';");
if(!s.includes("key:'analytics'")) s=s.replace(" {key:'money',icon:'₿',label:'Money'},", " {key:'money',icon:'₿',label:'Money'},\n {key:'analytics',icon:'▥',label:'Analytics'},\n {key:'security',icon:'🛡',label:'Security'},");
if(!s.includes("section=\"analytics\"")) s=s.replace("   {tab==='system'&&<SystemCenter", "   {tab==='analytics'&&<AdminV108Center data={d} section=\"analytics\"/>} \n   {tab==='security'&&<AdminV108Center data={d} section=\"security\"/>} \n   {tab==='system'&&<SystemCenter");
fs.writeFileSync(f,s);
console.log('Admin V108 safe integration ready');
