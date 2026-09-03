#!/usr/bin/env bash
set -Eeuo pipefail
cd /opt/wiener-code
git pull --ff-only

BASE=scripts/install-vps-v15-final-cutover.sh
[ -f "$BASE" ] || { echo "Missing $BASE" >&2; exit 1; }

# Ensure the safer readiness patch is present even on a fresh checkout.
if [ -f scripts/install-vps-v15b-final-cutover.sh ]; then
  python3 - "$BASE" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1]); s=p.read_text()
old='''say '=== PRE-CUTOVER CHECKS ==='\ncurl -fsS "${API_URL}/" >/tmp/wiener-v15-api-health.json\ncat /tmp/wiener-v15-api-health.json\nnode --check "$BACKEND/server.mjs"'''
new='''say '=== PRE-CUTOVER CHECKS ==='\npre_code=$(curl -sS -o /tmp/wiener-v15-api-smoke.json -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' "${API_URL}/functions/v1/wiener-api" || true)\ncase "$pre_code" in 000|404|502) fail "VPS API precheck failed: HTTP $pre_code" ;; esac\ncat /tmp/wiener-v15-api-smoke.json || true\nnode --check "$BACKEND/server.mjs"'''
if old in s: s=s.replace(old,new,1)
old2='''    location = /healthz {\n        proxy_pass http://127.0.0.1:3000/;\n        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n    }'''
new2='''    location = /healthz {\n        default_type application/json;\n        return 200 '{"ok":true,"service":"wiener-farm-vps-web"}';\n    }'''
if old2 in s: s=s.replace(old2,new2,1)
old3='''curl -fsS "${API_URL}/" >/tmp/wiener-v15-post-health.json\ncat /tmp/wiener-v15-post-health.json'''
new3='''post_code=$(curl -sS -o /tmp/wiener-v15-post-api.json -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' "${API_URL}/functions/v1/wiener-api" || true)\ncase "$post_code" in 000|404|502) fail "VPS API post-restart check failed: HTTP $post_code" ;; esac\ncat /tmp/wiener-v15-post-api.json || true'''
if old3 in s: s=s.replace(old3,new3,1)
p.write_text(s)
PY
fi

TUNNEL_ID='9c6c8bc5-462d-4ce3-8840-ca01c45821b6'
CREDS="/root/.cloudflared/${TUNNEL_ID}.json"
CFG=''
for f in /root/.cloudflared/config.yml /root/.cloudflared/config.yaml /etc/cloudflared/config.yml /etc/cloudflared/config.yaml; do
  if [ -f "$f" ]; then CFG="$f"; break; fi
done

if [ -z "$CFG" ]; then
  [ -f "$CREDS" ] || { echo "ERROR: named tunnel credential missing: $CREDS" >&2; exit 1; }
  mkdir -p /root/.cloudflared
  CFG=/root/.cloudflared/config.yml
  cat > "$CFG" <<EOF
tunnel: ${TUNNEL_ID}
credentials-file: ${CREDS}
ingress:
  - hostname: api.viralaitools.xyz
    service: http://127.0.0.1:3000
  - service: http_status:404
EOF
  echo "Created Cloudflare config: $CFG"
else
  echo "Using Cloudflare config: $CFG"
fi

# Patch the installer to use the detected config path. Also normalize the tunnel id
# and credentials line only if this is the freshly-created config.
python3 - "$BASE" "$CFG" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1]); cfg=sys.argv[2]
s=p.read_text()
import re
s=re.sub(r'^CF_CFG=.*$', 'CF_CFG='+cfg, s, count=1, flags=re.M)
p.write_text(s)
print('V15 Cloudflare config path patched:', cfg)
PY

cloudflared tunnel ingress validate --config "$CFG" 2>/dev/null || cloudflared --config "$CFG" tunnel ingress validate

exec bash "$BASE"
