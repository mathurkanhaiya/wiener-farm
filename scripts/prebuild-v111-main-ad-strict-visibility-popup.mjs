import fs from 'node:fs';
const p='src/AdsPage.tsx';
const s=fs.readFileSync(p,'utf8');

// V113: main AdsGram no longer uses visibility/blur/click telemetry.
// Keep this legacy prebuild step as a safe no-op so older deployment chains continue to build.
// Reward credit still depends on the existing AdsGram show completion + server complete callback.
if(!s.includes("adApi('complete',{session_id:x.session_id} as any)")){
  throw new Error('V113 main AdsGram completion callback missing');
}
if(!s.includes('AdsGram — Unlimited')){
  throw new Error('V113 unlimited main AdsGram UI missing');
}
console.log('V113 main AdsGram full-reward/unlimited flow verified; legacy V111 visibility patch skipped');
