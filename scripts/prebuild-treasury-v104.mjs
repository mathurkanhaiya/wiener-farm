import fs from 'node:fs';
const p='src/AdsPage.tsx';
const original=fs.readFileSync(p,'utf8');
let s=original;
if(!s.includes("from './TreasuryEarn'")){
 const anchor="import {SpinEarn} from './SpinEarn';";
 if(!s.includes(anchor))throw new Error('V104 Treasury import anchor missing');
 s=s.replace(anchor,anchor+"\nimport {TreasuryEarn} from './TreasuryEarn';");
}
if(!s.includes('<TreasuryEarn refresh={refresh} say={say}/>')){
 const anchor='<SpinEarn refresh={refresh} say={say}/>';
 if(!s.includes(anchor))throw new Error('V104 Treasury Earn anchor missing');
 s=s.replace(anchor,anchor+'<TreasuryEarn refresh={refresh} say={say}/>');
}
if(s!==original)fs.writeFileSync(p,s);

// Keep Treasury visually consistent with Spin & Earn and isolate its click from legacy handlers.
const tp='src/TreasuryEarn.tsx';
if(fs.existsSync(tp)){
 let t=fs.readFileSync(tp,'utf8');
 t=t.replace('onClick={()=>setOpen(true)} onKeyDown={e=>{if(e.key===\'Enter\'||e.key===\' \'){e.preventDefault();setOpen(true)}}}',"onClick={e=>{e.preventDefault();e.stopPropagation();setOpen(true)}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();setOpen(true)}}}");
 t=t.replace('.wf-treasury-card{position:relative;overflow:hidden;cursor:pointer!important;margin:12px 0 0!important;padding:18px!important;', '.wf-treasury-card{position:relative;overflow:hidden;cursor:pointer!important;margin:12px 0 0!important;padding:20px!important;');
 t=t.replace('.wf-treasury-row{display:grid;grid-template-columns:64px 1fr auto;align-items:center;gap:13px}', '.wf-treasury-row{display:grid;grid-template-columns:72px minmax(0,1fr);align-items:center;gap:16px}');
 t=t.replace('.wf-treasury-icon{width:64px;height:64px;', '.wf-treasury-icon{width:72px;height:72px;');
 t=t.replace('.wf-treasury-copy h3{margin:0;font-size:19px}', '.wf-treasury-copy h3{margin:0;font-size:20px;font-weight:950;letter-spacing:-.45px}');
 t=t.replace('.wf-treasury-copy p{margin:4px 0 0;color:#b8b9ac;font-size:11px;line-height:1.45}', '.wf-treasury-copy p{margin:5px 0 0;color:#b8b9ac;font-size:12px;line-height:1.45}');
 t=t.replace('.wf-treasury-go{width:38px;height:38px;border-radius:13px;display:grid;place-items:center;background:#ffd05012;border:1px solid #ffd05030;color:#ffd76d;font-size:23px}', '.wf-treasury-go{grid-column:1/-1;width:100%;height:46px;border-radius:14px;display:grid;place-items:center;background:#ffc34a12;border:1px solid #ffd28345;color:#ffd283;font-size:0;font-weight:950;margin-top:3px}.wf-treasury-go:after{content:"OPEN";font-size:13px;letter-spacing:.04em}');
 t=t.replace('.wf-treasury-tags{display:flex;gap:7px;flex-wrap:wrap;margin-top:13px}', '.wf-treasury-tags{display:flex;gap:7px;flex-wrap:wrap;margin-top:14px;padding-top:14px;border-top:1px solid #ffffff0b}');
 t=t.replace('<div className="wf-treasury-go">›</div></div><div className="wf-treasury-tags">', '</div><div className="wf-treasury-go">›</div><div className="wf-treasury-tags">');
 fs.writeFileSync(tp,t);
}
console.log('V104 secure Wiener Treasury UI restored under Earn');
