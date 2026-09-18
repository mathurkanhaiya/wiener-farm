import fs from 'node:fs';

const p='src/AdsPage.tsx';
const s=fs.readFileSync(p,'utf8');

// Retired by V113: no visibility-loss requirement and no legacy result popup.
if(!s.includes("adApi('complete'")){
  throw new Error('Main AdsGram completion callback missing');
}
console.log('V111 legacy visibility/popup mutation retired by V113');
