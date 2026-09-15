#!/usr/bin/env bash
set -euo pipefail

cd /opt/wiener-code
BACKEND=/opt/wiener-backend/server.mjs
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${BACKEND}.bak-v61-${STAMP}"

echo '=== V61 GIVEAWAY DEEP-LINK BUTTON SAFE INSTALL ==='
[[ -f "$BACKEND" ]] || { echo 'ERROR: backend server.mjs not found' >&2; exit 1; }
node --check "$BACKEND"

# Do not interrupt V57's in-memory media broadcast.
if runuser -u postgres -- psql -d wiener_farm_final -Atqc "select count(*) from public.admin_broadcast_sessions where step='media_sending'" 2>/dev/null | grep -qv '^0$'; then
  echo 'ERROR: active V57 media broadcast detected. Wait for it to finish before restarting backend.' >&2
  exit 1
fi

cp -a "$BACKEND" "$BACKUP"
rollback(){
  echo 'ERROR: V61 install failed; restoring backend backup.' >&2
  cp -a "$BACKUP" "$BACKEND"
  node --check "$BACKEND" >/dev/null 2>&1 && pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
}
trap rollback ERR

cat >/tmp/patch-v61-giveaway-deeplink.py <<'PY'
from pathlib import Path
p=Path('/opt/wiener-backend/server.mjs')
s=p.read_text()
marker='// === WIENER GIVEAWAY DEEPLINK BUTTON V61 ==='
if marker in s:
    print('V61 already installed')
    raise SystemExit(0)
if '// === WIENER ADVANCED GIVEAWAY V59 ===' not in s:
    raise SystemExit('ERROR: V59 giveaway backend missing')
if '// === WIENER GIVEAWAY PARTICIPATION UX V60 ===' not in s:
    raise SystemExit('ERROR: V60 giveaway UX missing')

# Future publishes: PARTICIPATE must be a bot deep-link, not a channel callback.
old="g59kb([[g59cb('🎁 PARTICIPATE',`g59j:${g.id}`)],[g59url('🌭 OPEN WIENER FARM',G59_APP)]])"
new="g59kb([[g59url('🎁 PARTICIPATE',`https://t.me/WienerDogeFarmBot?start=${encodeURIComponent(g.public_id)}`)],[g59url('🌭 OPEN WIENER FARM',G59_APP)]])"
if old not in s:
    raise SystemExit('ERROR: V59 publish participate markup not found')
s=s.replace(old,new,1)

# Add a reusable post/repost helper before the final route.
route="\napp.use((_req,res)=>\n  res.status(404).json({ok:false,error:'route_not_enabled_yet'})\n);\n"
if route not in s:
    raise SystemExit('ERROR: final route marker missing')
