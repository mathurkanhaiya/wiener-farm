#!/usr/bin/env bash
set -euo pipefail

cd /opt/wiener-code
DB=wiener_farm_final
BACKEND=/opt/wiener-backend/server.mjs
STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP="/opt/wiener-backend/server.mjs.v56-${STAMP}.bak"

[[ -f "$BACKEND" ]] || { echo 'ERROR: backend server.mjs not found' >&2; exit 1; }

echo '=== V56 SPIN NOTIFICATIONS - PRECHECK ==='
bash scripts/install-vps-v55-spin-activity-kind-hotfix.sh
node --check "$BACKEND"
cp "$BACKEND" "$BACKUP"
rollback(){
  echo 'ERROR: V56 install failed; restoring backend backup.' >&2
  cp "$BACKUP" "$BACKEND"
  node --check "$BACKEND" >/dev/null 2>&1 && pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
}
trap rollback ERR

cat >/tmp/patch-v56-spin-notify.py <<'PY'
from pathlib import Path
p=Path('/opt/wiener-backend/server.mjs')
s=p.read_text()
if 'WIENER SPIN NOTIFICATIONS V56' in s:
    print('V56 already installed')
    raise SystemExit(0)
marker="\napp.use((_req,res)=>\n  res.status(404).json({ok:false,error:'route_not_enabled_yet'})\n);\n"
if marker not in s:
    raise SystemExit('ERROR: final route marker not found')
code=r'''

// === WIENER SPIN NOTIFICATIONS V56 ===
let spinNotifyBusyV56=false;
async function spinTgV56(chatId,text,markup=null){
  const payload={chat_id:chatId,text,disable_web_page_preview:true};
  if(markup) payload.reply_markup=markup;
  const r=await fetch(`https://api.telegram.org/bot${BOT}/sendMessage`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
  const x=await r.json().catch(()=>({ok:false,description:'telegram_error'}));
  if(!x.ok) throw new Error(x.description||'telegram_error');
  return x.result;
}
async function spinAdminIdsV56(){
  try{
    const q=await pool.query(`select to_jsonb(a) j from public.admin_users a`);
    const ids=[];
    for(const r of q.rows){const j=r.j||{},id=Number(j.telegram_id||j.user_id||j.admin_id||0);if(id&&['owner','admin'].includes(String(j.role||'admin')))ids.push(id)}
    if(ids.length)return [...new Set(ids)];
  }catch{}
  try{
    const j=(await pool.query(`select to_jsonb(s) j from public.app_settings s where id=true limit 1`)).rows[0]?.j||{};
    const ids=[j.admin_id,j.owner_id,j.telegram_admin_id,j.primary_admin_id].map(Number).filter(Boolean);
    return [...new Set(ids)];
  }catch{return []}
}
function spinOpenMarkupV56(appUrl){return {inline_keyboard:[[{text:'🎡 OPEN SPIN & EARN',web_app:{url:`${String(appUrl||'https://wiener-farm.vercel.app').replace(/\/$/,'')}?page=ads`}}]]}}
async function runSpinNotificationsV56(){
  if(spinNotifyBusyV56)return; spinNotifyBusyV56=true;
  try{
    const rows=(await pool.query(`select * from public.wiener_spin_notification_outbox where sent_at is null and attempts<5 and available_at<=now() order by id asc limit 30`)).rows;
    if(!rows.length)return;
    const st=(await pool.query(`select app_url from public.app_settings where id=true limit 1`)).rows[0]||{};
    const admins=await spinAdminIdsV56();
    for(const n of rows){
      try{
        let targets=[];
        if(n.target_type==='user'&&Number(n.telegram_id))targets=[Number(n.telegram_id)];
        else if(n.target_type==='admin')targets=admins;
        if(!targets.length){await pool.query(`update public.wiener_spin_notification_outbox set sent_at=now(),last_error='no_target' where id=$1`,[n.id]);continue}
        for(const id of targets)await spinTgV56(id,String(n.message||''),n.target_type==='user'?spinOpenMarkupV56(st.app_url):null);
        await pool.query(`update public.wiener_spin_notification_outbox set sent_at=now(),attempts=attempts+1,last_error=null where id=$1`,[n.id]);
      }catch(e){await pool.query(`update public.wiener_spin_notification_outbox set attempts=attempts+1,last_error=$2,available_at=now()+interval '5 minutes' where id=$1`,[n.id,String(e?.message||e).slice(0,300)]).catch(()=>null)}
    }
  }catch(e){console.error('spin_notify_v56',String(e?.message||e))}finally{spinNotifyBusyV56=false}
}
setTimeout(()=>void runSpinNotificationsV56(),5000);
setInterval(()=>void runSpinNotificationsV56(),30000);

app.post('/functions/v1/wiener-spin-notification-worker',async(req,res)=>{
  try{const incoming=String(req.headers['x-wiener-internal-secret']||''),want=String((await pool.query(`select telegram_webhook_secret from public.app_settings where id=true limit 1`)).rows[0]?.telegram_webhook_secret||'');if(!incoming||incoming!==want)return res.status(403).send('forbidden');await runSpinNotificationsV56();return res.json({ok:true})}catch(e){return res.status(500).json({ok:false,error:'spin_notification_worker_failed'})}
});
// === END WIENER SPIN NOTIFICATIONS V56 ===
'''
s=s.replace(marker,code+marker,1)
p.write_text(s)
print('Installed V56 backend notification worker')
PY

