#!/usr/bin/env bash
set -euo pipefail

cd /opt/wiener-code
DB=wiener_farm_final
BACKEND=/opt/wiener-backend/server.mjs
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${BACKEND}.bak-v58-${STAMP}"

echo '=== V58 WITHDRAW PROOF ALERT SAFE INSTALL ==='
[[ -f "$BACKEND" ]] || { echo 'ERROR: backend server.mjs not found' >&2; exit 1; }
node --check "$BACKEND"
cp -a "$BACKEND" "$BACKUP"
rollback(){
  echo 'ERROR: V58 install failed; restoring backend backup.' >&2
  cp -a "$BACKUP" "$BACKEND"
  node --check "$BACKEND" >/dev/null 2>&1 && pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
}
trap rollback ERR

echo '=== DATABASE ==='
runuser -u postgres -- psql -d "$DB" -v ON_ERROR_STOP=1 <<'SQL'
create table if not exists public.wiener_withdraw_proof_outbox(
  id bigserial primary key,
  event_key text not null unique,
  telegram_id bigint not null,
  message text not null,
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);
create index if not exists wiener_withdraw_proof_outbox_pending_idx
  on public.wiener_withdraw_proof_outbox(sent_at,available_at,id);

create or replace function public.wiener_paid_proof_alert_v58()
returns trigger language plpgsql as $$
declare src text;
begin
  if new.status='paid' and old.status is distinct from new.status then
    src := case when tg_table_name='wiener_spin_withdrawals' then 'spin' else 'withdrawal' end;
    insert into public.wiener_withdraw_proof_outbox(event_key,telegram_id,message)
    values(
      'paid-proof:'||src||':'||new.id,
      new.telegram_id,
      '✅ Withdrawal Received!'||E'\n\n'||
      'Your WIENER Farm withdrawal has been paid successfully.'||E'\n\n'||
      '📸 Please share your payment proof in our community:'||E'\n'||
      '@wienerfarmchat'||E'\n\n'||
      'Sharing proof helps keep WIENER Farm transparent and lets the community see successful payouts. 🌭'
    ) on conflict(event_key) do nothing;
  end if;
  return new;
exception when others then
  raise warning 'V58 paid-proof alert skipped: %',sqlerrm;
  return new;
end $$;

drop trigger if exists trg_wiener_withdraw_paid_proof_v58 on public.withdrawals;
create trigger trg_wiener_withdraw_paid_proof_v58
after update of status on public.withdrawals
for each row execute function public.wiener_paid_proof_alert_v58();

drop trigger if exists trg_wiener_spin_withdraw_paid_proof_v58 on public.wiener_spin_withdrawals;
create trigger trg_wiener_spin_withdraw_paid_proof_v58
after update of status on public.wiener_spin_withdrawals
for each row execute function public.wiener_paid_proof_alert_v58();

revoke all on table public.wiener_withdraw_proof_outbox from public;
SQL

echo '=== BACKEND PATCH ==='
cat >/tmp/patch-v58-proof-alert.py <<'PY'
from pathlib import Path
p=Path('/opt/wiener-backend/server.mjs')
s=p.read_text()
marker='// === WIENER WITHDRAW PROOF ALERT V58 ==='
if marker in s:
    print('V58 already installed')
    raise SystemExit(0)
route="\napp.use((_req,res)=>\n  res.status(404).json({ok:false,error:'route_not_enabled_yet'})\n);\n"
if route not in s:
    raise SystemExit('ERROR: final route marker not found')
code=r'''

// === WIENER WITHDRAW PROOF ALERT V58 ===
const WITHDRAW_PROOF_CHAT_V58='https://t.me/wienerfarmchat';
let withdrawProofBusyV58=false;
async function drainWithdrawProofV58(){
  if(withdrawProofBusyV58)return;
  withdrawProofBusyV58=true;
  try{
    const rows=(await pool.query(`select * from public.wiener_withdraw_proof_outbox where sent_at is null and attempts<6 and available_at<=now() order by id asc limit 30`)).rows;
    for(const n of rows){
      try{
        await tgV10('sendMessage',{
          chat_id:Number(n.telegram_id),
          text:String(n.message||''),
          disable_web_page_preview:true,
          reply_markup:{inline_keyboard:[[{text:'📸 SHARE PAYMENT PROOF',url:WITHDRAW_PROOF_CHAT_V58}]]}
        });
        await pool.query(`update public.wiener_withdraw_proof_outbox set sent_at=now(),attempts=attempts+1,last_error=null where id=$1`,[n.id]);
      }catch(e){
        await pool.query(`update public.wiener_withdraw_proof_outbox set attempts=attempts+1,last_error=$2,available_at=now()+interval '5 minutes' where id=$1`,[n.id,String(e?.message||e).slice(0,300)]).catch(()=>null);
      }
    }
  }catch(e){console.error('v58_proof_alert_worker',String(e?.message||e))}
  finally{withdrawProofBusyV58=false}
}
setTimeout(()=>void drainWithdrawProofV58(),5000);
setInterval(()=>void drainWithdrawProofV58(),30000);
// === END WIENER WITHDRAW PROOF ALERT V58 ===
'''
s=s.replace(route,code+route,1)
p.write_text(s)
print('V58 backend proof reminder worker installed')
PY

python3 /tmp/patch-v58-proof-alert.py
node --check "$BACKEND"
grep -q 'WIENER WITHDRAW PROOF ALERT V58' "$BACKEND"

echo '=== RESTART ==='
pm2 restart wiener-api --update-env
sleep 2
curl -fsS http://127.0.0.1:3000/health
echo
pm2 save

echo '=== VERIFY V58 ==='
runuser -u postgres -- psql -d "$DB" -Atqc "select count(*)||' proof_alert_triggers' from pg_trigger where not tgisinternal and tgname in ('trg_wiener_withdraw_paid_proof_v58','trg_wiener_spin_withdraw_paid_proof_v58')"
node --check "$BACKEND"

echo '=== V58 READY ==='
echo 'Every newly PAID normal or Spin withdrawal queues a Telegram proof reminder.'
echo 'The message includes a SHARE PAYMENT PROOF button to @wienerfarmchat.'
echo 'Notification failures retry and cannot break the payout transaction.'
trap - ERR
