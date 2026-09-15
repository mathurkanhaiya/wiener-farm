import fs from 'node:fs';

const path='src/WithdrawV3.tsx';
let s=fs.readFileSync(path,'utf8');
const before=s;

s=s.replace("const WIENER_PER_USDT=15000;\n",'');
s=s.replace(
  "export function WalletV2({data}:{data:Snapshot;setTab:any}){\n const preloaded=Array.isArray(data.withdrawal_methods)?data.withdrawal_methods as Method[]:[];",
  "export function WalletV2({data}:{data:Snapshot;setTab:any}){\n const WIENER_PER_USDT=Math.max(1,Number(data.settings?.token_per_usdt||10000));\n const preloaded=Array.isArray(data.withdrawal_methods)?data.withdrawal_methods as Method[]:[];"
);
s=s.replace('<strong>15,000 = 1 USDT</strong>',"<strong>{money(WIENER_PER_USDT)} = 1 USDT</strong>");

if(s===before){
  console.log('[dynamic-wiener-rate] no changes needed');
}else{
  fs.writeFileSync(path,s);
  console.log('[dynamic-wiener-rate] WithdrawV3 now uses live token_per_usdt');
}

if(/const WIENER_PER_USDT=15000/.test(s)||/>15,000 = 1 USDT</.test(s)){
  throw new Error('dynamic WIENER rate patch verification failed');
}
