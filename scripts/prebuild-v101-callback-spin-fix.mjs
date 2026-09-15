import fs from 'node:fs';

function patch(path, oldText, newText, label){
  let s=fs.readFileSync(path,'utf8');
  if(s.includes(newText)){console.log(`V101 ${label}: already applied`);return;}
  if(!s.includes(oldText))throw new Error(`V101 anchor missing: ${label}`);
  s=s.replace(oldText,newText);
  fs.writeFileSync(path,s);
  console.log(`V101 ${label}: applied`);
}

function patchOptional(path, oldText, newText, label, appliedMarker=''){
  let s=fs.readFileSync(path,'utf8');
  if((appliedMarker&&s.includes(appliedMarker))||s.includes(newText)){console.log(`V101 ${label}: already applied`);return;}
  if(!s.includes(oldText)){console.log(`V101 ${label}: skipped (feature not present)`);return;}
  s=s.replace(oldText,newText);
  fs.writeFileSync(path,s);
  console.log(`V101 ${label}: applied`);
}

// AdsGram Reward URL is delivered server-to-server and can arrive a little
// after AdsGram's client show()/reward event. Never bypass verification:
// retry the same single-use session briefly while the callback arrives.
patchOptional('src/AdsPage.tsx',
"const st=await adApi('complete',{session_id:x.session_id,interacted:visited5s} as any);if(st?.status!=='credited')throw Error('Reward could not be credited');",
"let st:any=null,lastErr:any=null;for(let attempt=0;attempt<10;attempt++){try{st=await adApi('complete',{session_id:x.session_id} as any);lastErr=null;break}catch(e:any){lastErr=e;const m=String(e?.message||e||'');if(!/not verified|verification|callback|verified/i.test(m))throw e;if(attempt<9)await sleep(500)}}if(lastErr)throw lastErr;if(st?.status!=='credited')throw Error('Reward could not be credited');",
'main callback wait',
"for(let attempt=0;attempt<10;attempt++){try{st=await adApi('complete'"
);

patchOptional('src/AdsPage.tsx',
"const st:any=await secondaryAdApi('reward',{session_id:x.session_id,interacted:visited5s} as any);",
"let st:any=null,lastErr:any=null;for(let attempt=0;attempt<10;attempt++){try{st=await secondaryAdApi('reward',{session_id:x.session_id} as any);lastErr=null;break}catch(e:any){lastErr=e;const m=String(e?.message||e||'');if(!/not verified|verification|callback|verified/i.test(m))throw e;if(attempt<9)await sleep(500)}}if(lastErr)throw lastErr;",
'farm callback wait',
"for(let attempt=0;attempt<10;attempt++){try{st=await secondaryAdApi('reward'"
);

// V100 backend accepts only a fresh server-issued single-use spin token.
// Request it immediately before the spin; do not generate authorization in browser.
patchOptional('src/SpinEarn.tsx',
"const key=crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`;const x:Prize=await spinApi('spin',{idempotency_key:key});",
"const auth:any=await spinApi('spin_start');const token=String(auth?.spin_token||'');if(!/^[0-9a-f]{64}$/i.test(token))throw new Error('Could not authorize spin');const x:Prize=await spinApi('spin',{spin_token:token});",
'spin server authorization',
"const auth:any=await spinApi('spin_start')"
);

// Sponsored AdsGram task UI was intentionally removed. If an older checkout still
// contains it, keep its callback-race hardening; otherwise skip without failing build.
patchOptional('src/TasksPage.tsx',
"const x=await adsgramTaskApi('reward',{session_id:session.session_id});if(!active)return;",
"let x:any=null,lastErr:any=null;for(let attempt=0;attempt<10;attempt++){try{x=await adsgramTaskApi('reward',{session_id:session.session_id});lastErr=null;break}catch(e:any){lastErr=e;const m=String(e?.message||e||'');if(!/not verified|verification|callback|verified/i.test(m))throw e;if(attempt<9)await new Promise(r=>setTimeout(r,500))}}if(lastErr)throw lastErr;if(!active)return;",
'task callback wait',
"for(let attempt=0;attempt<10;attempt++){try{x=await adsgramTaskApi('reward'"
);

console.log('V101 callback/spin frontend hardening complete');
