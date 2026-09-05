from pathlib import Path
import os

p=Path(os.environ.get("WIENER_BACKEND_FILE","/opt/wiener-backend/server.mjs"))
if not p.exists():
    p=Path("/opt/wiener-backend/server.js")
s=p.read_text()
TAG="WIENER GROUP GAMES V33"
if TAG in s:
    print("V33 already installed")
    raise SystemExit(0)
if "async function handleBotFullV18" not in s:
    raise SystemExit("ERROR: V18 bot handler missing")
marker="\napp.use((_req,res)=>\n  res.status(404).json({ok:false,error:'route_not_enabled_yet'})\n);\n"
if marker not in s:
    raise SystemExit("ERROR: backend insertion marker missing")

code=r'''
// === WIENER GROUP GAMES V33 ===
function gameN33(v){const n=Number(v);return Number.isFinite(n)?n:0}
function gameR33(v){return Math.round(gameN33(v)*100)/100}
function gameName33(u,id){const x=String(u||"").replace(/^@/,"");return x?"@"+x:"User "+String(id).slice(-6)}
function gameTitle33(t){return t==="dice"?"🎲 Dice Duel":t==="rps"?"✊ Rock Paper Scissors":"❌⭕ Tic-Tac-Toe"}
function gameWin33(board,ch){
  const a=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  return a.some(x=>x.every(i=>board[i]===ch))
}
function gameFull33(board){return !board.includes(".")}
function gameBoardRows33(g){
  const b=String(g.board||".........").padEnd(9,".").slice(0,9).split(""),rows=[];
  for(let r=0;r<3;r++){
    const row=[];
    for(let c=0;c<3;c++){
      const i=r*3+c,v=b[i];
      row.push(cb18(v==="."?"·":v,"g33:ttt:"+g.id+":"+i))
    }
    rows.push(row)
  }
  if(g.mode==="pvp"&&g.state==="active")rows.push([cb18("⏱ CLAIM TIMEOUT","g33:timeout:"+g.id),cb18("🏳 FORFEIT","g33:forfeit:"+g.id)]);
  return rows
}
async function gameCfg33(){
  return (await pool.query("select * from public.wiener_game_settings where id=true limit 1")).rows[0]||{enabled:true,min_bet:20,max_bet:500,pvp_fee_percent:5,bot_dice_multiplier:1.8,bot_rps_multiplier:1.8,bot_ttt_multiplier:1.65,challenge_ttl_seconds:60,action_timeout_seconds:45}
}
async function gameEnsure33(from){
  const id=Number(from?.id||0);if(!id)throw new Error("user_required");
  let u=await usr18(id);
  if(!u){
    try{await rpc("register_or_touch_user",[id,from?.username||null,from?.first_name||null,from?.last_name||null,null,null])}catch{}
    u=await usr18(id)
  }
  if(!u)throw new Error("open_wiener_farm_first");
  if(u.is_banned||u.device_blocked)throw new Error("account_restricted");
  return u
}
async function gameActive33(c,uid){
  return (await c.query("select * from public.wiener_game_matches where state in ('open','active') and (player1_id=$1 or player2_id=$1) order by created_at desc limit 1",[uid])).rows[0]||null
}
async function gameStake33(c,uid,amount,mid){
  const q=await c.query("update public.users set balance=balance-$2 where telegram_id=$1 and balance>=$2 and coalesce(is_banned,false)=false and coalesce(device_blocked,false)=false returning balance",[uid,amount]);
  if(!q.rows[0])throw new Error("insufficient_wiener_balance");
  const bal=gameN33(q.rows[0].balance);
  await c.query("insert into public.transactions(telegram_id,amount,balance_after,kind,description,metadata) values($1,$2,$3,'game_stake','WIENER game stake',$4::jsonb)",[uid,-amount,bal,JSON.stringify({match_id:mid})]);
  return bal
}
async function gameCredit33(c,uid,amount,profit,mid,kind,desc){
  const q=await c.query("update public.users set balance=balance+$2,total_earned=total_earned+$3 where telegram_id=$1 returning balance",[uid,gameR33(amount),Math.max(0,gameR33(profit))]);
  if(!q.rows[0])throw new Error("user_not_found");
  const bal=gameN33(q.rows[0].balance);
  await c.query("insert into public.transactions(telegram_id,amount,balance_after,kind,description,metadata) values($1,$2,$3,$4,$5,$6::jsonb)",[uid,gameR33(amount),bal,kind,desc,JSON.stringify({match_id:mid})])
}
async function gameGet33(id,lock=false,c=pool){
  return (await c.query("select * from public.wiener_game_matches where id=$1"+(lock?" for update":""),[String(id)])).rows[0]||null
}
async function gameRefundOpen33(id,why){
  const c=await pool.connect();
  try{
    await c.query("begin");const g=await gameGet33(id,true,c);if(!g||g.state!=="open"){await c.query("rollback");return false}
    await gameCredit33(c,g.player1_id,g.bet,0,g.id,"game_refund","Game challenge refund");
    await c.query("update public.wiener_game_matches set state='refunded',outcome=$2,result_text=$2,settled_at=now(),last_action_at=now() where id=$1",[g.id,why||"challenge_refunded"]);
    await c.query("commit");return true
  }catch(e){await c.query("rollback").catch(()=>null);throw e}finally{c.release()}
}
async function gameExpire33(){
  const cfg=await gameCfg33(),ttl=Math.max(30,Number(cfg.challenge_ttl_seconds||60));
  const rows=(await pool.query("select id from public.wiener_game_matches where state='open' and created_at<now()-($1::text||' seconds')::interval limit 50",[String(ttl)])).rows;
  for(const x of rows)await gameRefundOpen33(x.id,"challenge_expired").catch(e=>console.error("game33_expire",String(e?.message||e)));
}
async function gameHub33(chatId,uid){
  const cfg=await gameCfg33();if(!cfg.enabled)return{text:"🎮 WIENER Games are temporarily paused.",markup:kb18([])};
  const a=(await pool.query("select * from public.wiener_game_matches where state in ('open','active') and (player1_id=$1 or player2_id=$1) order by created_at desc limit 1",[uid])).rows[0];
  if(a){const x=await gameCard33(a);x.text="🎮 You already have an active match.\n\n"+x.text;return x}
  return{text:"🎮 WIENER GROUP GAMES\n\nPlay using your WIENER balance.\n\n⚔️ PvP: both players stake the same amount. Winner receives the pot minus 5% house fee.\n🤖 VS Bot: fixed payout multipliers.\n\nChoose a mode:",markup:kb18([[cb18("⚔️ PvP","g33:mode:pvp"),cb18("🤖 VS BOT","g33:mode:bot")],[cb18("📊 MY STATS","g33:stats"),cb18("🏆 GROUP TOP","g33:board")]])}
}
function gamePick33(mode){
  return{text:(mode==="pvp"?"⚔️ PvP":"🤖 VS BOT")+"\n\nChoose a game:",markup:kb18([[cb18("🎲 DICE","g33:pick:"+mode+":dice"),cb18("✊ RPS","g33:pick:"+mode+":rps")],[cb18("❌⭕ TIC-TAC-TOE","g33:pick:"+mode+":ttt")],[cb18("◀️ BACK","g33:home")]])}
}
function gameBet33(mode,type){
  return{text:gameTitle33(type)+"\n\nChoose WIENER stake:",markup:kb18([[cb18("20","g33:start:"+mode+":"+type+":20"),cb18("50","g33:start:"+mode+":"+type+":50")],[cb18("100","g33:start:"+mode+":"+type+":100"),cb18("250","g33:start:"+mode+":"+type+":250")],[cb18("500","g33:start:"+mode+":"+type+":500")],[cb18("◀️ BACK","g33:mode:"+mode)]])}
}
async function gameCreate33(q,mode,type,bet){
  const cfg=await gameCfg33(),chatId=Number(q?.message?.chat?.id||0),from=q?.from;
  if(!chatId||!["group","supergroup"].includes(String(q?.message?.chat?.type||"")))throw new Error("group_only");
  if(!cfg.enabled)throw new Error("games_paused");
  if(!["pvp","bot"].includes(mode)||!["dice","rps","ttt"].includes(type))throw new Error("invalid_game");
  bet=gameR33(bet);if(bet<gameN33(cfg.min_bet)||bet>gameN33(cfg.max_bet))throw new Error("bet_out_of_range");
  await gameEnsure33(from);const uid=Number(from.id),id=crypto.randomUUID(),c=await pool.connect();let g;
  try{
    await c.query("begin");await c.query("select pg_advisory_xact_lock($1::bigint)",[uid]);
    if(await gameActive33(c,uid))throw new Error("active_match_exists");
    const mult=type==="dice"?gameN33(cfg.bot_dice_multiplier):type==="rps"?gameN33(cfg.bot_rps_multiplier):gameN33(cfg.bot_ttt_multiplier);
    g=(await c.query("insert into public.wiener_game_matches(id,chat_id,mode,game_type,state,player1_id,player1_username,player2_id,player2_username,bet,payout_multiplier,board,current_turn,last_action_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'.........',$12,now()) returning *",[id,chatId,mode,type,mode==="pvp"?"open":"active",uid,from.username||from.first_name||null,mode==="bot"?0:null,mode==="bot"?"WIENER Bot":null,bet,mult,type==="ttt"?uid:null])).rows[0];
    await gameStake33(c,uid,bet,id);await c.query("commit")
  }catch(e){await c.query("rollback").catch(()=>null);throw e}finally{c.release()}
  try{
    const x=await gameCard33(g),m=await safeTg18("sendMessage",{chat_id:chatId,text:x.text,reply_markup:x.markup,disable_web_page_preview:true});
    await pool.query("update public.wiener_game_matches set message_id=$2 where id=$1",[id,m?.message_id||null]);
    return g
  }catch(e){
    const c2=await pool.connect();
    try{await c2.query("begin");const z=await gameGet33(id,true,c2);if(z&&["open","active"].includes(z.state)){await gameCredit33(c2,uid,bet,0,id,"game_refund","Game start refund");await c2.query("update public.wiener_game_matches set state='refunded',outcome='send_failed',settled_at=now() where id=$1",[id])}await c2.query("commit")}catch{}finally{c2.release()}
    throw e
  }
}
async function gameAccept33(q,id){
  const cfg=await gameCfg33(),uid=Number(q.from.id),c=await pool.connect();let g;
  await gameEnsure33(q.from);
  try{
    await c.query("begin");await c.query("select pg_advisory_xact_lock($1::bigint)",[uid]);g=await gameGet33(id,true,c);
    if(!g||g.state!=="open")throw new Error("challenge_not_open");
    if(Number(g.chat_id)!==Number(q.message?.chat?.id))throw new Error("wrong_group");
    if(Number(g.player1_id)===uid)throw new Error("cannot_accept_own_challenge");
    const age=(Date.now()-new Date(g.created_at).getTime())/1000;if(age>Math.max(30,Number(cfg.challenge_ttl_seconds||60)))throw new Error("challenge_expired");
    if(await gameActive33(c,uid))throw new Error("active_match_exists");
    await gameStake33(c,uid,g.bet,g.id);
    g=(await c.query("update public.wiener_game_matches set state='active',player2_id=$2,player2_username=$3,accepted_at=now(),last_action_at=now(),current_turn=case when game_type='ttt' then player1_id else null end where id=$1 returning *",[g.id,uid,q.from.username||q.from.first_name||null])).rows[0];
    await c.query("commit");return g
  }catch(e){await c.query("rollback").catch(()=>null);throw e}finally{c.release()}
}
async function gameSettlePvp33(c,g,winner,outcome){
  const cfg=await gameCfg33(),pot=gameR33(gameN33(g.bet)*2),fee=gameR33(pot*gameN33(cfg.pvp_fee_percent)/100),pay=gameR33(pot-fee);
  if(outcome==="draw"){
    await gameCredit33(c,g.player1_id,g.bet,0,g.id,"game_refund","PvP draw refund");
    await gameCredit33(c,g.player2_id,g.bet,0,g.id,"game_refund","PvP draw refund");
    await c.query("update public.wiener_game_matches set state='settled',winner_id=null,outcome='draw',payout=$2,house_fee=0,result_text='Draw · stakes refunded',settled_at=now(),last_action_at=now() where id=$1",[g.id,gameR33(gameN33(g.bet)*2)]);
    return
  }
  const profit=gameR33(pay-gameN33(g.bet));await gameCredit33(c,winner,pay,profit,g.id,"game_payout","PvP game payout");
  await c.query("update public.wiener_game_matches set state='settled',winner_id=$2,outcome=$3,payout=$4,house_fee=$5,result_text=$6,settled_at=now(),last_action_at=now() where id=$1",[g.id,winner,outcome,pay,fee,"Winner paid "+pay+" WIENER"])
}
async function gameSettleBot33(c,g,outcome){
  const bet=gameN33(g.bet),mult=gameN33(g.payout_multiplier);
  if(outcome==="win"){const pay=gameR33(bet*mult);await gameCredit33(c,g.player1_id,pay,gameR33(pay-bet),g.id,"game_payout","VS Bot game payout");await c.query("update public.wiener_game_matches set state='settled',winner_id=player1_id,outcome='win',payout=$2,result_text=$3,settled_at=now(),last_action_at=now() where id=$1",[g.id,pay,"You won "+pay+" WIENER"])}
  else if(outcome==="draw"){await gameCredit33(c,g.player1_id,bet,0,g.id,"game_refund","VS Bot draw refund");await c.query("update public.wiener_game_matches set state='settled',winner_id=null,outcome='draw',payout=$2,result_text='Draw · stake refunded',settled_at=now(),last_action_at=now() where id=$1",[g.id,bet])}
  else await c.query("update public.wiener_game_matches set state='settled',winner_id=0,outcome='loss',payout=0,result_text='WIENER Bot won',settled_at=now(),last_action_at=now() where id=$1",[g.id])
}
function gameRpsResult33(a,b){
  if(a===b)return 0;if((a==="r"&&b==="s")||(a==="p"&&b==="r")||(a==="s"&&b==="p"))return 1;return -1
}
function gameRpsWord33(x){return x==="r"?"✊ Rock":x==="p"?"✋ Paper":"✌️ Scissors"}
function gameBotMove33(board){
  const b=board.split(""),empty=b.map((x,i)=>x==="."?i:-1).filter(i=>i>=0);
  for(const ch of ["O","X"])for(const i of empty){const z=b.slice();z[i]=ch;if(gameWin33(z.join(""),ch))return i}
  if(b[4]===".")return 4;
  const corners=[0,2,6,8].filter(i=>b[i]===".");if(corners.length)return corners[crypto.randomInt(0,corners.length)];
  return empty.length?empty[crypto.randomInt(0,empty.length)]:-1
}
async function gameDice33(q,id){
  const uid=Number(q.from.id),c=await pool.connect();let out;
  try{
    await c.query("begin");const g=await gameGet33(id,true,c);if(!g||g.state!=="active"||g.game_type!=="dice")throw new Error("match_not_active");
    if(g.mode==="bot"){
      if(uid!==Number(g.player1_id))throw new Error("not_your_match");if(g.player1_action)throw new Error("already_rolled");
      const a=crypto.randomInt(1,7),b=crypto.randomInt(1,7);await c.query("update public.wiener_game_matches set player1_action=$2,player2_action=$3 where id=$1",[g.id,String(a),String(b)]);
      if(a>b)await gameSettleBot33(c,g,"win");else if(a===b)await gameSettleBot33(c,g,"draw");else await gameSettleBot33(c,g,"loss");out={a,b}
    }else{
      if(uid!==Number(g.player1_id)&&uid!==Number(g.player2_id))throw new Error("players_only");
      const col=uid===Number(g.player1_id)?"player1_action":"player2_action";if(g[col])throw new Error("already_rolled");
      const roll=crypto.randomInt(1,7);await c.query("update public.wiener_game_matches set "+col+"=$2,last_action_at=now() where id=$1",[g.id,String(roll)]);
      const z=await gameGet33(id,true,c);if(z.player1_action&&z.player2_action){const a=Number(z.player1_action),b=Number(z.player2_action);if(a===b)await gameSettlePvp33(c,z,null,"draw");else await gameSettlePvp33(c,z,a>b?z.player1_id:z.player2_id,"dice_win")}out={roll}
    }
    await c.query("commit");return out
  }catch(e){await c.query("rollback").catch(()=>null);throw e}finally{c.release()}
}
async function gameRps33(q,id,choice){
  if(!["r","p","s"].includes(choice))throw new Error("invalid_choice");const uid=Number(q.from.id),c=await pool.connect();
  try{
    await c.query("begin");const g=await gameGet33(id,true,c);if(!g||g.state!=="active"||g.game_type!=="rps")throw new Error("match_not_active");
    if(g.mode==="bot"){
      if(uid!==Number(g.player1_id))throw new Error("not_your_match");if(g.player1_action)throw new Error("already_chosen");
      const opts=["r","p","s"],bot=opts[crypto.randomInt(0,3)],r=gameRpsResult33(choice,bot);await c.query("update public.wiener_game_matches set player1_action=$2,player2_action=$3 where id=$1",[g.id,choice,bot]);
      await gameSettleBot33(c,g,r>0?"win":r===0?"draw":"loss")
    }else{
      if(uid!==Number(g.player1_id)&&uid!==Number(g.player2_id))throw new Error("players_only");
      const col=uid===Number(g.player1_id)?"player1_action":"player2_action";if(g[col])throw new Error("already_chosen");
      await c.query("update public.wiener_game_matches set "+col+"=$2,last_action_at=now() where id=$1",[g.id,choice]);
      const z=await gameGet33(id,true,c);if(z.player1_action&&z.player2_action){const r=gameRpsResult33(z.player1_action,z.player2_action);if(r===0)await gameSettlePvp33(c,z,null,"draw");else await gameSettlePvp33(c,z,r>0?z.player1_id:z.player2_id,"rps_win")}
    }
    await c.query("commit")
  }catch(e){await c.query("rollback").catch(()=>null);throw e}finally{c.release()}
}
async function gameTtt33(q,id,cell){
  cell=Number(cell);if(cell<0||cell>8)throw new Error("invalid_cell");const uid=Number(q.from.id),c=await pool.connect();
  try{
    await c.query("begin");const g=await gameGet33(id,true,c);if(!g||g.state!=="active"||g.game_type!=="ttt")throw new Error("match_not_active");
    let b=String(g.board||".........").split("");if(b[cell]!==".")throw new Error("cell_already_used");
    if(g.mode==="bot"){
      if(uid!==Number(g.player1_id))throw new Error("not_your_match");if(Number(g.current_turn)!==uid)throw new Error("wait_for_bot");
      b[cell]="X";let board=b.join("");if(gameWin33(board,"X")){await c.query("update public.wiener_game_matches set board=$2 where id=$1",[g.id,board]);await gameSettleBot33(c,g,"win")}
      else if(gameFull33(board)){await c.query("update public.wiener_game_matches set board=$2 where id=$1",[g.id,board]);await gameSettleBot33(c,g,"draw")}
      else{const bi=gameBotMove33(board);if(bi>=0)b[bi]="O";board=b.join("");if(gameWin33(board,"O")){await c.query("update public.wiener_game_matches set board=$2 where id=$1",[g.id,board]);await gameSettleBot33(c,g,"loss")}else if(gameFull33(board)){await c.query("update public.wiener_game_matches set board=$2 where id=$1",[g.id,board]);await gameSettleBot33(c,g,"draw")}else await c.query("update public.wiener_game_matches set board=$2,current_turn=$3,last_action_at=now() where id=$1",[g.id,board,uid])}
    }else{
      if(uid!==Number(g.player1_id)&&uid!==Number(g.player2_id))throw new Error("players_only");if(Number(g.current_turn)!==uid)throw new Error("not_your_turn");
      const ch=uid===Number(g.player1_id)?"X":"O";b[cell]=ch;const board=b.join("");if(gameWin33(board,ch)){await c.query("update public.wiener_game_matches set board=$2 where id=$1",[g.id,board]);await gameSettlePvp33(c,g,uid,"ttt_win")}else if(gameFull33(board)){await c.query("update public.wiener_game_matches set board=$2 where id=$1",[g.id,board]);await gameSettlePvp33(c,g,null,"draw")}else await c.query("update public.wiener_game_matches set board=$2,current_turn=$3,last_action_at=now() where id=$1",[g.id,board,uid===Number(g.player1_id)?g.player2_id:g.player1_id])
    }
    await c.query("commit")
  }catch(e){await c.query("rollback").catch(()=>null);throw e}finally{c.release()}
}
async function gameForfeit33(q,id){
  const uid=Number(q.from.id),c=await pool.connect();
  try{await c.query("begin");const g=await gameGet33(id,true,c);if(!g||g.state!=="active"||g.mode!=="pvp")throw new Error("match_not_active");if(uid!==Number(g.player1_id)&&uid!==Number(g.player2_id))throw new Error("players_only");await gameSettlePvp33(c,g,uid===Number(g.player1_id)?g.player2_id:g.player1_id,"forfeit");await c.query("commit")}catch(e){await c.query("rollback").catch(()=>null);throw e}finally{c.release()}
}
async function gameTimeout33(q,id){
  const uid=Number(q.from.id),cfg=await gameCfg33(),c=await pool.connect();
  try{
    await c.query("begin");const g=await gameGet33(id,true,c);if(!g||g.state!=="active"||g.mode!=="pvp")throw new Error("match_not_active");if(uid!==Number(g.player1_id)&&uid!==Number(g.player2_id))throw new Error("players_only");
    const elapsed=(Date.now()-new Date(g.last_action_at||g.accepted_at||g.created_at).getTime())/1000;if(elapsed<Number(cfg.action_timeout_seconds||45))throw new Error("timeout_not_ready");
    let ok=false;
    if(g.game_type==="dice"||g.game_type==="rps"){const mine=uid===Number(g.player1_id)?g.player1_action:g.player2_action,other=uid===Number(g.player1_id)?g.player2_action:g.player1_action;ok=!!mine&&!other}
    else ok=Number(g.current_turn)!==uid;
    if(!ok)throw new Error("cannot_claim_timeout");
    await gameSettlePvp33(c,g,uid,"timeout_win");await c.query("commit")
  }catch(e){await c.query("rollback").catch(()=>null);throw e}finally{c.release()}
}
async function gameCard33(g){
  g=await gameGet33(g.id||g);if(!g)return{text:"❌ Match not found.",markup:kb18([])};
  const a=gameName33(g.player1_username,g.player1_id),b=g.mode==="bot"?"🤖 WIENER Bot":g.player2_id?gameName33(g.player2_username,g.player2_id):"Waiting for opponent";
  let t=gameTitle33(g.game_type)+"\n\n"+a+" vs "+b+"\n💰 Stake: "+gameN33(g.bet)+" WIENER"+(g.mode==="pvp"?" each\n🏆 Winner payout: "+gameR33(gameN33(g.bet)*2*0.95)+" WIENER":"\n✨ Win payout: "+gameR33(gameN33(g.bet)*gameN33(g.payout_multiplier))+" WIENER")+"\n\n";
  if(g.state==="open")return{text:t+"⚔️ Challenge is open for 60 seconds.",markup:kb18([[cb18("✅ ACCEPT","g33:accept:"+g.id)],[cb18("❌ CANCEL","g33:cancel:"+g.id)]])};
  if(g.state==="settled"){
    if(g.game_type==="dice"&&g.player1_action)t+="🎲 "+a+": "+g.player1_action+"\n🎲 "+b+": "+g.player2_action+"\n\n";
    if(g.game_type==="rps"&&g.player1_action)t+=gameRpsWord33(g.player1_action)+" · "+gameRpsWord33(g.player2_action)+"\n\n";
    if(g.game_type==="ttt"){const x=String(g.board||".........");t+=x.slice(0,3).replace(/\./g,"·").split("").join(" ")+"\n"+x.slice(3,6).replace(/\./g,"·").split("").join(" ")+"\n"+x.slice(6,9).replace(/\./g,"·").split("").join(" ")+"\n\n"}
    t+=(g.outcome==="draw"?"🤝 DRAW":Number(g.winner_id)===0?"🤖 WIENER Bot wins":"🏆 "+(Number(g.winner_id)===Number(g.player1_id)?a:b)+" WINS")+"\n"+String(g.result_text||"");return{text:t,markup:kb18([[cb18("🎮 PLAY AGAIN","g33:home")]])}
  }
  if(["cancelled","refunded"].includes(g.state))return{text:t+"↩️ "+String(g.result_text||g.outcome||"Match cancelled"),markup:kb18([[cb18("🎮 NEW GAME","g33:home")]])};
  if(g.game_type==="dice"){
    t+=(g.player1_action?"✅ "+a+" rolled":"⏳ "+a+" waiting")+"\n"+(g.mode==="bot"?"🤖 Bot rolls with you":g.player2_action?"✅ "+b+" rolled":"⏳ "+b+" waiting");
    const rows=[[cb18("🎲 ROLL","g33:roll:"+g.id)]];if(g.mode==="pvp")rows.push([cb18("⏱ CLAIM TIMEOUT","g33:timeout:"+g.id),cb18("🏳 FORFEIT","g33:forfeit:"+g.id)]);return{text:t,markup:kb18(rows)}
  }
  if(g.game_type==="rps"){
    t+=(g.player1_action?"✅ "+a+" locked":"⏳ "+a+" choose")+"\n"+(g.mode==="bot"?"🤖 Bot choice stays hidden":g.player2_action?"✅ "+b+" locked":"⏳ "+b+" choose");
    const rows=[[cb18("✊ ROCK","g33:rps:"+g.id+":r"),cb18("✋ PAPER","g33:rps:"+g.id+":p"),cb18("✌️ SCISSORS","g33:rps:"+g.id+":s")]];if(g.mode==="pvp")rows.push([cb18("⏱ CLAIM TIMEOUT","g33:timeout:"+g.id),cb18("🏳 FORFEIT","g33:forfeit:"+g.id)]);return{text:t,markup:kb18(rows)}
  }
  const x=String(g.board||".........");t+="\n"+x.slice(0,3).replace(/\./g,"·").split("").join(" ")+"\n"+x.slice(3,6).replace(/\./g,"·").split("").join(" ")+"\n"+x.slice(6,9).replace(/\./g,"·").split("").join(" ")+"\n\nTurn: "+(g.mode==="bot"?a:Number(g.current_turn)===Number(g.player1_id)?a:b);
  return{text:t,markup:kb18(gameBoardRows33(g))}
}
async function gameStats33(uid){
  const r=(await pool.query("select count(*)::int games,count(*) filter(where winner_id=$1)::int wins,count(*) filter(where outcome='draw')::int draws,count(*) filter(where state='settled' and outcome<>'draw' and winner_id is distinct from $1)::int losses,coalesce(sum(payout) filter(where winner_id=$1),0) paid from public.wiener_game_matches where state='settled' and (player1_id=$1 or player2_id=$1)",[uid])).rows[0]||{};
  return{text:"📊 WIENER GAME STATS\n\n🎮 Matches: "+Number(r.games||0)+"\n🏆 Wins: "+Number(r.wins||0)+"\n❌ Losses: "+Number(r.losses||0)+"\n🤝 Draws: "+Number(r.draws||0)+"\n💰 Winning payouts: "+gameR33(r.paid)+" WIENER",markup:kb18([[cb18("◀️ GAMES","g33:home")]])}
}
async function gameBoard33(chatId){
  const r=(await pool.query("select winner_id,count(*)::int wins from public.wiener_game_matches where chat_id=$1 and state='settled' and winner_id is not null and winner_id<>0 group by winner_id order by wins desc limit 10",[chatId])).rows;const out=[];
  for(let i=0;i<r.length;i++){const u=await usr18(Number(r[i].winner_id));out.push((i<3?["🥇","🥈","🥉"][i]:(i+1)+".")+" "+gameName33(u?.username||u?.first_name,r[i].winner_id)+" · "+r[i].wins+" wins")}
  return{text:"🏆 GROUP GAME LEADERBOARD\n\n"+(out.join("\n")||"No completed games yet."),markup:kb18([[cb18("◀️ GAMES","g33:home")]])}
}
async function gameCancelMine33(uid){
  const g=(await pool.query("select * from public.wiener_game_matches where state in ('open','active') and (player1_id=$1 or player2_id=$1) order by created_at desc limit 1",[uid])).rows[0];if(!g)throw new Error("no_active_match");
  if(g.state==="open"&&Number(g.player1_id)===uid){await gameRefundOpen33(g.id,"challenge_cancelled");return}
  if(g.mode==="bot"&&g.state==="active"&&!g.player1_action&&String(g.board||".........")==="........."){
    const c=await pool.connect();try{await c.query("begin");const z=await gameGet33(g.id,true,c);if(z&&z.state==="active"){await gameCredit33(c,uid,z.bet,0,z.id,"game_refund","Bot game cancelled before first move");await c.query("update public.wiener_game_matches set state='refunded',outcome='cancelled_before_action',result_text='Stake refunded',settled_at=now() where id=$1",[z.id])}await c.query("commit")}catch(e){await c.query("rollback").catch(()=>null);throw e}finally{c.release()}return
  }
  throw new Error("active_pvp_use_forfeit_or_timeout")
}
async function handleGamesV33(up,uid,text,m,q){
  uid=Number(q?.from?.id||m?.from?.id||uid||0);text=String(m?.text||text||"").trim();await gameExpire33().catch(()=>null);
  if(m&&/^\/(games|play|challenge)(?:@\w+)?(?:\s|$)/i.test(text)){
    if(!["group","supergroup"].includes(String(m.chat?.type||""))){await safeTg18("sendMessage",{chat_id:m.chat.id,text:"🎮 WIENER Group Games work inside Telegram groups."});return true}
    const x=/^\/challenge/i.test(text)?gamePick33("pvp"):await gameHub33(m.chat.id,uid);await safeTg18("sendMessage",{chat_id:m.chat.id,text:x.text,reply_markup:x.markup});return true
  }
  if(m&&/^\/gamestats(?:@\w+)?$/i.test(text)){const x=await gameStats33(uid);await safeTg18("sendMessage",{chat_id:m.chat.id,text:x.text,reply_markup:x.markup});return true}
  if(m&&/^\/gameleaderboard(?:@\w+)?$/i.test(text)){if(!["group","supergroup"].includes(String(m.chat?.type||""))){await safeTg18("sendMessage",{chat_id:m.chat.id,text:"Use this command in a group."});return true}const x=await gameBoard33(m.chat.id);await safeTg18("sendMessage",{chat_id:m.chat.id,text:x.text,reply_markup:x.markup});return true}
  if(m&&/^\/cancelgame(?:@\w+)?$/i.test(text)){try{await gameCancelMine33(uid);await safeTg18("sendMessage",{chat_id:m.chat.id,text:"✅ Game cancelled/refunded where allowed."})}catch(e){await safeTg18("sendMessage",{chat_id:m.chat.id,text:"❌ "+String(e?.message||e).replace(/_/g," ")})}return true}
  if(!q||!String(q.data||"").startsWith("g33:"))return false;
  const a=String(q.data).split(":"),act=a[1];
  try{
    if(act==="home"){await edit18(q,await gameHub33(q.message.chat.id,uid))}
    else if(act==="mode"){await edit18(q,gamePick33(a[2]))}
    else if(act==="pick"){await edit18(q,gameBet33(a[2],a[3]))}
    else if(act==="start"){await gameCreate33(q,a[2],a[3],a[4]);await safeTg18("answerCallbackQuery",{callback_query_id:q.id,text:a[2]==="pvp"?"Challenge created":"Game started"});return true}
    else if(act==="accept"){const g=await gameAccept33(q,a[2]);await edit18(q,await gameCard33(g))}
    else if(act==="cancel"){const g=await gameGet33(a[2]);if(!g||Number(g.player1_id)!==uid)throw new Error("creator_only");await gameRefundOpen33(g.id,"challenge_cancelled");await edit18(q,await gameCard33(g.id))}
    else if(act==="roll"){await gameDice33(q,a[2]);await edit18(q,await gameCard33(a[2]))}
    else if(act==="rps"){await gameRps33(q,a[2],a[3]);await edit18(q,await gameCard33(a[2]))}
    else if(act==="ttt"){await gameTtt33(q,a[2],a[3]);await edit18(q,await gameCard33(a[2]))}
    else if(act==="forfeit"){await gameForfeit33(q,a[2]);await edit18(q,await gameCard33(a[2]))}
    else if(act==="timeout"){await gameTimeout33(q,a[2]);await edit18(q,await gameCard33(a[2]))}
    else if(act==="stats"){await edit18(q,await gameStats33(uid))}
    else if(act==="board"){await edit18(q,await gameBoard33(q.message.chat.id))}
    else return false;
    await safeTg18("answerCallbackQuery",{callback_query_id:q.id,text:"Updated"});return true
  }catch(e){await safeTg18("answerCallbackQuery",{callback_query_id:q.id,text:String(e?.message||e).replace(/_/g," ").slice(0,180),show_alert:true});return true}
}
const gameSweep33=setInterval(()=>gameExpire33().catch(e=>console.error("game33_sweep",String(e?.message||e))),60000);if(gameSweep33.unref)gameSweep33.unref();
// === END WIENER GROUP GAMES V33 ===
'''

