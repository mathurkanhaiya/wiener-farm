import fs from 'node:fs';

const file='src/Ambassador.tsx';
if(!fs.existsSync(file))throw new Error(`Missing ${file}`);
const s=fs.readFileSync(file,'utf8');

// V72 frontend mutation is performed exactly once by the VPS Python patch.
// The build step only verifies that the installed source contains the feature.
const required=[
  'weekly_prizes_enabled',
  'TURN WEEKLY PRIZES OFF',
  'Weekly prizes are paused'
];
const missing=required.filter(x=>!s.includes(x));
if(missing.length){
  throw new Error(`Ambassador weekly prize toggle not installed before build: ${missing.join(', ')}`);
}
if(s.includes('prizesEnabled?{prizesEnabled?')){
  throw new Error('Ambassador weekly prize toggle duplicate JSX detected');
}
console.log('Ambassador weekly prize toggle verified');