code=r'''

// === WIENER GIVEAWAY DEEPLINK BUTTON V61 ===
function g61deepLink(g){return `https://t.me/WienerDogeFarmBot?start=${encodeURIComponent(String(g.public_id||''))}`}
async function g61publicText(g){
  const reqs=await pool.query(`select requirement_type,label,target_value,target_text,target_chat from public.wiener_giveaway_requirements where giveaway_id=$1 order by sort_order,id`,[g.id]);
  const rows=reqs.rows.map(r=>{
    const t=String(r.requirement_type||'');
    if(t==='join_channel'||t==='join_group')return `• ${r.label||'Join'}${r.target_chat?` · ${r.target_chat}`:''}`;
    if(t==='name_contains')return `• Name must contain: ${r.target_text||''}`;
    if(t==='bio_contains')return `• Bio must contain: ${r.target_text||''}`;
    if(r.target_value!=null)return `• ${r.label||t} · ${r.target_value}`;
    return `• ${r.label||t}`;
  });
  if(g.gram_wallet_required||String(g.prize_type).toLowerCase()==='gram')rows.push('• GRAM wallet required');
  return `🎁 ${g.title}\n\n💰 Prize: ${g59fmt(g.prize_amount,9)} ${String(g.prize_type).toUpperCase()} each\n🏆 Winners: ${g.winner_count}\n⏰ Ends: ${g.ends_at?new Date(g.ends_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'}):'—'}${rows.length?'\n\n📋 Requirements\n'+rows.join('\n'):''}`;
}
async function g61postGiveaway(admin,id){
  if(!(await g59admin(admin)))throw new Error('admin_required');
  const g=(await pool.query(`select * from public.wiener_giveaways where id=$1`,[id])).rows[0];
  if(!g)throw new Error('giveaway_not_found');
  const text=await g61publicText(g);
  const m=await tgV10('sendMessage',{
    chat_id:g.publish_chat_id||'@WienerFarm',
    text,
    reply_markup:g59kb([
      [g59url('🎁 PARTICIPATE',g61deepLink(g))],
      [g59url('🌭 OPEN WIENER FARM',G59_APP)]
    ]),
    disable_web_page_preview:true
  });
  await pool.query(`update public.wiener_giveaways set published_message_id=$2,published_at=now(),updated_at=now() where id=$1`,[g.id,m?.message_id||null]);
  await g59log(admin,g.id,'reposted',null,{message_id:m?.message_id||null,deep_link:g61deepLink(g)});
  return g;
}
async function handleGiveawayPostV61(up,uid,text,m,q){
  uid=Number(q?.from?.id||m?.from?.id||uid||0);if(!uid)return false;
  if(m&&/^\/giveaway_post(?:@\w+)?\s+/i.test(String(text||''))){
    if(!(await g59admin(uid)))return true;
    const key=String(text).trim().split(/\s+/)[1]||'';
    const g=(await pool.query(`select * from public.wiener_giveaways where id::text=$1 or public_id=$1 limit 1`,[key])).rows[0];
    if(!g){await g59send(uid,'❌ Giveaway not found.');return true}
    await g61postGiveaway(uid,g.id);
    await g59send(uid,`✅ Giveaway posted with deep-link PARTICIPATE button.\n\n${g61deepLink(g)}`);
    return true;
  }
  if(q&&String(q.data||'').startsWith('g61:post:')){
    if(!(await g59admin(uid))){await g59answer(q,'Admin only',true);return true}
    const id=Number(String(q.data).split(':')[2]||0);
    const g=await g61postGiveaway(uid,id);
    await g59answer(q,'Giveaway posted');
    await g59send(uid,`✅ Posted to ${g.publish_chat_id||'@WienerFarm'}\n\n${g61deepLink(g)}`);
    return true;
  }
  return false;
}
'''
s=s.replace(route,code+route,1)

# Put V61 handler before V60 so admin post callbacks/commands are handled cleanly.
handler="uid=Number(q?.from?.id||m?.from?.id||uid||0);text=String(m?.text||text||'').trim();\n  if(!uid&&!q)return false;"
if handler not in s:
    raise SystemExit('ERROR: current bot handler insertion point missing')
s=s.replace(handler,handler+"\n  try{if(await handleGiveawayPostV61(up,uid,text,m,q))return true;}catch(e){console.error('v61_giveaway_post',String(e?.message||e));}",1)

# Add POST / REPOST to the V59 admin giveaway card.
needle="[g59cb('🎲 DRAW WINNERS',`g59:draw:${id}`)],[g59cb('◀️ BACK','g59:home')]"
repl="[g59cb('📢 POST / REPOST',`g61:post:${id}`)],[g59cb('🎲 DRAW WINNERS',`g59:draw:${id}`)],[g59cb('◀️ BACK','g59:home')]"
if needle not in s:
    raise SystemExit('ERROR: V59 giveaway card markup anchor missing')
s=s.replace(needle,repl,1)

p.write_text(s)
print('V61 giveaway deep-link button patch installed')
PY

python3 /tmp/patch-v61-giveaway-deeplink.py
node --check "$BACKEND"

echo '=== RESTART ==='
pm2 restart wiener-api --update-env
sleep 3
pm2 status wiener-api
curl -fsS http://127.0.0.1:3000/health || curl -fsS http://127.0.0.1:3000/
echo
pm2 save >/dev/null

echo '=== VERIFY ==='
grep -q 'WIENER GIVEAWAY DEEPLINK BUTTON V61' "$BACKEND"
grep -q "WienerDogeFarmBot?start=\${encodeURIComponent(g.public_id)}" "$BACKEND"
echo 'deep_link_publish=ok'
echo '=== V61 READY ==='
trap - ERR