s=s.replace(marker,"\n"+code+marker,1)

anchor="uid=Number(q?.from?.id||m?.from?.id||uid||0);text=String(m?.text||text||'').trim();"
pos=s.find(anchor,s.find("async function handleBotFullV18"))
if pos<0:
    raise SystemExit("ERROR: V18 handler normalization anchor missing")
insert=anchor+"\n  if(await handleGamesV33(up,uid,text,m,q))return true;"
s=s[:pos]+s[pos:].replace(anchor,insert,1)

cmd_anchor="{command:'addtask',description:'Create sponsored task'}"
if cmd_anchor in s:
    s=s.replace(cmd_anchor,cmd_anchor+",{command:'games',description:'Play WIENER group games'},{command:'gamestats',description:'Your game stats'},{command:'gameleaderboard',description:'Group game leaderboard'},{command:'cancelgame',description:'Cancel eligible game'}",1)
else:
    cmd_anchor="{command:'addtask',description:'Create & manage sponsored tasks'}"
    if cmd_anchor in s:
        s=s.replace(cmd_anchor,cmd_anchor+",{command:'games',description:'Play WIENER group games'},{command:'gamestats',description:'Your game stats'},{command:'gameleaderboard',description:'Group game leaderboard'},{command:'cancelgame',description:'Cancel eligible game'}",1)
    else:
        print("WARNING: command menu anchor not found; /games still works")

p.write_text(s)
print("V33 installed: Dice + RPS + Tic-Tac-Toe, PvP + VS Bot, WIENER stakes")
