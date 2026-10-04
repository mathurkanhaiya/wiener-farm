#!/usr/bin/env bash
set -Eeuo pipefail
CODE=/opt/wiener-code
BACKEND_DIR=/opt/wiener-backend
BACKEND="$BACKEND_DIR/server.mjs"
[[ -f "$BACKEND" ]] || BACKEND="$BACKEND_DIR/server.js"
DB=wiener_farm_final
PM2_APP=wiener-api
[[ -f "$BACKEND" ]] || { echo "ERROR: backend not found"; exit 1; }
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$BACKEND.v121-bsc-$STAMP.bak"
cp -a "$BACKEND" "$BACKUP"
rollback(){ rc=$?; if ((rc!=0)); then cp -a "$BACKUP" "$BACKEND" || true; pm2 restart "$PM2_APP" --update-env >/dev/null 2>&1 || true; fi; exit "$rc"; }
trap rollback EXIT
cd "$BACKEND_DIR"
node -e "import('ethers').then(()=>process.exit(0)).catch(()=>process.exit(1))" || npm install --no-audit --no-fund ethers@6.15.0
touch "$BACKEND_DIR/.env"; chmod 600 "$BACKEND_DIR/.env"
grep -q '^BSC_RPC_URL=' "$BACKEND_DIR/.env" || echo 'BSC_RPC_URL=https://bsc-dataseed.bnbchain.org' >> "$BACKEND_DIR/.env"
grep -q '^BSC_CHAIN_ID=' "$BACKEND_DIR/.env" || echo 'BSC_CHAIN_ID=56' >> "$BACKEND_DIR/.env"
grep -q '^BSC_EXPLORER_URL=' "$BACKEND_DIR/.env" || echo 'BSC_EXPLORER_URL=https://bscscan.com' >> "$BACKEND_DIR/.env"
grep -q '^BSC_USDT_CONTRACT=' "$BACKEND_DIR/.env" || echo 'BSC_USDT_CONTRACT=0x55d398326f99059fF775485246999027B3197955' >> "$BACKEND_DIR/.env"
grep -q '^BSC_TREASURY_ADDRESS=' "$BACKEND_DIR/.env" || echo 'BSC_TREASURY_ADDRESS=' >> "$BACKEND_DIR/.env"
grep -q '^BSC_TREASURY_PRIVATE_KEY=' "$BACKEND_DIR/.env" || echo 'BSC_TREASURY_PRIVATE_KEY=' >> "$BACKEND_DIR/.env"
runuser -u postgres -- psql -d "$DB" -v ON_ERROR_STOP=1 <<'SQL'
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS public.bsc_payout_attempts(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), withdrawal_id uuid NOT NULL UNIQUE REFERENCES public.withdrawals(id) ON DELETE CASCADE,
 chain_id integer NOT NULL DEFAULT 56, network text NOT NULL DEFAULT 'BEP20', asset text NOT NULL DEFAULT 'USDT',
 token_contract text NOT NULL, recipient text NOT NULL, amount_usdt numeric(30,18) NOT NULL, amount_base_units text NOT NULL,
 token_decimals integer NOT NULL, nonce bigint, gas_limit numeric(30,0), gas_price_wei text, raw_tx text, tx_hash text UNIQUE,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','signing','signed','broadcasted','confirmed','failed','cancelled')),
 error text, created_at timestamptz NOT NULL DEFAULT now(), processing_at timestamptz, broadcast_at timestamptz,
 confirmed_at timestamptz, failed_at timestamptz, refunded_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bsc_payout_attempts_state_idx ON public.bsc_payout_attempts(state,created_at);
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS bsc_rpc_url text;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS bsc_chain_id integer NOT NULL DEFAULT 56;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS bsc_network_name text NOT NULL DEFAULT 'BSC Mainnet / BEP20';
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS bsc_explorer_url text NOT NULL DEFAULT 'https://bscscan.com';
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS bsc_usdt_contract text NOT NULL DEFAULT '0x55d398326f99059fF775485246999027B3197955';
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS bsc_treasury_address text;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS bsc_treasury_enabled boolean NOT NULL DEFAULT true;
DO $$
BEGIN
 IF to_regclass('public.withdrawal_methods') IS NOT NULL THEN
  IF NOT EXISTS(SELECT 1 FROM public.withdrawal_methods WHERE method_key='usdt_bep20') THEN
   UPDATE public.withdrawal_methods SET method_key='usdt_bep20' WHERE method_key ILIKE '%usdt%' AND NOT EXISTS(SELECT 1 FROM public.withdrawal_methods WHERE method_key='usdt_bep20');
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.withdrawal_methods WHERE method_key='usdt_bep20') THEN
   INSERT INTO public.withdrawal_methods(method_key,label,network,enabled,minimum_usdt,fee_usdt,sort_order) VALUES('usdt_bep20','USDT (BEP20)','BEP20',true,0.03,0.01,10);
  END IF;
  UPDATE public.withdrawal_methods SET label='USDT (BEP20)',network='BEP20',enabled=true,minimum_usdt=0.03,fee_usdt=0.01,sort_order=10 WHERE method_key='usdt_bep20';
 END IF;
