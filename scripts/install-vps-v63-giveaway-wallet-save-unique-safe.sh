#!/usr/bin/env bash
set -euo pipefail

cd /opt/wiener-code
DB=wiener_farm_final
BACKEND=/opt/wiener-backend/server.mjs
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${BACKEND}.bak-v63-${STAMP}"

echo '=== V63 GIVEAWAY WALLET SAVE + UNIQUE SAFE INSTALL ==='
[[ -f "$BACKEND" ]] || { echo 'ERROR: backend server.mjs not found' >&2; exit 1; }
node --check "$BACKEND"

ACTIVE_BC="$(runuser -u postgres -- psql -d "$DB" -Atqc "select count(*) from public.admin_broadcast_sessions where step='media_sending'" 2>/dev/null || echo 0)"
if [[ "${ACTIVE_BC:-0}" != "0" ]]; then
  echo 'ERROR: active V57 media broadcast detected; wait for it to finish before installing V63.' >&2
  exit 1
fi

for mark in 'WIENER GIVEAWAY PARTICIPATION UX V60' 'WIENER GIVEAWAY TEXT REQUIREMENTS V62'; do
  grep -q "$mark" "$BACKEND" || { echo "ERROR: required backend patch missing: $mark" >&2; exit 1; }
done

cp -a "$BACKEND" "$BACKUP"
rollback(){
  echo 'ERROR: V63 install failed; restoring backend backup.' >&2
  cp -a "$BACKUP" "$BACKEND"
  node --check "$BACKEND" >/dev/null 2>&1 && pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
}
trap rollback ERR

