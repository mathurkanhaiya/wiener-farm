#!/usr/bin/env bash
set -Eeuo pipefail
ENV=/opt/wiener-backend/.env
DB=$(sed -n 's/^DATABASE_URL=//p' "$ENV" | head -n1)
API='http://127.0.0.1:54322/functions/v1'
[ -n "$DB" ] || exit 1
sql(){ psql "$DB" -Atq -c "$1"; }
post(){ curl -fsS --max-time 55 -X POST "$1" -H 'content-type: application/json' "${@:2}" >/dev/null; }
job=${1:-}
case "$job" in
 notification)
   secret=$(sql "select coalesce(notification_cron_secret,'') from public.app_settings where id=true")
   [ -n "$secret" ] && post "$API/wiener-notification-worker" -H "x-wiener-cron-secret: $secret" -d '{}'
   ;;
 giveaway)
   secret=$(sql "select coalesce(notification_cron_secret,'') from public.app_settings where id=true")
   [ -n "$secret" ] && post "$API/wiener-auto-giveaway-worker" -H "x-wiener-cron-secret: $secret" -d '{}'
   ;;
 treasury-report)
   secret=$(sql "select coalesce(notification_cron_secret,'') from public.app_settings where id=true")
   [ -n "$secret" ] && post "$API/wiener-treasury-daily-report" -H "x-wiener-cron-secret: $secret" -d '{}'
   ;;
 treasury-scan)
   secret=$(sql "select coalesce(telegram_webhook_secret,'') from public.app_settings where id=true")
   admin=$(sql "select telegram_id from public.admins where enabled=true and role='owner' order by telegram_id limit 1")
   [ -n "$secret" ] && [ -n "$admin" ] && post "$API/wiener-treasury-wallet" -H "x-wiener-internal-secret: $secret" -d "{\"action\":\"scan_deposits\",\"admin_id\":$admin}"
   ;;
 ambassador-settle)
   sql "select public.settle_ambassador_weekly_rounds();" >/dev/null
   ;;
 ambassador-notify)
   secret=$(sql "select coalesce(telegram_webhook_secret,'') from public.app_settings where id=true")
   [ -n "$secret" ] && post "$API/wiener-ambassador-weekly-notify" -H "x-wiener-internal-secret: $secret" -d '{}'
   ;;
 ambassador-expire)
   sql "select public.expire_ambassador_promos();" >/dev/null
   ;;
 *) echo "unknown worker: $job" >&2; exit 2;;
esac
