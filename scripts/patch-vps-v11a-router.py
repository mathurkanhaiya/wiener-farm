from pathlib import Path
p=Path('/opt/wiener-backend/server.mjs')
s=p.read_text()
if 'WIENER VPS ROUTER V11A' in s:
 print('V11A already installed'); raise SystemExit(0)
hook="""    const m=up.message;\n    const q=up.callback_query;\n    const uid=Number(q?.from?.id||m?.from?.id||0);\n    const text=String(m?.text||'').trim();\n"""
if hook not in s: raise SystemExit('ERROR: V7B webhook hook not found')
extra=r'''

    // === WIENER VPS ROUTER V11A ===
    try{
      if(up.my_chat_member?.chat?.id){
        const c=up.my_chat_member.chat,status=String(up.my_chat_member.new_chat_member?.status||'member'),active=!['left','kicked'].includes(status);
        await pool.query(`insert into public.bot_chats(chat_id,chat_type,title,username,bot_status,can_post,active,last_seen_at) values($1,$2,$3,$4,$5,$6,$6,now()) on conflict(chat_id) do update set chat_type=excluded.chat_type,title=excluded.title,username=excluded.username,bot_status=excluded.bot_status,can_post=excluded.can_post,active=excluded.active,last_seen_at=now()`,[Number(c.id),String(c.type||''),c.title||null,c.username||null,status,active]);
        return done();
      }
      if(m?.chat?.id&&m.chat.type!=='private')await pool.query(`insert into public.bot_chats(chat_id,chat_type,title,username,bot_status,can_post,active,last_seen_at) values($1,$2,$3,$4,'member',true,true,now()) on conflict(chat_id) do update set chat_type=excluded.chat_type,title=excluded.title,username=excluded.username,bot_status='member',can_post=true,active=true,last_seen_at=now()`,[Number(m.chat.id),String(m.chat.type||''),m.chat.title||null,m.chat.username||null]);
    }catch(e){console.error('v11a_chat_track',String(e?.message||e))}

    if(m?.chat?.type==='private'&&/^\/(addbalance|removebalance)(?:@\w+)?(?:\s|$)/i.test(text)){
      const a=await isAdmin(uid);if(!a){await tgV7B('sendMessage',{chat_id:uid,text:'⛔ Admin permission required.'});return done()}
      const mm=text.match(/^\/(addbalance|removebalance)(?:@\w+)?\s+(\d+)\s+([0-9.]+)(?:\s+(.+))?$/i);
      if(!mm){await tgV7B('sendMessage',{chat_id:uid,text:'Usage: /addbalance <UID> <amount> [reason]\n/removebalance <UID> <amount> [reason]'});return done()}
      const target=Number(mm[2]),amt=Math.abs(Number(mm[3]||0));if(!target||!Number.isFinite(amt)||amt<=0){await tgV7B('sendMessage',{chat_id:uid,text:'❌ Invalid UID or amount.'});return done()}
      const delta=mm[1].toLowerCase()==='removebalance'?-amt:amt,reason=String(mm[4]||`Bot ${mm[1]}`);
      try{await rpc('admin_adjust_balance',[uid,target,delta,reason]);await pool.query(`insert into public.bot_admin_audit(admin_id,action,target_telegram_id,details) values($1,'balance_adjust',$2,$3::jsonb)`,[uid,target,JSON.stringify({amount:delta,reason})]);await tgV7B('sendMessage',{chat_id:uid,text:`✅ Balance Updated\n\nUID: ${target}\nChange: ${delta>0?'+':''}${delta.toLocaleString()} WIENER\nReason: ${reason}`})}catch(e){await tgV7B('sendMessage',{chat_id:uid,text:`❌ ${String(e?.message||e)}`})}
      return done();
    }

    if(q&&String(q.data||'').startsWith('v11toggle:')){
      const a=await isAdmin(uid);if(!a){await tgV7B('answerCallbackQuery',{callback_query_id:q.id,text:'Admin permission required',show_alert:true});return done()}
      const key=String(q.data).slice(10),allowed=['maintenance_enabled','withdrawals_enabled','ads_enabled','tasks_enabled','referrals_enabled','promo_enabled'];
      if(!allowed.includes(key)){await tgV7B('answerCallbackQuery',{callback_query_id:q.id,text:'Invalid setting',show_alert:true});return done()}
      const cur=!!(await pool.query(`select "${key}" v from public.app_settings where id=true`)).rows[0]?.v;
      await pool.query(`update public.app_settings set "${key}"=$1,updated_at=now() where id=true`,[!cur]);
      await pool.query(`insert into public.bot_admin_audit(admin_id,action,details) values($1,'settings_toggle',$2::jsonb)`,[uid,JSON.stringify({key,from:cur,to:!cur})]);
      await tgV7B('answerCallbackQuery',{callback_query_id:q.id,text:!cur?'Enabled':'Disabled'});await tgV7B('sendMessage',{chat_id:uid,text:`✅ ${key.replace(/_/g,' ')}: ${!cur?'ON':'OFF'}`});return done();
    }
'''
s=s.replace(hook,hook+extra,1)
marker="\napp.use((_req,res)=>\n  res.status(404).json({ok:false,error:'route_not_enabled_yet'})\n);\n"
if marker not in s: raise SystemExit('ERROR: final marker not found')
s=s.replace(marker,"\n// === WIENER VPS ROUTER V11A ===\n"+marker,1)
p.write_text(s)
print('Installed WIENER VPS ROUTER V11A')