echo '=== DATABASE ==='
runuser -u postgres -- psql -d "$DB" -v ON_ERROR_STOP=1 <<'SQL'
create table if not exists public.wiener_giveaway_wallet_owners(
  telegram_id bigint primary key,
  wallet_key text not null unique,
  wallet_address text not null,
  network text not null default 'TON',
  first_linked_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists wiener_giveaway_wallet_owners_wallet_key_uidx
  on public.wiener_giveaway_wallet_owners(wallet_key);
revoke all on table public.wiener_giveaway_wallet_owners from public;
SQL

echo '=== BACKEND PATCH ==='
cat >/tmp/patch-v63-giveaway-wallet.py <<'PY'
from pathlib import Path
p=Path('/opt/wiener-backend/server.mjs')
s=p.read_text()
marker='// === WIENER GIVEAWAY WALLET UNIQUE V63 ==='
if marker in s:
    print('V63 already installed')
    raise SystemExit(0)

# Add a single authoritative wallet ownership helper. One Telegram user owns one active
# giveaway wallet and one wallet key can never be owned by a different user.
anchor="function g60shortWallet(a){a=String(a||'');return a.length<18?a:`${a.slice(0,8)}…${a.slice(-8)}`}"
if anchor not in s:
    raise SystemExit('ERROR: V60 wallet helper anchor missing')
helper=r'''

async function g63claimWallet(uid,w){
  const c=await pool.connect();
  try{
    await c.query('begin');
    await c.query(`select pg_advisory_xact_lock(hashtext($1))`,[String(w.key)]);
    const owner=(await c.query(`select telegram_id from public.wiener_giveaway_wallet_owners where wallet_key=$1 limit 1`,[w.key])).rows[0];
    if(owner&&Number(owner.telegram_id)!==Number(uid)){
      await c.query('rollback');
      return {ok:false,error:'wallet_used'};
    }
    await c.query(`insert into public.wiener_giveaway_wallet_owners(telegram_id,wallet_key,wallet_address,network,first_linked_at,updated_at)
      values($1,$2,$3,'TON',now(),now())
      on conflict(telegram_id) do update set wallet_key=excluded.wallet_key,wallet_address=excluded.wallet_address,network='TON',updated_at=now()`,[uid,w.key,w.friendly]);
    await c.query('commit');
    return {ok:true};
  }catch(e){
    await c.query('rollback').catch(()=>null);
    if(String(e?.code||'')==='23505')return {ok:false,error:'wallet_used'};
    throw e;
  }finally{c.release()}
}
'''
s=s.replace(anchor,anchor+helper,1)

# Harden USE THIS ADDRESS: verify requirements, claim ownership, then finish entry.
old_use=r'''  if(act==='walletuse'){
    const raw=await g60walletCandidate(uid,g.id),w=raw?await g60parseWallet(raw):null;if(!w){await g60ans(q,'Saved address is no longer valid',true);return true}
    const z=await g60check(g,uid);if(!z.ok){await g60showCheck(q,g,uid);return true}await g60finishEntry(g,uid,z,w);await g60edit(q,`✅ <b>You're Participating!</b> 🎉\n\n🎁 ${g60esc(g.title)}\n👛 <code>${g60esc(g60shortWallet(w.friendly))}</code>\n✅ All requirements completed.`,g60kb([[g60cb('📊 VIEW STATUS',`g60:join:${g.id}`)],[g60cb('◀️ GIVEAWAY',`g60:view:${g.id}`)]]));await g60ans(q,'Entry confirmed');return true
  }'''
new_use=r'''  if(act==='walletuse'){
    await g60ans(q,'Checking wallet…');
    const raw=await g60walletCandidate(uid,g.id),w=raw?await g60parseWallet(raw):null;if(!w){await g60ans(q,'Saved address is no longer valid',true);return true}
    const z=await g60check(g,uid);if(!z.ok){await g60showCheck(q,g,uid);return true}
    const own=await g63claimWallet(uid,w);if(!own.ok){await g60edit(q,`❌ <b>Wallet already in use</b>\n\nThis GRAM address is already linked to another WIENER Farm user.\n\nFor giveaway safety, <b>one wallet address can only belong to one user.</b>`,g60kb([[g60cb('✏️ USE ANOTHER ADDRESS',`g60:walletchange:${g.id}`)],[g60cb('◀️ GIVEAWAY',`g60:view:${g.id}`)]]));return true}
    await g60finishEntry(g,uid,z,w);await g60edit(q,`✅ <b>You're Participating!</b> 🎉\n\n🎁 ${g60esc(g.title)}\n👛 <code>${g60esc(g60shortWallet(w.friendly))}</code>\n✅ All requirements completed.`,g60kb([[g60cb('📊 VIEW STATUS',`g60:join:${g.id}`)],[g60cb('◀️ GIVEAWAY',`g60:view:${g.id}`)]]));return true
  }'''
if old_use not in s:
    raise SystemExit('ERROR: V60 walletuse block changed')
s=s.replace(old_use,new_use,1)

# Fix SAVE & PARTICIPATE callback. Keep the session intact until successful save,
# re-check requirements, reject duplicate wallet ownership, then create the entry.
old_save=r'''  if(act==='walletsave'){
    const ss=await g60session(uid),w=ss?.pending_wallet?await g60parseWallet(ss.pending_wallet):null;if(!w){await g60ans(q,'Enter your wallet again',true);return true}
    const z=await g60check(g,uid);if(!z.ok){await g60showCheck(q,g,uid);return true}await g60finishEntry(g,uid,z,w);await g60edit(q,`✅ <b>You're Participating!</b> 🎉\n\n🎁 ${g60esc(g.title)}\n👛 <code>${g60esc(g60shortWallet(w.friendly))}</code>\n✅ All requirements completed.`,g60kb([[g60cb('📊 VIEW STATUS',`g60:join:${g.id}`)],[g60cb('◀️ GIVEAWAY',`g60:view:${g.id}`)]]));await g60ans(q,'Wallet saved');return true
  }'''
new_save=r'''  if(act==='walletsave'){
    await g60ans(q,'Saving…');
    const ss=await g60session(uid);
    if(!ss||Number(ss.giveaway_id)!==Number(g.id)||!ss.pending_wallet){await g60edit(q,`⚠️ <b>Wallet confirmation expired</b>\n\nPlease enter your GRAM address again.`,g60kb([[g60cb('✏️ ENTER ADDRESS',`g60:walletchange:${g.id}`)],[g60cb('◀️ GIVEAWAY',`g60:view:${g.id}`)]]));return true}
    const w=await g60parseWallet(ss.pending_wallet);if(!w){await g60edit(q,`❌ <b>Invalid GRAM address</b>\n\nPlease enter the address again.`,g60kb([[g60cb('✏️ ENTER ADDRESS',`g60:walletchange:${g.id}`)]]));return true}
    const z=await g60check(g,uid);if(!z.ok){await g60showCheck(q,g,uid);return true}
    const own=await g63claimWallet(uid,w);if(!own.ok){await g60edit(q,`❌ <b>Wallet already in use</b>\n\nThis GRAM address is already linked to another WIENER Farm user.\n\nFor giveaway safety, <b>one wallet address can only belong to one user.</b>`,g60kb([[g60cb('✏️ USE ANOTHER ADDRESS',`g60:walletchange:${g.id}`)],[g60cb('◀️ GIVEAWAY',`g60:view:${g.id}`)]]));return true}
    await g60finishEntry(g,uid,z,w);
    await g60edit(q,`✅ <b>You're Participating!</b> 🎉\n\n🎁 ${g60esc(g.title)}\n👛 <code>${g60esc(g60shortWallet(w.friendly))}</code>\n✅ All requirements completed.`,g60kb([[g60cb('📊 VIEW STATUS',`g60:join:${g.id}`)],[g60cb('◀️ GIVEAWAY',`g60:view:${g.id}`)]]));return true
  }'''
if old_save not in s:
    raise SystemExit('ERROR: V60 walletsave block changed')
s=s.replace(old_save,new_save,1)

route="\napp.use((_req,res)=>\n  res.status(404).json({ok:false,error:'route_not_enabled_yet'})\n);\n"
if route not in s:
    raise SystemExit('ERROR: final route marker missing')
s=s.replace(route,"\n// === WIENER GIVEAWAY WALLET UNIQUE V63 ===\n"+route,1)

p.write_text(s)
print('V63 giveaway wallet save/unique patch installed')
PY

python3 /tmp/patch-v63-giveaway-wallet.py
node --check "$BACKEND"

echo '=== RESTART ==='
pm2 restart wiener-api --update-env
sleep 3
pm2 status wiener-api
curl -fsS http://127.0.0.1:3000/health || curl -fsS http://127.0.0.1:3000/
echo
pm2 save >/dev/null

echo '=== VERIFY ==='
grep -q 'WIENER GIVEAWAY WALLET UNIQUE V63' "$BACKEND"
grep -q 'g63claimWallet' "$BACKEND"
runuser -u postgres -- psql -d "$DB" -Atqc "select count(*)||' wallet_owner_table' from information_schema.tables where table_schema='public' and table_name='wiener_giveaway_wallet_owners';"
runuser -u postgres -- psql -d "$DB" -Atqc "select count(*)||' duplicate_wallet_keys' from (select wallet_key from public.wiener_giveaway_wallet_owners group by wallet_key having count(*)>1) x;"
echo 'wallet_save_callback=fixed'
echo 'one_wallet_one_user=enforced'
echo '=== V63 READY ==='
trap - ERR
