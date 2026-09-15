import fs from 'node:fs';

const file='src/WeeklyAdLeagueV88.tsx';
if(!fs.existsSync(file)){console.log('[league-timer] file not present; skip');process.exit(0)}
let s=fs.readFileSync(file,'utf8');
const old="const leftMs=(end?:string)=>end?Math.max(0,new Date(`${end}T00:00:00Z`).getTime()-Date.now()):0;";
const replacement=`const leftMs=(end?:string)=>{\n if(!end)return 0;\n const raw=String(end).trim();\n const dateOnly=/^\\d{4}-\\d{2}-\\d{2}$/.test(raw);\n const ts=Date.parse(dateOnly?raw+'T00:00:00Z':raw);\n return Number.isFinite(ts)?Math.max(0,ts-Date.now()):0;\n};`;
if(s.includes(old)){
 s=s.replace(old,replacement);
 fs.writeFileSync(file,s);
 console.log('[league-timer] fixed robust week_end parsing');
}else if(s.includes('const dateOnly=/^\\d{4}-\\d{2}-\\d{2}$/.test(raw);')){
 console.log('[league-timer] already fixed');
}else{
 throw new Error('[league-timer] expected timer anchor not found');
}
