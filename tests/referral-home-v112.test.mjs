import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceHomeProof,createReferralHomeHandler} from '../scripts/referral-home-v112.mjs';

test('Home proof requires elapsed server time and consecutive, spaced pulses',()=>{
 const proof={started_at:0,last_seen_at:8000,sequence:4};
 assert.equal(advanceHomeProof(proof,5,10000).ready,true);
 assert.equal(advanceHomeProof(proof,5,9999).ready,false);
 assert.throws(()=>advanceHomeProof(proof,5,9000),/too_early/);
 assert.throws(()=>advanceHomeProof(proof,5,15000),/expired/);
 assert.throws(()=>advanceHomeProof(proof,4,10000),/sequence/);
 assert.throws(()=>advanceHomeProof(proof,8,10000),/sequence/);
});

function harness(){
 let now=1000,proof=null,joined=true,credits=0;
 const row={referred_user_id:1,inviter_user_id:2,join_rewarded_at:null};
 const user={telegram_id:1,referred_by:2};
 let snapshot;
 const db={async query(sql,args=[]){
  if(sql==='begin'){snapshot=structuredClone({proof,row});return {rows:[]}}
  if(sql==='rollback'){proof=snapshot.proof;Object.assign(row,snapshot.row);return {rows:[]}}
  if(sql==='commit')return {rows:[]};
  if(sql.startsWith('select * from public.referral_v2'))return{rows:[{...row}]};
  if(sql.includes('insert into public.referral_home_v112')){proof={token:args[1],started_at:now,last_seen_at:now,sequence:0};return{rows:[]}}
  if(sql.startsWith('select *,clock_timestamp()'))return{rows:proof?.token===args[1]?[{...proof,server_now:now}]:[]};
  if(sql.startsWith('update public.referral_home_v112')){proof.sequence=args[1];proof.last_seen_at=now;return{rows:[]}}
  if(sql.startsWith('update public.referral_v2')){row.join_home_verified_at=now;return{rows:[]}}
  if(sql.startsWith('delete from public.referral_home_v112')){if(args.length===1||proof?.token===args[1])proof=null;return{rows:[]}}
  throw Error('unexpected query '+sql);
 },async connect(){return {...db,release(){}}}};
 const handler=createReferralHomeHandler({pool:db,edgeUser:async()=>({id:1}),refUser:async()=>user,refReconcile:async()=>{if(row.join_home_verified_at&&!row.join_rewarded_at){credits++;row.join_rewarded_at=now}},mandatoryCheck:async()=>{if(!joined)throw Error('not_joined')},randomToken:()=> 'a'.repeat(64)});
 const call=async(action,sequence)=>{let out,status=200;await handler({body:{action,sequence,token:'a'.repeat(64)}},{status(n){status=n;return this},json(x){out=x}},()=>{});return {status,...out}};
 return {call,tick(ms=2000){now+=ms},leave(){joined=false},ban(){user.is_banned=true},get credits(){return credits}};
}
test('Opening alone pays nothing; five pulses credit once, retries cannot repay',async()=>{
 const h=harness();await h.call('home_start');assert.equal(h.credits,0);
 for(let i=1;i<=5;i++){h.tick();assert.equal((await h.call('home_pulse',i)).ok,true);assert.equal(h.credits,i===5?1:0)}
 assert.equal((await h.call('home_pulse',5)).data.done,true);assert.equal(h.credits,1);
});
test('Join gate failure blocks starting',async()=>{const h=harness();h.leave();assert.equal((await h.call('home_start')).status,409);assert.equal(h.credits,0)});
test('Leaving a required channel before payout fails the fresh verification',async()=>{
 const h=harness();await h.call('home_start');for(let i=1;i<=4;i++){h.tick();await h.call('home_pulse',i)}h.leave();h.tick();assert.equal((await h.call('home_pulse',5)).status,409);assert.equal(h.credits,0);
});
test('Hidden/abandoned and cancelled sessions do not credit',async()=>{
 const h=harness();await h.call('home_start');h.tick(10000);assert.equal((await h.call('home_pulse',1)).status,409);assert.equal(h.credits,0);
 await h.call('home_start');await h.call('home_cancel');h.tick();assert.equal((await h.call('home_pulse',1)).status,409);assert.equal(h.credits,0);
});
test('Banned users cannot finish an earlier session',async()=>{const h=harness();await h.call('home_start');h.ban();h.tick();assert.equal((await h.call('home_pulse',1)).status,409);assert.equal(h.credits,0)});
