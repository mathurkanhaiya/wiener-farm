#!/usr/bin/env bash
set -Eeuo pipefail

CODE=/opt/wiener-code
BACKEND=/opt/wiener-backend
SERVER="$BACKEND/server.mjs"
[ -f "$SERVER" ] || SERVER="$BACKEND/server.js"
export WIENER_BACKEND_FILE="$SERVER"
STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP="$SERVER.v31-$STAMP.bak"

rollback(){
  rc=$?
  echo 'V31 failed; restoring backend.' >&2
  cp -f "$BACKUP" "$SERVER" 2>/dev/null || true
  pm2 restart wiener-api --update-env >/dev/null 2>&1 || true
  exit "$rc"
}
trap rollback ERR

cd "$CODE"
cp "$SERVER" "$BACKUP"
git fetch origin main
git show origin/main:scripts/patch-vps-v31-ambassador-promo-tracking.py > /tmp/wiener-v31.py

echo '=== CHECK AMBASSADOR CLAIM TABLE ==='
runuser -u postgres -- psql -d wiener_farm_final -v ON_ERROR_STOP=1 <<'SQL'
create table if not exists public.ambassador_claim_attributions(
  id bigserial primary key,
  ambassador_id text not null,
  promo_id text,
  broadcast_id text,
  code text not null,
  telegram_id bigint not null,
  claimed_at timestamptz not null default now(),
  unique(code,telegram_id)
);
create index if not exists idx_amb_claim_attr_ambassador
  on public.ambassador_claim_attributions(ambassador_id,claimed_at desc);
create index if not exists idx_amb_claim_attr_code
  on public.ambassador_claim_attributions(code);
SQL

echo '=== PATCH PROMO -> AMBASSADOR TRACKING ==='
python3 -m py_compile /tmp/wiener-v31.py
python3 /tmp/wiener-v31.py
node --check "$SERVER"
grep -q 'WIENER AMBASSADOR PROMO TRACKING V31' "$SERVER"
grep -q 'isAmbassadorPromoV31' "$SERVER"
grep -q 'promo_ad_sessions where id=' "$SERVER"

echo '=== RESTART API ==='
pm2 restart wiener-api --update-env
sleep 3
if ! ss -ltn | grep -q '127.0.0.1:3000'; then
  echo 'Backend is not listening on 127.0.0.1:3000' >&2
  exit 1
fi

echo '=== BACKFILL ALREADY-CREDITED AMBA CLAIM ATTRIBUTIONS ==='
runuser -u postgres -- psql -d wiener_farm_final -v ON_ERROR_STOP=1 <<'SQL'
insert into public.ambassador_claim_attributions(
  ambassador_id,promo_id,broadcast_id,code,telegram_id,claimed_at
)
select
  ap.ambassador_id::text,
  ap.id::text,
  bi.broadcast_id::text,
  upper(pc.code),
  pc.telegram_id,
  now()
from public.promo_claims pc
join public.ambassador_promos ap on upper(ap.code)=upper(pc.code)
left join lateral (
  select x.broadcast_id
  from public.ambassador_broadcast_items x
  where x.ambassador_id=ap.ambassador_id
    and (upper(x.code_1)=upper(pc.code) or upper(x.code_2)=upper(pc.code))
  order by x.posted_at desc nulls last
  limit 1
) bi on true
where upper(pc.code) ~ '^AMBA[A-F0-9]{6}$'
on conflict(code,telegram_id) do nothing;

select
  (select count(*) from public.promo_claims pc join public.ambassador_promos ap on upper(ap.code)=upper(pc.code) where upper(pc.code) ~ '^AMBA[A-F0-9]{6}$') as credited_amba_promo_claims,
  (select count(*) from public.ambassador_claim_attributions where upper(code) ~ '^AMBA[A-F0-9]{6}$') as ambassador_attributions,
  (select count(*) from public.promo_claims pc join public.ambassador_promos ap on upper(ap.code)=upper(pc.code)
     where upper(pc.code) ~ '^AMBA[A-F0-9]{6}$'
       and not exists(select 1 from public.ambassador_claim_attributions aa where upper(aa.code)=upper(pc.code) and aa.telegram_id=pc.telegram_id)
  ) as still_missing;
SQL

echo '=== PROMO ROUTE SMOKE ==='
code=$(curl -sS -o /tmp/v31-promo.json -w '%{http_code}' -X POST -H 'content-type: application/json' --data '{}' http://127.0.0.1:3000/functions/v1/wiener-promo || true)
if [[ "$code" == "000" || "$code" == "404" || "$code" == "502" ]]; then
  cat /tmp/v31-promo.json 2>/dev/null || true
  echo "Promo route failed: HTTP $code" >&2
  exit 1
fi

echo '=== V31 READY ==='
echo 'Normal promo claims no longer enter the Ambassador V26 tracker.'
echo 'AMBA promo claims now recover the code from promo_ad_sessions when the finalize RPC omits it.'
echo 'Existing AMBA promo claims were backfilled into ambassador_claim_attributions.'
echo 'Promo reward crediting itself was not changed.'
trap - ERR
