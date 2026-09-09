#!/usr/bin/env python3
from pathlib import Path
import os,re

p=Path(os.environ.get('WIENER_BACKEND_FILE','/opt/wiener-backend/server.mjs'))
if not p.exists():
    alt=Path('/opt/wiener-backend/server.js')
    if alt.exists(): p=alt
if not p.exists(): raise SystemExit('ERROR: Wiener backend file not found')

s=p.read_text()
TAG='WIENER SPONSORED RECONCILE REPAIR V83'
if TAG in s:
    print('V83 sponsored reconcile repair already installed')
    raise SystemExit(0)

if 'async function reconcileSponsoredV10B' not in s:
    raise SystemExit('ERROR: reconcileSponsoredV10B not found')

start=s.find('async function reconcileSponsoredV10B(o){')
end=s.find("\n\napp.post('/functions/v1/wiener-sponsored-task'",start)
if start<0 or end<0:
    raise SystemExit('ERROR: sponsored reconcile anchors not found')

fn=r'''async function reconcileSponsoredV10B(o){
  if(!o||!['awaiting_payment','live'].includes(String(o.status||'')))return o;
  const db=await pool.connect();
  try{
    await db.query('begin');
    await db.query(`select pg_advisory_xact_lock(hashtext($1))`,['sponsored-order:'+String(o.id)]);
    o=(await db.query(`select * from public.exclusive_task_orders where id=$1 for update`,[o.id])).rows[0]||o;

    let pay=null;
    if(String(o.status)==='awaiting_payment'){
      const rows=(await db.query(`
        select * from public.wiener_treasury_transfers
        where direction='deposit' and asset='TON' and network='TON' and state='confirmed'
          and coalesce(metadata->>'memo','')=$1
        order by coalesce(confirmed_at,detected_at,created_at) desc nulls last
        limit 50`,[String(o.payment_memo||'')])).rows;
      const expected=Number(o.package_ton||0);
      for(const d of rows){
        if(String(d.to_address||'')!==String(o.payment_address||''))continue;
        if(Number(d.amount||0)+0.000001<expected)continue;
        const used=(await db.query(`select order_id from public.task_deposits where tx_hash=$1 limit 1`,[d.tx_hash])).rows[0];
        if(used&&String(used.order_id)!==String(o.id))continue;
        pay=d;break;
      }
      if(!pay){await db.query('commit');return o}
    }

    let task=o.task_id;
    if(!task){
      const ex=(await db.query(`select id from public.tasks where sponsored_order_id=$1 order by id limit 1`,[o.id])).rows[0];
      if(ex) task=ex.id;
      else {
        const mini=String(o.task_kind||'')==='mini_app';
        task=(await db.query(`insert into public.tasks(
          title,description,category,task_type,reward,url,telegram_chat_id,verification,
          is_daily,enabled,sponsored_order_id,max_completions,completed_count,user_created
        ) values($1,$2,'official',$3,$4,$5,$6,$7,false,true,$8,$9,0,true) returning id`,[
          o.title,
          mini?'Sponsored Mini App · Launch Tracked · stay at least 15 seconds, then return and tap CHECK':`Sponsored task · ${o.target_completions} verified members`,
          mini?'mini_app':'telegram',
          o.reward_per_completion,
          o.target_url,
          mini?null:o.target_ref,
          mini?'external_visit':'telegram_member',
          o.id,
          o.target_completions
        ])).rows[0].id;
      }
    }

    if(String(o.status)==='awaiting_payment'){
      const used=(await db.query(`select order_id from public.task_deposits where tx_hash=$1 limit 1`,[pay.tx_hash])).rows[0];
      if(!used){
        await db.query(`insert into public.task_deposits(
          order_id,telegram_id,expected_usdt,received_usdt,network,token_symbol,
          deposit_address,from_address,tx_hash,explorer_url,block_number,confirmations,status,verified_at
        ) values($1,$2,$3,$4,'TON','TON',$5,$6,$7,$8,$9,1,'confirmed',now())`,[
          o.id,o.telegram_id,o.gross_price_usdt,
          Number(pay.amount||0)*Number(o.quote_ton_usd||0),o.payment_address,
          pay.from_address,pay.tx_hash,pay.explorer_url,pay.block_number
        ]);
      }
      o=(await db.query(`update public.exclusive_task_orders set
        task_id=$2,tx_hash=$3,payment_status='verified',payment_received_ton=$4,
        payment_received_usdt=$5,payment_from_address=$6,payment_block_number=$7,
        payment_confirmations=greatest(coalesce(payment_confirmations,0),1),
        payment_detected_at=coalesce(payment_detected_at,now()),tx_verified_at=now(),
        status='live',activated_at=coalesce(activated_at,now()),updated_at=now()
        where id=$1 returning *`,[
          o.id,task,pay.tx_hash,pay.amount,
          Number(pay.amount||0)*Number(o.quote_ton_usd||0),pay.from_address,pay.block_number
        ])).rows[0];
    }else if(!o.task_id){
      o=(await db.query(`update public.exclusive_task_orders set task_id=$2,updated_at=now() where id=$1 returning *`,[o.id,task])).rows[0];
    }

    await db.query('commit');
    return o;
  }catch(e){
    await db.query('rollback').catch(()=>null);
    throw e;
  }finally{db.release()}
}
// === WIENER SPONSORED RECONCILE REPAIR V83 ==='''

s=s[:start]+fn+s[end:]

# Extend the existing automatic sweep to also repair live orders whose task row/link is missing.
needle="for(const o of p.orders)try{await reconcileSponsoredV10B(o)}catch(e){console.error('v82_db_order_reconcile',String(e?.message||e))}"
if needle in s:
    repl=needle+"\n    const liveBroken=(await pool.query(`select o.* from public.exclusive_task_orders o left join public.tasks t on t.sponsored_order_id=o.id where o.status='live' and (o.task_id is null or t.id is null or coalesce(t.enabled,false)=false) order by o.activated_at asc nulls first limit 100`)).rows;\n    for(const o of liveBroken)try{await reconcileSponsoredV10B(o)}catch(e){console.error('v83_live_task_repair',String(e?.message||e))}"
    s=s.replace(needle,repl,1)
else:
    print('WARNING: V82 sweep anchor not found; reconcile function still repaired')

p.write_text(s)
print('V83 installed: confirmed TON deposits + missing live task listings repaired DB-first')
