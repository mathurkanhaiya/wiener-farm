#!/usr/bin/env python3
from pathlib import Path
import os
p=Path(os.environ.get('WIENER_BACKEND_FILE','/opt/wiener-backend/server.mjs'))
s=p.read_text()
TAG='WIENER ADMIN GRAM SEND LIVE V117'
if TAG in s:
    print('V117 already installed'); raise SystemExit(0)
if 'WIENER ADMIN GRAM SEND V116' not in s:
    raise SystemExit('ERROR: V116 required')

# Replace V116 external sender with the already-configured TON treasury signer.
start=s.index('async function gramSendBroadcastV116(row){')
end=s.index('\nasync function gramSendHandleMessageV116',start)
sender=r"""async function gramSendBroadcastV116(row){
  const mn=String(process.env.WIENER_TON_PAYOUT_MNEMONIC||'').trim();
  const endpoint=String(process.env.WIENER_TON_RPC_URL||'https://toncenter.com/api/v2/jsonRPC').trim();
  const apiKey=String(process.env.WIENER_TON_API_KEY||'').trim();
  if(mn.split(/\s+/).length<12)throw Error('ton_treasury_not_configured');
  const amount=Number(row.amount_gram);
  if(!Number.isFinite(amount)||amount<=0)throw Error('invalid_gram_amount');
  const [{TonClient,WalletContractV4},{mnemonicToPrivateKey},{Address,internal,SendMode,toNano}]=await Promise.all([
    import('@ton/ton'),import('@ton/crypto'),import('@ton/core')
  ]);
  const kp=await mnemonicToPrivateKey(mn.split(/\s+/));
  const wc=WalletContractV4.create({workchain:0,publicKey:kp.publicKey});
  const client=new TonClient({endpoint,apiKey:apiKey||undefined}),contract=client.open(wc);
  const to=Address.parse(String(row.wallet_address)),value=toNano(amount.toFixed(9)),balance=await contract.getBalance();
  if(balance<=value+toNano('0.02'))throw Error('payout_wallet_insufficient_ton');
  const lock=await pool.connect(); let locked=false,submitted=false;
  try{
    locked=!!(await lock.query(`select pg_try_advisory_lock(hashtext('wiener_ton_signer_v117')) ok`)).rows[0]?.ok;
    if(!locked)throw Error('ton_signer_busy');
    const fresh=(await lock.query(`select status from public.admin_gram_sends where id=$1`,[row.id])).rows[0];
    if(fresh?.status!=='sending')throw Error('send_state_conflict');
    const seqno=await contract.getSeqno(),before=Date.now();
    await contract.sendTransfer({seqno,secretKey:kp.secretKey,sendMode:SendMode.PAY_GAS_SEPARATELY,messages:[
      internal({to,value,bounce:false,body:'WIENER Farm admin GRAM transfer'})
    ]});
    submitted=true;
    await lock.query(`update public.admin_gram_sends set error=$2,updated_at=now() where id=$1`,[row.id,`submitted seqno:${seqno}`]);
    let advanced=false;
    for(let i=0;i<12;i++){await sleepV10(1500);if(await contract.getSeqno()>seqno){advanced=true;break}}
    if(!advanced)throw Error('ton_transaction_submitted_reconcile_required');
    const txs=await client.getTransactions(wc.address,{limit:8});
    const tx=txs.find(t=>Number(t.now)*1000>=before-5000)||txs[0];
    if(!tx)throw Error('ton_transaction_hash_unavailable_reconcile_required');
    const hash=tx.hash().toString('hex');
    return {tx_hash:hash,explorer_url:`https://tonviewer.com/transaction/${hash}`};
  }catch(e){
    if(submitted){
      const x=Error(String(e?.message||e)); x.submitted=true; throw x;
    }
    throw e;
  }finally{
    if(locked)await lock.query(`select pg_advisory_unlock(hashtext('wiener_ton_signer_v117'))`).catch(()=>{});
    lock.release();
  }
}"""
s=s[:start]+sender+s[end:]

# Wire callbacks into the live full-bot handler before generic callbacks.
anchor="  if(q&&await profileV39.handle(q))return true;"
if anchor not in s: raise SystemExit('ERROR: callback anchor missing')
s=s.replace(anchor,"  // "+TAG+"\n  if(q&&await gramSendHandleCallbackV116(q))return true;\n\n"+anchor,1)

# Existing command block is private-only; add /send before it so groups and private chats both work.
anchor2="  // Commands.\n  if(m?.chat?.type==='private'&&text.startsWith('/')){"
if anchor2 not in s: raise SystemExit('ERROR: command anchor missing')
insert="""  // V117 /send works in private chats and groups; admin auth is enforced inside the handler.
  if(m&&/^\\/send(?:@\\w+)?(?:\\s|$)/i.test(text)){
    await gramSendHandleMessageV116(m);
    return true;
  }

"""
s=s.replace(anchor2,"  // Commands.\n"+insert+"  if(m?.chat?.type==='private'&&text.startsWith('/')){",1)
p.write_text(s)
print('V117 installed: /send wired to live bot + existing TON treasury signer')