python3 /tmp/patch-v56-spin-notify.py

echo '=== V56 DATABASE OUTBOX ==='
runuser -u postgres -- psql -d "$DB" -v ON_ERROR_STOP=1 <<'SQL'
create table if not exists public.wiener_spin_notification_outbox(
  id bigserial primary key,
  event_key text not null unique,
  target_type text not null check(target_type in ('user','admin')),
  telegram_id bigint,
  event_type text not null,
  message text not null,
  attempts integer not null default 0,
  last_error text,
  available_at timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists wiener_spin_notification_pending_idx on public.wiener_spin_notification_outbox(sent_at,available_at,id);
revoke all on table public.wiener_spin_notification_outbox from public;
revoke all on sequence public.wiener_spin_notification_outbox_id_seq from public;

create or replace function public.queue_wiener_spin_notifications_v56()
returns trigger language plpgsql as $$
declare
  uname text;
  bal numeric;
  msg text;
begin
  begin
    if tg_table_name='wiener_spin_events' then
      if new.reward_type='ton' then
        select coalesce(spin_ton_balance,0) into bal from public.wiener_spin_state where telegram_id=new.telegram_id;
        if new.reward_amount>=0.005 then
          msg := '🔥 JACKPOT! You won 0.005 TON 🎉'||E'\n\n'||'Spin TON Balance: '||trim(to_char(coalesce(bal,0),'FM999999990.#########'))||' TON';
        else
          msg := '💎 You won '||trim(to_char(new.reward_amount,'FM999999990.#########'))||' TON!'||E'\n'||'Spin TON Balance: '||trim(to_char(coalesce(bal,0),'FM999999990.#########'))||' TON';
        end if;
        insert into public.wiener_spin_notification_outbox(event_key,target_type,telegram_id,event_type,message)
        values('spin:'||new.id||':ton_win','user',new.telegram_id,'ton_win',msg) on conflict do nothing;
        if new.reward_amount>=0.005 then
          select username into uname from public.users where telegram_id=new.telegram_id;
          insert into public.wiener_spin_notification_outbox(event_key,target_type,event_type,message)
          values('spin:'||new.id||':jackpot_admin','admin','jackpot',
            '🔥 SPIN JACKPOT WIN'||E'\n\n'||'👤 '||coalesce('@'||uname,'UID '||new.telegram_id)||E'\n'||'🆔 '||new.telegram_id||E'\n'||'💎 0.005 TON'||E'\n'||'Spin ID: '||new.id)
          on conflict do nothing;
        end if;
      elsif new.reward_type='spin' then
        insert into public.wiener_spin_notification_outbox(event_key,target_type,telegram_id,event_type,message)
        values('spin:'||new.id||':bonus_spin','user',new.telegram_id,'bonus_spin',
          '🎁 You won +'||trim(to_char(new.reward_amount,'FM999999990'))||case when new.reward_amount=1 then ' bonus spin!' else ' bonus spins!' end)
        on conflict do nothing;
      end if;

    elsif tg_table_name='wiener_spin_withdrawals' then
      select username into uname from public.users where telegram_id=new.telegram_id;
      if tg_op='INSERT' then
        insert into public.wiener_spin_notification_outbox(event_key,target_type,telegram_id,event_type,message)
        values('spinwd:'||new.id||':requested_user','user',new.telegram_id,'withdraw_requested',
          '⏳ Spin TON withdrawal requested'||E'\n\n'||'Amount: '||trim(to_char(new.amount_ton,'FM999999990.#########'))||' TON'||E'\n'||'Status: Pending') on conflict do nothing;
        insert into public.wiener_spin_notification_outbox(event_key,target_type,event_type,message)
        values('spinwd:'||new.id||':requested_admin','admin','withdraw_requested',
          '🎡 New Spin TON Withdrawal'||E'\n\n'||'👤 '||coalesce('@'||uname,'UID '||new.telegram_id)||E'\n'||'🆔 '||new.telegram_id||E'\n'||'💎 '||trim(to_char(new.amount_ton,'FM999999990.#########'))||' TON'||E'\n'||'👛 '||new.wallet_address||E'\n\n'||'Open /pay') on conflict do nothing;
      elsif new.status is distinct from old.status and new.status='paid' then
        insert into public.wiener_spin_notification_outbox(event_key,target_type,telegram_id,event_type,message)
        values('spinwd:'||new.id||':paid_user','user',new.telegram_id,'withdraw_paid',
          '✅ Spin TON Withdrawal Paid'||E'\n\n'||'Amount: '||trim(to_char(new.amount_ton,'FM999999990.#########'))||' TON'||case when coalesce(new.explorer_url,'')<>'' then E'\n'||'TX: '||new.explorer_url else '' end) on conflict do nothing;
      elsif new.status is distinct from old.status and new.status='rejected' then
        insert into public.wiener_spin_notification_outbox(event_key,target_type,telegram_id,event_type,message)
        values('spinwd:'||new.id||':rejected_user','user',new.telegram_id,'withdraw_rejected',
          '❌ Spin TON Withdrawal Rejected'||E'\n\n'||'Amount: '||trim(to_char(new.amount_ton,'FM999999990.#########'))||' TON'||E'\n'||'Reason: '||coalesce(nullif(new.rejection_reason,''),'Admin review')||E'\n'||'Reserved TON has been returned to your Spin balance.') on conflict do nothing;
      end if;
    end if;
  exception when others then
    raise warning 'spin notification queue skipped: %', sqlerrm;
  end;
  return new;
end $$;

drop trigger if exists trg_wiener_spin_notify_event_v56 on public.wiener_spin_events;
create trigger trg_wiener_spin_notify_event_v56 after insert on public.wiener_spin_events for each row execute function public.queue_wiener_spin_notifications_v56();

drop trigger if exists trg_wiener_spin_notify_withdraw_insert_v56 on public.wiener_spin_withdrawals;
create trigger trg_wiener_spin_notify_withdraw_insert_v56 after insert on public.wiener_spin_withdrawals for each row execute function public.queue_wiener_spin_notifications_v56();

drop trigger if exists trg_wiener_spin_notify_withdraw_update_v56 on public.wiener_spin_withdrawals;
create trigger trg_wiener_spin_notify_withdraw_update_v56 after update of status on public.wiener_spin_withdrawals for each row execute function public.queue_wiener_spin_notifications_v56();
SQL

node --check "$BACKEND"
pm2 restart wiener-api --update-env
sleep 2
curl -fsS http://127.0.0.1:3000/health
echo
runuser -u postgres -- psql -d "$DB" -Atqc "select count(*)||' spin_notification_triggers' from pg_trigger where not tgisinternal and tgname in ('trg_wiener_spin_notify_event_v56','trg_wiener_spin_notify_withdraw_insert_v56','trg_wiener_spin_notify_withdraw_update_v56')"
pm2 save

echo '=== V56 READY ==='
echo 'Telegram notifications: TON wins, jackpot, bonus spins, withdrawal requested/paid/rejected.'
echo 'Admin alerts: jackpot and new Spin TON withdrawal.'
echo 'Normal WIENER wins remain in-app only to avoid spam.'
echo 'Notification failures are queued/retried and cannot fail the user Spin/withdraw transaction.'
echo 'No frontend layout, reward probability, balance logic, or payout amount changed.'
trap - ERR
