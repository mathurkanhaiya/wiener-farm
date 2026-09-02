from pathlib import Path

p=Path('/opt/wiener-backend/server.mjs')
s=p.read_text()
marker="\napp.use((_req,res)=>\n  res.status(404).json({ok:false,error:'route_not_enabled_yet'})\n);\n"
if 'WIENER VPS BOT ROUTES V7B' in s:
    print('WIENER VPS BOT ROUTES V7B already installed')
    raise SystemExit(0)
if marker not in s:
    raise SystemExit('ERROR: insertion marker not found')

code=r'''
// === WIENER VPS BOT ROUTES V7B ===

async function botSecretV7B(){
  const q=await pool.query(`select telegram_webhook_secret from public.app_settings where id=true limit 1`);
  return String(q.rows[0]?.telegram_webhook_secret||'');
}

async function tgV7B(method,payload){
  const r=await fetch(`https://api.telegram.org/bot${BOT}/${method}`,{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify(payload)
  });
  const x=await r.json();
  if(!x.ok) throw new Error(x.description||method);
  return x.result;
}

const kbV7B=rows=>({inline_keyboard:rows});
const cbV7B=(text,data)=>({text,callback_data:data});
const webV7B=(text,url)=>({text,web_app:{url}});
const urlV7B=(text,url)=>({text,url});
const fmtV7B=v=>Number(v||0).toLocaleString(undefined,{maximumFractionDigits:2});

async function settingsV7B(){
  return (await pool.query(`select * from public.app_settings where id=true limit 1`)).rows[0]||{};
}

async function userV7B(id){
  return (await pool.query(`select * from public.users where telegram_id=$1 limit 1`,[id])).rows[0]||null;
}

function appUrlV7B(s){
  return String(s.app_url||'https://wiener-farm.vercel.app').replace(/\/$/,'');
}

async function sendHomeV7B(uid){
  const s=await settingsV7B();
  const u=await userV7B(uid);
  const app=appUrlV7B(s);
  if(!u){
    await tgV7B('sendMessage',{
      chat_id:uid,
      text:'🌭 WIENER FARM\n\nOpen the Mini App to create your account.',
      reply_markup:kbV7B([[webV7B('🌭 OPEN WIENER FARM',app)]])
    });
    return;
  }
  const usd=Number(u.balance||0)/Math.max(1,Number(s.token_per_usdt||10000));
  const text=[
    '🌭 WIENER FARM',
    '',
    `💰 ${fmtV7B(u.balance)} WIENER · ≈ ${usd.toFixed(4)} USDT`,
    `🔥 ${Number(u.daily_streak||0)} day streak`,
    `📺 ${Number(u.total_ads||0)} ads completed`,
    `👥 ${Number(u.active_referrals_count||0)}/${Number(u.referrals_count||0)} qualified referrals`,
    '',
    'Choose an option below.'
  ].join('\n');
  await tgV7B('sendMessage',{
    chat_id:uid,
    text,
    disable_web_page_preview:true,
    reply_markup:kbV7B([
      [webV7B('🌭 OPEN WIENER FARM',app)],
      [cbV7B('💰 Balance','v7b:balance'),cbV7B('📊 Profile','v7b:profile')],
      [cbV7B('📺 Ads','v7b:ads'),cbV7B('✅ Tasks','v7b:tasks')],
      [cbV7B('👥 Referrals','v7b:refs'),cbV7B('🏆 Leaderboard','v7b:leaderboard')],
      [cbV7B('💸 Withdrawals','v7b:wallet'),cbV7B('❓ Help','v7b:help')]
    ])
  });
}

async function viewV7B(uid,key){
  const s=await settingsV7B();
  const u=await userV7B(uid);
  const app=appUrlV7B(s);
  const back=[cbV7B('◀️ MAIN MENU','v7b:home')];
  if(!u) return {text:'Open WIENER Farm first.',markup:kbV7B([[webV7B('OPEN',app)]])};

  if(key==='balance'){
    const q=await pool.query(`select amount,description from public.transactions where telegram_id=$1 order by created_at desc limit 3`,[uid]);
    const recent=q.rows.map(x=>`${Number(x.amount)>=0?'➕':'➖'} ${fmtV7B(Math.abs(Number(x.amount)))} · ${String(x.description||'Transaction').slice(0,36)}`).join('\n')||'No transactions yet.';
    return {text:`💰 BALANCE\n\nAvailable: ${fmtV7B(u.balance)} WIENER\n≈ ${(Number(u.balance||0)/Math.max(1,Number(s.token_per_usdt||10000))).toFixed(4)} USDT\n📈 Total earned: ${fmtV7B(u.total_earned)} WIENER\n💸 Total withdrawn: ${fmtV7B(u.total_withdrawn)} WIENER\n\n${recent}`,markup:kbV7B([[webV7B('💸 OPEN WALLET',`${app}?page=wallet`)],back])};
  }
  if(key==='profile') return {text:`📊 PROFILE\n\n${u.first_name||u.username||'WIENER User'}${u.username?` · @${u.username}`:''}\nUID: ${uid}\n\n💰 ${fmtV7B(u.balance)} WIENER\n📈 Earned: ${fmtV7B(u.total_earned)}\n📺 Ads: ${Number(u.total_ads||0)}\n🔥 Streak: ${Number(u.daily_streak||0)}\n👥 Referrals: ${Number(u.referrals_count||0)}\n✅ Qualified: ${Number(u.active_referrals_count||0)}`,markup:kbV7B([[webV7B('📊 OPEN PROFILE',`${app}?page=profile`)],back])};
  if(key==='ads') return {text:`📺 ADS\n\nToday: ${Number(u.ads_watched_today||0)}/${Number(s.daily_ad_limit||0)}\nTotal: ${Number(u.total_ads||0)}\nReward: +${fmtV7B(s.ad_reward)} WIENER`,markup:kbV7B([[webV7B('📺 WATCH ADS',`${app}?page=ads`)],back])};
  if(key==='tasks'){
    const q=await pool.query(`select count(*)::int c from public.task_completions where telegram_id=$1`,[uid]);
    return {text:`✅ TASKS\n\nCompleted: ${Number(q.rows[0]?.c||0)}`,markup:kbV7B([[webV7B('✅ VIEW TASKS',`${app}?page=tasks`)],back])};
  }
  if(key==='refs'){
    const bot=String(s.bot_username||'WienerDogeFarmBot').replace('@','');
    const link=`https://t.me/${bot}?startapp=ref_${uid}`;
    return {text:`👥 REFERRALS\n\nInvited: ${Number(u.referrals_count||0)}\nQualified: ${Number(u.active_referrals_count||0)}\nEarned: ${fmtV7B(u.referral_earnings)} WIENER`,markup:kbV7B([[urlV7B('📤 SHARE INVITE',`https://t.me/share/url?url=${encodeURIComponent(link)}`)],[webV7B('👥 OPEN REFERRALS',`${app}?page=invite`)],back])};
  }
  if(key==='wallet'){
    const q=await pool.query(`select status,receive_usdt,network from public.withdrawals where telegram_id=$1 order by created_at desc limit 3`,[uid]);
    const rows=q.rows.map(x=>`${x.status==='paid'?'✅':x.status==='rejected'?'❌':'⏳'} ${Number(x.receive_usdt||0).toFixed(4)} USDT · ${x.network||''}`).join('\n')||'No withdrawals yet.';
    return {text:`💸 WITHDRAWALS\n\nBalance: ${fmtV7B(u.balance)} WIENER\n\n${rows}`,markup:kbV7B([[webV7B('💸 OPEN WALLET',`${app}?page=wallet`)],back])};
  }
  if(key==='help') return {text:'❓ WIENER HELP\n\n/menu — Main menu\n/balance — Balance\n/profile — Profile\n/ads — Ads\n/tasks — Tasks\n/referral — Referrals\n/leaderboard — Rankings\n/withdraw — Wallet\n/help — Help',markup:kbV7B([[webV7B('🌭 OPEN WIENER FARM',app)],back])};
  return {text:'🏆 LEADERBOARD\n\nChoose ranking:',markup:kbV7B([[cbV7B('👥 TOP REFERRALS','v7blb:inviters'),cbV7B('💰 TOTAL EARNED','v7blb:earners')],back])};
}

async function leaderboardV7B(uid,mode){
  const x=await rpc('get_wiener_invite_leaderboards',[uid]);
  const rows=(x?.[mode]||[]).slice(0,10);
  const me=x?.me?.[mode];
  const medals=['🥇','🥈','🥉'];
  const unit=v=>mode==='inviters'?`${fmtV7B(v)} referrals`:`${fmtV7B(v)} WIENER`;
  const display=r=>[r.first_name,r.last_name].filter(Boolean).join(' ').trim()||(r.username?'@'+r.username:`User ${String(r.telegram_id).slice(-4)}`);
  const lines=rows.map((r,i)=>`${medals[i]||`${i+1}.`} ${display(r)}\n   ${unit(r.value)}`).join('\n');
  return `🏆 WIENER FARM LEADERBOARD\n\n${mode==='inviters'?'👥 TOP REFERRALS':'💰 TOTAL EARNED'}\n\n${lines||'No rankings yet.'}\n\n👤 Your rank: ${me?.rank?`#${me.rank}`:'Unranked'} · ${unit(me?.value||0)}`;
}

app.post('/functions/v1/wiener-bot-webhook',async(req,res)=>{
  try{
    const sec=await botSecretV7B();
    if(!sec||String(req.headers['x-telegram-bot-api-secret-token']||'')!==sec) return res.status(403).send('forbidden');
    const up=req.body||{};
    const updateId=Number(up.update_id);
    if(Number.isFinite(updateId)){
      try{await pool.query(`insert into public.telegram_processed_updates(update_id) values($1)`,[updateId]);}
      catch(e){if(e?.code==='23505') return res.json({ok:true,duplicate:true}); throw e;}
    }
    const done=async()=>{
      if(Number.isFinite(updateId)) await pool.query(`update public.telegram_processed_updates set completed_at=now() where update_id=$1`,[updateId]);
      return res.json({ok:true});
    };
    const m=up.message;
    const q=up.callback_query;
    const uid=Number(q?.from?.id||m?.from?.id||0);
    const text=String(m?.text||'').trim();

    if(m?.from?.id&&m?.forward_origin?.sender_user?.username){
      const src=String(m.forward_origin.sender_user.username).toLowerCase();
      const vr=await pool.query(`select id,expected_bot_username from public.bot_task_verifications where telegram_id=$1 and status='pending' order by requested_at desc limit 5`,[uid]);
      for(const v of vr.rows){
        if(String(v.expected_bot_username||'').toLowerCase()===src){
          await pool.query(`update public.bot_task_verifications set status='verified',verified_at=now(),forwarded_bot_username=$2,updated_at=now() where id=$1`,[v.id,src]);
          await tgV7B('sendMessage',{chat_id:uid,text:'✅ Bot task verified. Return to WIENER Farm and tap CLAIM.'});
          break;
        }
      }
    }

    if(/^\/start(?:@\w+)?(?:\s|$)/i.test(text)&&m?.chat?.type==='private'){
      const parts=text.split(/\s+/);
      const mm=String(parts[1]||'').match(/(?:ref_|r_?)(\d{5,20})/i);
      const ref=mm?Number(mm[1]):null;
      await rpc('register_or_touch_user',[uid,m.from.username||null,m.from.first_name||null,m.from.last_name||null,null,ref&&ref!==uid?ref:null]);
      const s=await settingsV7B();
      const caption='🌭 Welcome to WIENER FARM! 🚜\n\n💰 Farm WIENER every day\n📺 Watch ads & earn instantly\n✅ Complete tasks for extra rewards\n👥 Invite friends & earn referral rewards\n💸 Withdraw USDT via TON or Polygon\n\n🔥 Your farm is waiting — start earning now!';
      const markup=kbV7B([[webV7B('🌭 OPEN WIENER FARM',appUrlV7B(s))],[urlV7B('📢 Channel','https://t.me/WienerFarm'),urlV7B('💬 Support','https://t.me/WienerSupport')]]);
      try{await tgV7B('sendPhoto',{chat_id:uid,photo:'https://wiener-farm.vercel.app/api/host/welcome-image',caption,reply_markup:markup});}
      catch{await tgV7B('sendMessage',{chat_id:uid,text:caption,reply_markup:markup});}
      return done();
    }

    if(/^\/(ban|unban)(?:@\w+)?\s+(\d+)/i.test(text)){
      const mm=text.match(/^\/(ban|unban)(?:@\w+)?\s+(\d+)/i);
      const admin=await isAdmin(uid);
      if(!admin){await tgV7B('sendMessage',{chat_id:uid,text:'⛔ Admin permission required.'});return done();}
      const target=Number(mm[2]);
      const ban=mm[1].toLowerCase()==='ban';
      if(ban) await pool.query(`update public.users set is_banned=true,ban_reason='Admin action' where telegram_id=$1`,[target]);
      else {
        await pool.query(`update public.users set is_banned=false,ban_reason=null,device_blocked=false where telegram_id=$1`,[target]);
        await rpc('admin_unban_device_user',[uid,target]).catch(()=>null);
      }
      await tgV7B('sendMessage',{chat_id:uid,text:`✅ ${target} ${ban?'banned':'fully unbanned'}.`});
      return done();
    }

    if(q&&String(q.data||'').startsWith('v7blb:')){
      const mode=String(q.data).endsWith('earners')?'earners':'inviters';
      const txt=await leaderboardV7B(uid,mode);
      await tgV7B('editMessageText',{chat_id:q.message.chat.id,message_id:q.message.message_id,text:txt,reply_markup:kbV7B([[cbV7B('👥 REFERRALS','v7blb:inviters'),cbV7B('💰 EARNED','v7blb:earners')]])});
      await tgV7B('answerCallbackQuery',{callback_query_id:q.id});
      return done();
    }

    if(q&&String(q.data||'').startsWith('v7b:')){
      const key=String(q.data).slice(4);
      if(key==='home'){
        await tgV7B('deleteMessage',{chat_id:q.message.chat.id,message_id:q.message.message_id}).catch(()=>null);
        await sendHomeV7B(uid);
      }else{
        const v=await viewV7B(uid,key);
        await tgV7B('editMessageText',{chat_id:q.message.chat.id,message_id:q.message.message_id,text:v.text,reply_markup:v.markup,disable_web_page_preview:true});
      }
      await tgV7B('answerCallbackQuery',{callback_query_id:q.id}).catch(()=>null);
      return done();
    }

    if(/^\/leaderboard(?:@\w+)?$/i.test(text)){
      await tgV7B('sendMessage',{chat_id:uid,text:await leaderboardV7B(uid,'inviters'),reply_markup:kbV7B([[cbV7B('👥 REFERRALS','v7blb:inviters'),cbV7B('💰 EARNED','v7blb:earners')]])});
      return done();
    }

    const map={menu:'home',balance:'balance',profile:'profile',ads:'ads',tasks:'tasks',referral:'refs',invite:'refs',withdraw:'wallet',wallet:'wallet',help:'help',support:'help'};
    const cmd=text.startsWith('/')?text.split(/\s+/)[0].replace(/^\//,'').split('@')[0].toLowerCase():'';
    if(map[cmd]){
      if(map[cmd]==='home') await sendHomeV7B(uid);
      else {
        const v=await viewV7B(uid,map[cmd]);
        await tgV7B('sendMessage',{chat_id:uid,text:v.text,reply_markup:v.markup,disable_web_page_preview:true});
      }
      return done();
    }

    return done();
  }catch(e){
    console.error('v7b webhook',e);
    return res.status(500).json({ok:false,error:String(e?.message||e)});
  }
});

// === END WIENER VPS BOT ROUTES V7B ===
'''

s=s.replace(marker,'\n'+code+'\n'+marker,1)
p.write_text(s)
print('Installed WIENER VPS BOT ROUTES V7B')
