#!/usr/bin/env bash
set -euo pipefail

# Wiener Farm V107 Anti-Script — OBSERVE ONLY
# This installer deliberately does NOT alter server.mjs, routes, rewards,
# bans, withdrawals, AdsGram, farming, referrals, spin, or user balances.
# It installs an isolated nginx access log + analyzer for suspicious request patterns.

NGINX_SITE="/etc/nginx/sites-enabled/wiener-app-vps"
LOG_DIR="/var/log/wiener-anti-script"
STATE_DIR="/var/lib/wiener-anti-script"
BIN="/usr/local/bin/wiener-anti-script-scan"
SERVICE="/etc/systemd/system/wiener-anti-script.service"
TIMER="/etc/systemd/system/wiener-anti-script.timer"
STAMP="$(date +%Y%m%d-%H%M%S)"

[[ -f "$NGINX_SITE" ]] || { echo "Missing $NGINX_SITE; nothing changed"; exit 1; }
mkdir -p "$LOG_DIR" "$STATE_DIR"
cp -a "$NGINX_SITE" "$NGINX_SITE.before-v107-$STAMP"

# Add a dedicated observation log to the existing server block. No request handling changes.
python3 - "$NGINX_SITE" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1]); s=p.read_text()
marker='wiener_anti_script_observe'
if marker in s:
    print('nginx observation log already installed')
    raise SystemExit(0)
needle='{'
pos=s.find(needle)
if pos < 0:
    raise SystemExit('nginx server block anchor missing; nothing changed')
line='\n    # wiener_anti_script_observe — logging only, never blocks\n    access_log /var/log/wiener-anti-script/access.log combined;\n'
s=s[:pos+1]+line+s[pos+1:]
p.write_text(s)
PY

nginx -t || { cp -a "$NGINX_SITE.before-v107-$STAMP" "$NGINX_SITE"; nginx -t; echo "nginx validation failed; restored backup"; exit 1; }
systemctl reload nginx

cat >"$BIN" <<'PY'
#!/usr/bin/env python3
from pathlib import Path
from collections import Counter, defaultdict
from datetime import datetime, timezone
import json, re

log=Path('/var/log/wiener-anti-script/access.log')
out=Path('/var/log/wiener-anti-script/events.jsonl')
state=Path('/var/lib/wiener-anti-script/offset')
if not log.exists(): raise SystemExit(0)
try: off=int(state.read_text())
except Exception: off=0
size=log.stat().st_size
if off>size: off=0
pat=re.compile(r'^(\S+) \S+ \S+ \[[^]]+\] "(\S+) ([^ ]+) [^"]+" (\d{3}) \S+ "[^"]*" "([^"]*)"')
rows=[]
with log.open('r', errors='replace') as f:
    f.seek(off)
    for line in f:
        m=pat.match(line)
        if m: rows.append(m.groups())
    newoff=f.tell()
state.write_text(str(newoff))
if not rows: raise SystemExit(0)
byip=defaultdict(list)
for ip,method,path,status,ua in rows: byip[ip].append((method,path,int(status),ua))
now=datetime.now(timezone.utc).isoformat()
with out.open('a') as f:
  for ip, rs in byip.items():
    score=0; reasons=[]
    n=len(rs); mut=sum(1 for m,_,_,_ in rs if m in ('POST','PUT','PATCH','DELETE'))
    earn=sum(1 for _,p,_,_ in rs if any(x in p.lower() for x in ('ad','reward','claim','spin','withdraw','promo','task','farm','referral')))
    ua_empty=sum(1 for *_,ua in rs if not ua or ua=='-')
    denied=sum(1 for _,_,st,_ in rs if st in (401,403,429))
    if n>=120: score+=20; reasons.append(f'high_request_volume:{n}')
    if mut>=50: score+=20; reasons.append(f'high_mutation_volume:{mut}')
    if earn>=60: score+=20; reasons.append(f'high_earning_endpoint_volume:{earn}')
    if ua_empty>=10: score+=10; reasons.append(f'missing_user_agent:{ua_empty}')
    if denied>=20: score+=15; reasons.append(f'repeated_denied_requests:{denied}')
    if score:
      f.write(json.dumps({'ts':now,'mode':'observe_only','ip':ip,'score':score,'reasons':reasons,'requests':n})+'\n')
PY
chmod 0755 "$BIN"

cat >"$SERVICE" <<EOF
[Unit]
Description=Wiener Farm Anti-Script Observe-Only Scanner
[Service]
Type=oneshot
ExecStart=$BIN
EOF
cat >"$TIMER" <<'EOF'
[Unit]
Description=Run Wiener Anti-Script observation scan
[Timer]
OnBootSec=2min
OnUnitActiveSec=1min
AccuracySec=15s
[Install]
WantedBy=timers.target
EOF
systemctl daemon-reload
systemctl enable --now wiener-anti-script.timer

echo "V107 installed: OBSERVE ONLY"
echo "No bans, blocks, reward changes, balance changes, or backend route changes."
echo "Events: $LOG_DIR/events.jsonl"
echo "Backup: $NGINX_SITE.before-v107-$STAMP"
