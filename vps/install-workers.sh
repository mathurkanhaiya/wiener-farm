#!/usr/bin/env bash
set -Eeuo pipefail
SRC=/opt/wiener-code/vps/run-worker.sh
DST=/opt/wiener-selfhost/run-worker.sh
if [ ! -f "$SRC" ]; then SRC="$(cd "$(dirname "$0")" && pwd)/run-worker.sh"; fi
install -m 700 "$SRC" "$DST"
cat > /etc/cron.d/wiener-workers <<'CRON'
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
CRON_TZ=UTC
*/5 * * * * root /opt/wiener-selfhost/run-worker.sh notification >>/var/log/wiener-workers.log 2>&1
* * * * * root /opt/wiener-selfhost/run-worker.sh giveaway >>/var/log/wiener-workers.log 2>&1
10 0 * * * root /opt/wiener-selfhost/run-worker.sh treasury-report >>/var/log/wiener-workers.log 2>&1
* * * * * root /opt/wiener-selfhost/run-worker.sh treasury-scan >>/var/log/wiener-workers.log 2>&1
30 18 * * 0 root /opt/wiener-selfhost/run-worker.sh ambassador-settle >>/var/log/wiener-workers.log 2>&1
35 18 * * 0 root /opt/wiener-selfhost/run-worker.sh ambassador-notify >>/var/log/wiener-workers.log 2>&1
*/5 * * * * root /opt/wiener-selfhost/run-worker.sh ambassador-expire >>/var/log/wiener-workers.log 2>&1
CRON
chmod 644 /etc/cron.d/wiener-workers
systemctl restart cron
systemctl is-active cron
echo WORKERS_INSTALLED
