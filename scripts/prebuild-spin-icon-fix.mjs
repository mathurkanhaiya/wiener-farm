import fs from 'node:fs';

const p='src/SpinEarn.tsx';
if(!fs.existsSync(p)) process.exit(0);
let s=fs.readFileSync(p,'utf8');

// Use the requested hosted spin icon everywhere in Spin & Earn.
const NEW_SPIN_ICON='https://pixlinkhost.vercel.app/i/UuSYd47wng';
s=s.replace("const SPIN_ICON='https://pixlinkhost.vercel.app/i/b2gDIirJ5A';",`const SPIN_ICON='${NEW_SPIN_ICON}';`);
s=s.replace("const SPIN_ICON='/spin-wheel.png';",`const SPIN_ICON='${NEW_SPIN_ICON}';`);

// Keep circular clipping for a polished consistent icon treatment.
s=s.replace('.spin-balance img{width:19px;height:19px;object-fit:contain}', '.spin-balance img{width:19px;height:19px;object-fit:cover;border-radius:50%;clip-path:circle(48%);overflow:hidden}');
s=s.replace('.spin-segment img{width:21px;height:21px;object-fit:contain}', '.spin-segment img{width:21px;height:21px;object-fit:cover;border-radius:50%;clip-path:circle(48%);overflow:hidden}');
s=s.replace('.spin-hub img{width:46px;height:46px;object-fit:contain}', '.spin-hub img{width:46px;height:46px;object-fit:cover;border-radius:50%;clip-path:circle(48%);overflow:hidden}');
s=s.replace('.spin-win img{width:44px;height:44px;object-fit:contain}', '.spin-win img{width:44px;height:44px;object-fit:cover;border-radius:50%;clip-path:circle(48%);overflow:hidden}');

fs.writeFileSync(p,s);