END $$;
UPDATE public.app_settings SET bsc_rpc_url=COALESCE(NULLIF(bsc_rpc_url,''),'https://bsc-dataseed.bnbchain.org'),bsc_chain_id=56,bsc_network_name='BSC Mainnet / BEP20',bsc_explorer_url='https://bscscan.com',bsc_usdt_contract='0x55d398326f99059fF775485246999027B3197955' WHERE id=true;
SQL
cat > /tmp/wiener-v121-bsc.py <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1]); s=p.read_text()
TAG="WIENER BSC TREASURY V121"
if TAG in s: raise SystemExit("V121 already installed")
anchor="app.post('/functions/v1/wiener-withdraw'"
if anchor not in s: raise SystemExit("ERROR: wiener-withdraw route anchor not found")
code=r'''
// === WIENER BSC TREASURY V121 ===
const BSC_RPC_V121="https://bsc-dataseed.bnbchain.org";
const BSC_USDT_V121="0x55d398326f99059fF775485246999027B3197955";
const BSC_EXPLORER_V121="https://bscscan.com";
const BSC_ABI_V121=["function balanceOf(address) view returns (uint256)","function decimals() view returns (uint8)","function symbol() view returns (string)","function transfer(address,uint256) returns (bool)"];
let bscCacheV121=null;
async function bscInitV121(){
 const {ethers}=await import("ethers"),rpc=String(process.env.BSC_RPC_URL||BSC_RPC_V121),token=ethers.getAddress(String(process.env.BSC_USDT_CONTRACT||BSC_USDT_V121)),pk=String(process.env.BSC_TREASURY_PRIVATE_KEY||"").trim(),address=String(process.env.BSC_TREASURY_ADDRESS||"").trim();
 if(Number(process.env.BSC_CHAIN_ID||56)!==56||!pk||!ethers.isAddress(address))throw new Error("bsc_treasury_not_configured");
 const provider=new ethers.JsonRpcProvider(rpc,56,{staticNetwork:true}),net=await provider.getNetwork();if(Number(net.chainId)!==56)throw new Error("bsc_rpc_wrong_chain");
 const signer=new ethers.Wallet(pk,provider);if(ethers.getAddress(signer.address)!==ethers.getAddress(address))throw new Error("bsc_treasury_key_address_mismatch");
 const contract=new ethers.Contract(token,BSC_ABI_V121,signer);return{ethers,provider,signer,contract,address,token};
}
async function bscStatusV121(){
 try{const x=await bscInitV121(),[bnb,tok,dec,sym]=await Promise.all([x.provider.getBalance(x.address),x.contract.balanceOf(x.address),x.contract.decimals(),x.contract.symbol()]);return{ready:true,network:"BEP20",network_name:"BSC Mainnet / BEP20",chain_id:56,treasury_address:x.address,usdt_contract:x.token,usdt_decimals:Number(dec),usdt_symbol:String(sym||"USDT"),bnb_balance:x.ethers.formatEther(bnb),usdt_balance:x.ethers.formatUnits(tok,Number(dec)),explorer_url:BSC_EXPLORER_V121}}catch(e){return{ready:false,network:"BEP20",network_name:"BSC Mainnet / BEP20",chain_id:56,treasury_address:String(process.env.BSC_TREASURY_ADDRESS||""),usdt_contract:String(process.env.BSC_USDT_CONTRACT||BSC_USDT_V121),explorer_url:BSC_EXPLORER_V121,error:String(e?.message||e)}}}
function bscUnitsV121(raw,d){const s=String(raw).trim(),q=s.split(".");if(!/^\d+(\.\d+)?$/.test(s))throw new Error("invalid_usdt_amount");const f=q[1]||"";if(f.length>d&&/[^0]/.test(f.slice(d)))throw new Error("usdt_precision_too_high");return BigInt(q[0])*(10n**BigInt(d))+BigInt((f+"0".repeat(d)).slice(0,d)||"0")}
async function bscCreateV121(req,res){
 const b=req.body||{},u=await edgeUser(b),uid=Number(u?.id||0);if(String(b.method_key||"")!=="usdt_bep20")return false;
 const {ethers}=await import("ethers"),wallet=String(b.wallet||"").trim();if(!ethers.isAddress(wallet))throw new Error("invalid_bsc_wallet");
 const amountW=String(b.amount_wiener??"").trim();if(!/^\d+$/.test(amountW)||BigInt(amountW)<=0n)throw new Error("invalid_amount");
 const c=await pool.connect();try{
  await c.query("begin");const st=(await c.query("select * from public.app_settings where id=true limit 1")).rows[0]||{};if(st.withdrawals_enabled===false)throw new Error("withdrawals_disabled");
  const rate=BigInt(String(st.token_per_usdt||"25000")),gross6=(BigInt(amountW)*1000000n)/rate,gross=String(gross6/1000000n)+"."+String(gross6%1000000n).padStart(6,"0").replace(/0+$/,""),m=(await c.query("select * from public.withdrawal_methods where method_key='usdt_bep20' and enabled=true limit 1")).rows[0];if(!m)throw new Error("withdraw_method_disabled");
  const min=String(m.minimum_usdt||"0.03"),fee=String(m.fee_usdt||"0.01");if(Number(gross)<Number(min))throw new Error("below_minimum");if(Number(gross)<=Number(fee))throw new Error("amount_below_fee");
  if((await c.query("select 1 from public.withdrawals where telegram_id=$1 and status in ('pending','processing') limit 1",[uid])).rowCount)throw new Error("withdrawal_already_pending");
  const user=(await c.query("select telegram_id,balance from public.users where telegram_id=$1 for update",[uid])).rows[0];if(!user)throw new Error("user_not_found");if(BigInt(String(user.balance||"0").split(".")[0])<BigInt(amountW))throw new Error("insufficient_balance");
  const receive6=gross6-BigInt(Math.round(Number(fee)*1000000));if(receive6<=0n)throw new Error("amount_below_fee");const receive=String(receive6/1000000n)+"."+String(receive6%1000000n).padStart(6,"0").replace(/0+$/,"");
  const ins=await c.query("insert into public.withdrawals(telegram_id,method_key,amount_farm,gross_usdt,fee_usdt,receive_usdt,network,wallet_address,status,created_at) values($1,'usdt_bep20',$2,$3,$4,$5,'BEP20',$6,'pending',now()) returning *",[uid,amountW,gross,fee,receive,ethers.getAddress(wallet)]);
  await c.query("update public.users set balance=balance-$2 where telegram_id=$1",[uid]);await c.query("commit");return res.json({ok:true,data:{withdrawal:ins.rows[0],balance:Number(user.balance)-Number(amountW)}});
 }catch(e){await c.query("rollback").catch(()=>{});throw e}finally{c.release()}
}
async function bscFinalizeV121(a,r){
 const c=await pool.connect();try{await c.query("begin");const row=(await c.query("select * from public.bsc_payout_attempts where id=$1 for update",[a.id])).rows[0];if(!row||["confirmed","failed"].includes(String(row.state))){await c.query("commit");return}
 if(Number(r.status)===1){await c.query("update public.bsc_payout_attempts set state='confirmed',confirmed_at=now(),updated_at=now() where id=$1",[row.id]);await c.query("update public.withdrawals set status='paid',tx_hash=$2,explorer_url=$3,processed_at=coalesce(processed_at,now()) where id=$1 and status<>'paid'",[row.withdrawal_id,row.tx_hash,BSC_EXPLORER_V121+"/tx/"+row.tx_hash])}
 else{const q=await c.query("update public.withdrawals set status='failed',processed_at=coalesce(processed_at,now()) where id=$1 and status<>'paid' returning telegram_id,amount_farm",[row.withdrawal_id]);await c.query("update public.bsc_payout_attempts set state='failed',error='bsc_transaction_reverted',failed_at=now(),updated_at=now() where id=$1",[row.id]);if(q.rowCount&&!row.refunded_at){await c.query("update public.users set balance=coalesce(balance,0)+$2 where telegram_id=$1",[q.rows[0].telegram_id,q.rows[0].amount_farm]);await c.query("update public.bsc_payout_attempts set refunded_at=now() where id=$1",[row.id])}}await c.query("commit")}catch(e){await c.query("rollback").catch(()=>{});throw e}finally{c.release()}
}
async function bscProcessV121(id){
 const x=await bscInitV121(),c=await pool.connect();try{
  await c.query("begin");const w=(await c.query("select * from public.withdrawals where id=$1 and method_key='usdt_bep20' and status in ('pending','processing') for update",[id])).rows[0];if(!w){await c.query("rollback");return}let a=(await c.query("select * from public.bsc_payout_attempts where withdrawal_id=$1 for update",[id])).rows[0];await c.query("commit");
  if(a?.tx_hash){const r=await x.provider.getTransactionReceipt(a.tx_hash);if(r)await bscFinalizeV121(a,r);return}
  const d=Number(await x.contract.decimals()),units=bscUnitsV121(String(w.receive_usdt),d),fd=await x.provider.getFeeData(),gasPrice=fd.gasPrice||fd.maxFeePerGas;if(!gasPrice)throw new Error("bsc_gas_price_unavailable");const data=x.contract.interface.encodeFunctionData("transfer",[x.ethers.getAddress(w.wallet_address),units]),gas=await x.provider.estimateGas({from:x.address,to:x.token,data}),limit=(gas*120n)/100n,bnb=await x.provider.getBalance(x.address);if(bnb<limit*gasPrice)throw new Error("bsc_treasury_bnb_insufficient");
  const c2=await pool.connect();try{await c2.query("begin");await c2.query("select pg_advisory_xact_lock(hashtext('wiener:bsc:nonce:v121'))");const nonce=await x.provider.getTransactionCount(x.address,"pending"),raw=await x.signer.signTransaction({chainId:56,type:0,nonce,to:x.token,data,value:0n,gasLimit:limit,gasPrice}),hash=x.ethers.keccak256(raw);a=(await c2.query("insert into public.bsc_payout_attempts(withdrawal_id,chain_id,network,asset,token_contract,recipient,amount_usdt,amount_base_units,token_decimals,nonce,gas_limit,gas_price_wei,raw_tx,tx_hash,state,processing_at,updated_at) values($1,56,'BEP20','USDT',$2,$3,$4,$5,$6,$7,$8,$9,$10,'signed',now(),now()) returning *",[w.id,x.token,w.wallet_address,String(w.receive_usdt),units.toString(),d,nonce,limit.toString(),gasPrice.toString(),raw,hash])).rows[0];await c2.query("commit")}catch(e){await c2.query("rollback").catch(()=>{});throw e}finally{c2.release()}
  try{await x.provider.broadcastTransaction(a.raw_tx)}catch(e){if(!/already known|known transaction|nonce too low/i.test(String(e?.message||e)))throw e}
  await pool.query("update public.bsc_payout_attempts set state='broadcasted',broadcast_at=coalesce(broadcast_at,now()),updated_at=now() where id=$1",[a.id]);await pool.query("update public.withdrawals set status='processing',processed_at=coalesce(processed_at,now()) where id=$1 and status='pending'",[id]);
 }finally{c.release()}
}
async function bscWorkerV121(){try{const rows=(await pool.query("select id from public.withdrawals where method_key='usdt_bep20' and status in ('pending','processing') order by created_at asc limit 10")).rows;for(const r of rows){try{await bscProcessV121(r.id)}catch(e){console.error("v121_bsc_worker_item",String(e?.message||e))}}}catch(e){console.error("v121_bsc_worker",String(e?.message||e))}}
app.use("/functions/v1/wiener-withdraw",async(req,res,next)=>{if(req.method==="POST"&&String(req.body?.action||"")==="request"&&String(req.body?.method_key||"")==="usdt_bep20"){try{return await bscCreateV121(req,res)}catch(e){return edgeFail(res,e)}}return next()});
app.post("/functions/v1/wiener-bsc-treasury",async(req,res)=>{try{const b=req.body||{},u=await edgeUser(b),id=Number(u?.id||0);await adm18(id,"treasury");const a=String(b.action||"status");if(a==="status")return res.json({ok:true,data:await bscStatusV121()});if(a==="withdrawals")return res.json({ok:true,data:{withdrawals:(await pool.query("select w.*,a.state payout_state,a.error payout_error,a.nonce,a.confirmed_at from public.withdrawals w left join public.bsc_payout_attempts a on a.withdrawal_id=w.id where w.method_key='usdt_bep20' order by w.created_at desc limit 100")).rows}});if(a==="retry"){const id2=String(b.withdrawal_id||"");await pool.query("update public.bsc_payout_attempts set state='pending',error=null where withdrawal_id=$1 and state='failed'",[id2]);await pool.query("update public.withdrawals set status='pending' where id=$1 and method_key='usdt_bep20' and status='failed'",[id2]);await bscProcessV121(id2);return res.json({ok:true,data:{retried:true}})}throw new Error("unknown_action")}catch(e){return edgeFail(res,e)}});
if(!globalThis.__wienerBscWorkerV121){globalThis.__wienerBscWorkerV121=true;setTimeout(bscWorkerV121,5000);setInterval(bscWorkerV121,5000)}
// === END WIENER BSC TREASURY V121 ===
'''
s=s.replace(anchor,code+"\n"+anchor,1)
p.write_text(s)
PY
python3 /tmp/wiener-v121-bsc.py "$BACKEND"
node --check "$BACKEND"
pm2 restart "$PM2_APP" --update-env
sleep 3
curl -fsS http://127.0.0.1:3000/health >/dev/null
pm2 save >/dev/null
echo "V121 BSC treasury installed. Configure BSC_TREASURY_ADDRESS and BSC_TREASURY_PRIVATE_KEY in /opt/wiener-backend/.env."
