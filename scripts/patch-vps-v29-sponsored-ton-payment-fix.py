from pathlib import Path
import os,re

p=Path(os.environ.get('WIENER_BACKEND_FILE','/opt/wiener-backend/server.mjs'))
if not p.exists():
    alt=Path('/opt/wiener-backend/server.js')
    if alt.exists(): p=alt
s=p.read_text()
TAG='WIENER SPONSORED TON PAYMENT FIX V29'
if TAG in s:
    print('V29 sponsored TON payment fix already installed')
    raise SystemExit(0)
if 'async function saveTonDepositV10B' not in s or 'async function reconcileSponsoredV10B' not in s:
    raise SystemExit('ERROR: sponsored TON payment functions not found')

save_fn=r'''// === WIENER SPONSORED TON PAYMENT FIX V29 ===
async function saveTonDepositV10B(t,tx){
  const im=tx.inMessage;if(!im||im.info?.type!=='internal')return false;
  const coins=BigInt(im.info.value?.coins||0);if(coins<=0n)return false;
  const hash=tx.hash().toString('hex'),amount=Number(coins)/1e9,memo=memoV10B(im),from=im.info.src?im.info.src.toString({bounceable:false,urlSafe:true,testOnly:false}):'',explorer=`https://tonviewer.com/transaction/${hash}`;
  const db=await pool.connect();let inserted=false;
  try{
    await db.query('begin');
    await db.query(`select pg_advisory_xact_lock(hashtext($1))`,['ton-deposit:'+hash]);
    const ex=(await db.query(`select id from public.wiener_treasury_transfers where tx_hash=$1 limit 1`,[hash])).rows[0];
    if(!ex){
      await db.query(`insert into public.wiener_treasury_transfers(direction,asset,amount,network,chain_id,from_address,to_address,tx_hash,explorer_url,state,confirmations,confirmed_at,detected_at,metadata) values('deposit','TON',$1,'TON',null,$2,$3,$4,$5,'confirmed',1,now(),now(),$6::jsonb)`,[amount,from||null,t.address,hash,explorer,JSON.stringify({memo,lt:String(tx.lt||''),utime:Number(tx.now||0),source:'ton_treasury_backfill_v29'})]);
      inserted=true;
    }
    await db.query('commit');
  }catch(e){await db.query('rollback').catch(()=>null);throw e}finally{db.release()}
  if(inserted&&/^WTASK-/i.test(memo)){const admins=(await pool.query(`select telegram_id from public.admins where enabled=true`)).rows;for(const a of admins)await tgV10('sendMessage',{chat_id:a.telegram_id,text:`✅ Treasury Deposit Received\n\nAsset: TON\nAmount: ${amount.toFixed(9)}\nNetwork: TON\nFrom: ${from||'Unknown'}\nTo: ${t.address}\nReference: ${memo}\nTX: ${explorer}\nConfirmations: 1\nStatus: Confirmed`}).catch(()=>null)}
  return inserted;
}
// === END WIENER SPONSORED TON PAYMENT FIX V29 ==='''

pat_save=r"async function saveTonDepositV10B\(t,tx\)\{.*?\n\}\n\napp\.post\('/functions/v1/wiener-ton-deposit-backfill'"
m=re.search(pat_save,s,re.S)
if not m: raise SystemExit('ERROR: saveTonDepositV10B live anchor not found')
s=s[:m.start()]+save_fn+"\n\napp.post('/functions/v1/wiener-ton-deposit-backfill'"+s[m.end():]

reconcile_fn=r'''async function reconcileSponsoredV10B(o){
  if(!o||o.status!=='awaiting_payment')return o;
  const cutoff=new Date(new Date(o.created_at).getTime()-180000),rows=(await pool.query(`select * from public.wiener_treasury_transfers where direction='deposit' and asset='TON' and network='TON' and state='confirmed' and created_at>=$1 order by created_at desc limit 250`,[cutoff])).rows,expected=Number(o.package_ton||0);
  let pay=null;
  for(const d of rows){
    if(String(d.to_address||'')!==String(o.payment_address||''))continue;
    if(String(d.metadata?.memo||'')!==String(o.payment_memo||''))continue;
    if(Number(d.amount||0)+.000001<expected)continue;
    const used=(await pool.query(`select order_id from public.task_deposits where tx_hash=$1 limit 1`,[d.tx_hash])).rows[0];
    if(used&&String(used.order_id)!==String(o.id))continue;
    pay=d;break;
  }
  if(!pay)return o;
  const db=await pool.connect();
  try{
    await db.query('begin');
    await db.query(`select pg_advisory_xact_lock(hashtext($1))`,['task-payment:'+String(pay.tx_hash)]);
    const used=(await db.query(`select order_id from public.task_deposits where tx_hash=$1 limit 1`,[pay.tx_hash])).rows[0];
    if(used&&String(used.order_id)!==String(o.id)){await db.query('rollback');return o}
    let task=o.task_id;
    if(!task){
      const ex=(await db.query(`select id from public.tasks where sponsored_order_id=$1 limit 1`,[o.id])).rows[0];
      if(ex)task=ex.id;
      else task=(await db.query(`insert into public.tasks(title,description,category,task_type,reward,url,telegram_chat_id,verification,is_daily,enabled,sponsored_order_id,max_completions,completed_count,user_created) values($1,$2,'official','telegram',$3,$4,$5,'telegram_member',false,true,$6,$7,0,true) returning id`,[o.title,`Sponsored task · ${o.target_completions} verified members`,o.reward_per_completion,o.target_url,o.target_ref,o.id,o.target_completions])).rows[0].id;
    }
    if(!used){
      await db.query(`insert into public.task_deposits(order_id,telegram_id,expected_usdt,received_usdt,network,token_symbol,deposit_address,from_address,tx_hash,explorer_url,block_number,confirmations,status,verified_at) values($1,$2,$3,$4,'TON','TON',$5,$6,$7,$8,$9,1,'confirmed',now())`,[o.id,o.telegram_id,o.gross_price_usdt,Number(pay.amount||0)*Number(o.quote_ton_usd||0),o.payment_address,pay.from_address,pay.tx_hash,pay.explorer_url,pay.block_number]);
    }
    const q=await db.query(`update public.exclusive_task_orders set task_id=$2,tx_hash=$3,payment_status='verified',payment_received_ton=$4,payment_received_usdt=$5,payment_from_address=$6,payment_block_number=$7,payment_confirmations=1,payment_detected_at=coalesce(payment_detected_at,now()),tx_verified_at=now(),status='live',activated_at=coalesce(activated_at,now()),updated_at=now() where id=$1 returning *`,[o.id,task,pay.tx_hash,pay.amount,Number(pay.amount||0)*Number(o.quote_ton_usd||0),pay.from_address,pay.block_number]);
    await db.query('commit');
    return q.rows[0];
  }catch(e){await db.query('rollback').catch(()=>null);throw e}finally{db.release()}
}'''

pat_rec=r"async function reconcileSponsoredV10B\(o\)\{.*?\n\}\n\napp\.post\('/functions/v1/wiener-sponsored-task'"
m=re.search(pat_rec,s,re.S)
if not m: raise SystemExit('ERROR: reconcileSponsoredV10B live anchor not found')
s=s[:m.start()]+reconcile_fn+"\n\napp.post('/functions/v1/wiener-sponsored-task'"+s[m.end():]

p.write_text(s)
print('V29 installed: sponsored TON payment reconciliation no longer depends on missing ON CONFLICT constraints')
