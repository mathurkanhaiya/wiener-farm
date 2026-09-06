#!/usr/bin/env bash
set -euo pipefail

cd /opt/wiener-code
DB=wiener_farm_final
BACKEND=/opt/wiener-backend/server.mjs
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${BACKEND}.bak-v65-${STAMP}"

echo '=== V65 GIVEAWAY PARTICIPATION CONFIRMATION SAFE INSTALL ==='
[[ -f "$BACKEND" ]] || { echo 'ERROR: backend server.mjs not found' >&2; exit 1; }
node --check "$BACKEND"

grep -q 'WIENER GIVEAWAY PARTICIPATION UX V60' "$BACKEND" || { echo 'ERROR: V60 giveaway participation patch missing' >&2; exit 1; }

ACTIVE_BC="$(runuser -u postgres -- psql -d "$DB" -Atqc "select count(*) from public.admin_broadcast_sessions where step='media_sending'" 2>/dev/null || echo 0)"
if [[ "${ACTIVE_BC:-0}" != "0" ]]; then
  echo 'ERROR: active V57 media broadcast detected; wait for it to finish before installing V65.' >&2
  exit 1
fi

cp -a "$BACKEND" "$BACKUP"
rollback(){
  echo 'ERROR: V65 install failed; restoring backend backup.' >&2
  cp -a "$BACKUP" "$BACKEND"
  node --check "$BACKEND" >/dev/null 2>&1 && pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
}
trap rollback ERR

cat >/tmp/patch-v65-giveaway-confirmation.py <<'PY'
from pathlib import Path
p=Path('/opt/wiener-backend/server.mjs')
s=p.read_text()
marker='// === WIENER GIVEAWAY PARTICIPATION CONFIRMATION V65 ==='
if marker in s:
    print('V65 already installed')
    raise SystemExit(0)

anchor='async function g60finishEntry(g,uid,z,wallet){'
if anchor not in s:
    raise SystemExit('ERROR: g60finishEntry anchor missing')

helper=r'''
// === WIENER GIVEAWAY PARTICIPATION CONFIRMATION V65 ===
async function g65ParticipationConfirmation(g,uid,entry,wallet){
  try{
    const reqs=await g60reqs(g.id);
    const reqLines=reqs.map(r=>`• ${g60reqLabel(r)}`);
    if(g.gram_wallet_required||String(g.prize_type||'').toLowerCase()==='gram')reqLines.push('• GRAM wallet saved');
    const walletLine=wallet?.friendly?`\n👛 Wallet: <code>${g60esc(g60shortWallet(wallet.friendly))}</code>`:'';
    const code=entry?.entry_code?`\n🎟 Entry ID: <code>${g60esc(entry.entry_code)}</code>`:'';
    const text=`✅ <b>You are participating!</b> 🎉\n\n🎁 <b>${g60esc(g.title||'WIENER Giveaway')}</b>\n💰 Prize: <b>${g60esc(g60prize(g))}</b>\n🏆 Winners: <b>${g60n(g.winner_count)||1}</b>\n⏰ Ends: <b>${g60esc(g60end(g))}</b>${code}${walletLine}\n\n<b>Requirements</b>\n${reqLines.length?reqLines.join('\n'):'• No extra requirements'}\n\n✅ Your giveaway entry has been confirmed. Good luck! 🍀`;
    await g60send(uid,text,g60kb([[g60cb('📊 CHECK STATUS',`g60:join:${g.id}`)],[g60cb('🎁 GIVEAWAY DETAILS',`g60:view:${g.id}`)]]));
  }catch(e){console.error('v65_giveaway_confirmation',String(e?.message||e))}
}

'''
s=s.replace(anchor,helper+anchor,1)

old='  await g60clearSession(uid);return q.rows[0];'
new="  await g60clearSession(uid);\n  const entry=q.rows[0];\n  await g65ParticipationConfirmation(g,uid,entry,wallet);\n  return entry;"
if old not in s:
    raise SystemExit('ERROR: g60finishEntry completion line changed')
s=s.replace(old,new,1)

p.write_text(s)
print('V65 giveaway participation confirmation patch installed')
PY

python3 /tmp/patch-v65-giveaway-confirmation.py
node --check "$BACKEND"

echo '=== RESTART ==='
pm2 restart wiener-api --update-env
sleep 3
pm2 status wiener-api
curl -fsS http://127.0.0.1:3000/health || curl -fsS http://127.0.0.1:3000/
echo
pm2 save >/dev/null

echo '=== VERIFY ==='
grep -q 'WIENER GIVEAWAY PARTICIPATION CONFIRMATION V65' "$BACKEND"
grep -q 'g65ParticipationConfirmation' "$BACKEND"
echo 'save_participate_confirmation=enabled'
echo 'giveaway_details_in_confirmation=enabled'
echo '=== V65 READY ==='
trap - ERR
