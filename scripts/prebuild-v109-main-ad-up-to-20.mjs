import fs from 'node:fs';

const p='src/AdsPage.tsx';
const s=fs.readFileSync(p,'utf8');

// Retired by V113.
// Main AdsGram is now unlimited and uses the verified AdsGram completion callback.
// Do not re-inject daily-limit UI, visibility tracking, or completion popups.
if(!s.includes("adApi('complete'")){
  throw new Error('Main AdsGram completion callback missing');
}
console.log('V109 legacy main-ad mutation retired by V113');
