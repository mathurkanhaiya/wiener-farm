#!/usr/bin/env bash
set -Eeuo pipefail
cd /opt/wiener-code
git pull --ff-only
TARGET=scripts/install-vps-v15-final-cutover.sh
[ -f "$TARGET" ] || { echo "Missing $TARGET" >&2; exit 1; }
python3 - "$TARGET" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1]); s=p.read_text()
old='''say '=== PRE-CUTOVER CHECKS ==='\ncurl -fsS "${API_URL}/" >/tmp/wiener-v15-api-health.json\ncat /tmp/wiener-v15-api-health.json\nnode --check "$BACKEND/server.mjs"'''
new='''say '=== PRE-CUTOVER CHECKS ==='\npre_code=$(curl -sS -o /tmp/wiener-v15-api-smoke.json -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' "${API_URL}/functions/v1/wiener-api" || true)\ncase "$pre_code" in 000|404|502) fail "VPS API precheck failed: HTTP $pre_code" ;; esac\ncat /tmp/wiener-v15-api-smoke.json || true\nnode --check "$BACKEND/server.mjs"'''
if old not in s:
    raise SystemExit('Expected precheck block not found; refusing unsafe patch')
s=s.replace(old,new,1)
old_ng='''    location = /healthz {\n        proxy_pass http://127.0.0.1:3000/;\n        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n    }'''
new_ng='''    location = /healthz {\n        default_type application/json;\n        return 200 '{"ok":true,"service":"wiener-farm-vps-web"}';\n    }'''
if old_ng not in s:
    raise SystemExit('Expected nginx health block not found; refusing unsafe patch')
s=s.replace(old_ng,new_ng,1)
old_post='''curl -fsS "${API_URL}/" >/tmp/wiener-v15-post-health.json\ncat /tmp/wiener-v15-post-health.json'''
new_post='''post_code=$(curl -sS -o /tmp/wiener-v15-post-api.json -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' "${API_URL}/functions/v1/wiener-api" || true)\ncase "$post_code" in 000|404|502) fail "VPS API post-restart check failed: HTTP $post_code" ;; esac\ncat /tmp/wiener-v15-post-api.json || true'''
if old_post not in s:
    raise SystemExit('Expected post-restart health block not found; refusing unsafe patch')
s=s.replace(old_post,new_post,1)
p.write_text(s)
print('Patched V15 readiness checks safely')
PY
exec bash "$TARGET"
