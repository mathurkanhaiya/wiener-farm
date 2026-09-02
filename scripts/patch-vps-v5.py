from pathlib import Path

p=Path('/opt/wiener-backend/server.mjs')
s=p.read_text()

if 'WIENER VPS BOT TASK V5' in s:
    print('WIENER VPS BOT TASK V5 already installed')
    raise SystemExit(0)

marker="\napp.use((_req,res)=>\n  res.status(404).json({ok:false,error:'route_not_enabled_yet'})\n);\n"
if marker not in s:
    raise SystemExit('route marker not found')

code=r'''

// === WIENER VPS BOT TASK V5 ===

function cleanTaskBot(v){
  return String(v||'').trim()
    .replace(/^https?:\/\/t\.me\//i,'')
    .replace(/^@/,'')
    .split(/[?\/]/)[0]
    .toLowerCase();
}

app.post('/functions/v1/wiener-bot-task',async(req,res)=>{
  try{
    const b=req.body||{};
    const {id}=await edgeUser(b);
    const action=String(b.action||'');
    const taskId=String(b.task_id||'');

    const tq=await pool.query(`
      select id,title,reward,url,telegram_chat_id,verification,enabled,expires_at
      from public.tasks
      where id=$1
      limit 1
    `,[taskId]);

    const t=tq.rows[0];
    if(!t||!t.enabled) throw new Error('task_not_found');
    if(t.expires_at&&new Date(t.expires_at)<=new Date()) throw new Error('task_expired');
    if(t.verification!=='bot_forward') throw new Error('not_bot_task');

    const expected=cleanTaskBot(t.telegram_chat_id||t.url);
    if(!expected) throw new Error('target_bot_missing');

    if(action==='begin'){
      await pool.query(`
        insert into public.bot_task_verifications(
          task_id,telegram_id,expected_bot_username,status,requested_at,updated_at
        ) values($1,$2,$3,'pending',now(),now())
        on conflict(task_id,telegram_id)
        do update set expected_bot_username=excluded.expected_bot_username,
                      status='pending',requested_at=now(),updated_at=now()
      `,[t.id,id,expected]);

      try{
        await telegramSend(id,
`🤖 Bot Task Verification

1. Start @${expected}
2. Forward ONE message you receive from @${expected} to this chat.
3. Return to WIENER and tap CHECK.

Copied text or screenshots will not verify.`);
      }catch{}

      return res.json({ok:true,data:{
        status:'pending',
        bot_username:expected,
        url:String(t.url||`https://t.me/${expected}`)
      }});
    }

    if(action==='status'){
      const q=await pool.query(`
        select status,verified_at,forwarded_bot_username
        from public.bot_task_verifications
        where task_id=$1 and telegram_id=$2
        limit 1
      `,[t.id,id]);
      const v=q.rows[0];
      return res.json({ok:true,data:{
        status:v?.status||'not_started',
        verified:v?.status==='verified',
        verified_at:v?.verified_at||null,
        bot_username:expected
      }});
    }

    throw new Error('unknown_action');
  }catch(e){
    return edgeFail(res,e);
  }
});

// === END WIENER VPS BOT TASK V5 ===
'''

s=s.replace(marker,code+marker,1)
p.write_text(s)
print('Installed WIENER VPS BOT TASK V5')
