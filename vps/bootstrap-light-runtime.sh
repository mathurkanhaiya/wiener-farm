#!/usr/bin/env bash
set -Eeuo pipefail

BASE=/opt/wiener-selfhost
SRC=/opt/wiener-functions/supabase/functions
BACKEND_ENV=/opt/wiener-backend/.env

[ "$(id -u)" = "0" ] || { echo 'Run as root'; exit 1; }
[ -d "$SRC" ] || { echo "Missing $SRC"; exit 1; }
[ -f "$BACKEND_ENV" ] || { echo "Missing $BACKEND_ENV"; exit 1; }

echo '[1/8] Installing lightweight runtime dependencies...'
apt-get update -qq
apt-get install -y -qq curl ca-certificates nginx docker.io >/dev/null
if ! docker compose version >/dev/null 2>&1; then
  apt-get install -y -qq docker-compose >/dev/null || true
fi
systemctl enable --now docker nginx >/dev/null

DC='docker compose'
if ! docker compose version >/dev/null 2>&1; then DC='docker-compose'; fi

mkdir -p "$BASE/functions"
rm -rf "$BASE/functions"/wiener-* "$BASE/functions/main"
cp -a "$SRC"/wiener-* "$BASE/functions/"
if [ -f "$SRC/deno.jsonc" ]; then cp "$SRC/deno.jsonc" "$BASE/functions/deno.jsonc"; else printf '{}\n' > "$BASE/functions/deno.jsonc"; fi
mkdir -p "$BASE/functions/main"

echo '[2/8] Installing current official Supabase function router...'
curl -fsSL https://raw.githubusercontent.com/supabase/supabase/master/docker/volumes/functions/main/index.ts -o "$BASE/functions/main/index.ts"

cp "$BACKEND_ENV" "$BASE/.env"
chmod 600 "$BASE/.env"

# Local compatibility keys are intentionally non-secret because this gateway is localhost-only.
grep -q '^SUPABASE_SERVICE_ROLE_KEY=' "$BASE/.env" || echo 'SUPABASE_SERVICE_ROLE_KEY=local-service-role' >> "$BASE/.env"
grep -q '^SUPABASE_ANON_KEY=' "$BASE/.env" || echo 'SUPABASE_ANON_KEY=local-anon' >> "$BASE/.env"

cat > "$BASE/docker-compose.yml" <<'YAML'
services:
  rest:
    image: postgrest/postgrest:v14.6
    container_name: wiener-postgrest
    restart: unless-stopped
    network_mode: host
    env_file: .env
    environment:
      PGRST_DB_URI: ${DATABASE_URL}
      PGRST_DB_SCHEMAS: public
      PGRST_DB_ANON_ROLE: wiener_app
      PGRST_DB_EXTRA_SEARCH_PATH: public
      PGRST_SERVER_HOST: 127.0.0.1
      PGRST_SERVER_PORT: 3001
      PGRST_DB_MAX_ROWS: 2000

  functions:
    image: supabase/edge-runtime:v1.71.2
    container_name: wiener-edge-runtime
    restart: unless-stopped
    network_mode: host
    env_file: .env
    environment:
      SUPABASE_URL: http://127.0.0.1:54322
      SUPABASE_PUBLIC_URL: http://127.0.0.1:54322
      SUPABASE_DB_URL: ${DATABASE_URL}
      SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY:-local-service-role}
      SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY:-local-anon}
      VERIFY_JWT: 'false'
    volumes:
      - ./functions:/home/deno/functions:ro
      - deno-cache:/root/.cache/deno
    command: ['start','--main-service','/home/deno/functions/main']

volumes:
  deno-cache:
YAML

cat > /etc/nginx/conf.d/wiener-selfhost-internal.conf <<'NGINX'
server {
    listen 127.0.0.1:54322;
    server_name _;
    client_max_body_size 8m;

    location /rest/v1/ {
        rewrite ^/rest/v1/(.*)$ /$1 break;
        proxy_set_header Authorization "";
        proxy_set_header apikey "";
        proxy_set_header Host 127.0.0.1;
        proxy_pass http://127.0.0.1:3001;
    }

    location /functions/v1/ {
        rewrite ^/functions/v1/(.*)$ /$1 break;
        proxy_set_header Host 127.0.0.1;
        proxy_pass http://127.0.0.1:9000;
        proxy_http_version 1.1;
        proxy_read_timeout 75s;
    }

    # Temporary compatibility only for the single downloaded function that uses Storage.
    # Core database/function traffic does not use managed Supabase through this path.
    location /storage/v1/ {
        proxy_ssl_server_name on;
        proxy_set_header Host hvyrairuogiljplmsuat.supabase.co;
        proxy_pass https://hvyrairuogiljplmsuat.supabase.co/storage/v1/;
    }
}
NGINX

nginx -t >/dev/null
systemctl reload nginx

echo '[3/8] Checking function environment names (values are never printed)...'
AUTO_RE='^(SUPABASE_URL|SUPABASE_PUBLIC_URL|SUPABASE_DB_URL|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_ANON_KEY|SUPABASE_FUNCTION_SLUG|JWT_SECRET|VERIFY_JWT)$'
find "$BASE/functions" -path '*/wiener-*/*' -type f \( -name '*.ts' -o -name '*.js' \) -print0 \
 | xargs -0 grep -hoE 'Deno\.env\.get\(["'"''][A-Z0-9_]+["'"'']\)' 2>/dev/null \
 | sed -E 's/.*\(["'"'']([A-Z0-9_]+)["'"'']\).*/\1/' | sort -u > "$BASE/required-env.txt" || true
cut -d= -f1 "$BASE/.env" | sed '/^#/d;/^$/d' | sort -u > "$BASE/present-env.txt"
grep -Ev "$AUTO_RE" "$BASE/required-env.txt" | comm -23 - "$BASE/present-env.txt" > "$BASE/missing-env.txt" || true

echo '[4/8] Starting PostgREST + Edge Runtime...'
cd "$BASE"
$DC pull
$DC up -d

sleep 8

echo '[5/8] PostgreSQL REST check...'
REST_CODE=$(curl -sS -o /tmp/wiener-rest-check.txt -w '%{http_code}' 'http://127.0.0.1:54322/rest/v1/users?select=id&limit=1' || true)
echo "REST_HTTP=$REST_CODE"


echo '[6/8] Edge Runtime check...'
FN_CODE=$(curl -sS -o /tmp/wiener-fn-check.txt -w '%{http_code}' -X POST 'http://127.0.0.1:54322/functions/v1/wiener-api' -H 'content-type: application/json' -d '{}' || true)
echo "FUNCTION_HTTP=$FN_CODE"
head -c 500 /tmp/wiener-fn-check.txt 2>/dev/null || true
echo


echo '[7/8] Containers...'
$DC ps


echo '[8/8] Secret-name audit...'
if [ -s "$BASE/missing-env.txt" ]; then
  echo 'MISSING_ENV_NAMES (names only; do not paste secret values into chat):'
  cat "$BASE/missing-env.txt"
else
  echo 'MISSING_ENV_NAMES=0'
fi

echo
echo 'STAGING_RUNTIME_READY'
echo 'Production routing was NOT changed.'
