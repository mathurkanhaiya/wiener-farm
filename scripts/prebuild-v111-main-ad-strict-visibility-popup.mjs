import fs from 'node:fs';
const p='src/AdsPage.tsx';
const s=fs.readFileSync(p,'utf8');

// Legacy V111 prebuild must not mutate or reject the V113 flow.
// V113 is applied by its installer after checkout; earlier prebuilds may rewrite display text,
// so only verify the invariant that reward completion still goes through the server callback.
if(!s.includes("adApi('complete',{session_id:x.session_id} as any)")){
  throw new Error('V113 main AdsGram completion callback missing');
}
if(s.includes('visitMs>=3000') || s.includes('interaction_ms:visitMs')){
  throw new Error('Legacy V111 3-second visibility logic unexpectedly returned');
}
console.log('V113 AdsGram callback flow verified; legacy V111 visibility patch skipped');
