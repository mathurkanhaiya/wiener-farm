import fs from 'node:fs';

const p='src/AdsPage.tsx';
const s=fs.readFileSync(p,'utf8');

// Retired by V113. Full configured reward is handled by the current server callback.
// This prebuild intentionally performs no frontend mutation.
if(!s.includes("adApi('complete'")){
  throw new Error('Main AdsGram completion callback missing');
}
console.log('V110 legacy partial/full popup mutation retired by V113');
