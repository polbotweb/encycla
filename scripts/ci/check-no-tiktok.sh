#!/usr/bin/env bash
# Builds and starts Encycla WITHOUT the optional TikTok dependency (tiktok-live-connector), in a
# scratch copy of the working tree (as the default Docker image: optional packages pruned): the web game must work with TikTok off, and the simulated
# chat (TIKTOK_ADAPTER=fake) must not need the package either. Usage: scripts/ci/check-no-tiktok.sh
set -euo pipefail
SRC="$(cd "$(dirname "$0")/../.." && pwd)"
WORK="${NO_TIKTOK_DIR:-/tmp/encycla-no-tiktok}"
PORT="${NO_TIKTOK_PORT:-3190}"
rm -rf "$WORK" && mkdir -p "$WORK"
tar -C "$SRC" --exclude=./node_modules --exclude=./dist --exclude=./.git --exclude=./data/cache \
  --exclude='./data/*.db*' --exclude=./data/image-cache --exclude=./data/backups \
  --exclude=./test-results --exclude=./playwright-report -cf - . | tar -C "$WORK" -xf -
cd "$WORK"
# Same path as the Docker image without WITH_TIKTOK: build, then drop dev and optional packages.
pnpm install --frozen-lockfile --prefer-offline >/dev/null
pnpm -s build >/dev/null
pnpm prune --prod --no-optional >/dev/null
if [ -e node_modules/tiktok-live-connector ]; then echo "tiktok-live-connector is installed" >&2; exit 1; fi
check() {
  local label="$1"; shift
  env "$@" PORT="$PORT" DATABASE_PATH="$WORK/data/check.db" RATE_LIMIT=off node dist/server/index.js >"$WORK/server.log" 2>&1 &
  local pid=$!
  for _ in $(seq 1 40); do curl -sf "http://127.0.0.1:$PORT/api/health" >/dev/null && break; sleep 0.5; done
  local health tiktok
  health="$(curl -sf "http://127.0.0.1:$PORT/api/health")"
  tiktok="$(curl -s -H "Authorization: Bearer $ADMIN" "http://127.0.0.1:$PORT/api/admin/tiktok")"
  curl -sf "http://127.0.0.1:$PORT/" | grep -q '<div id="root"'
  kill "$pid"; wait "$pid" 2>/dev/null || true
  echo "$label: health=$(echo "$health" | grep -o '"status":"[a-z]*"') tiktok=$(echo "$tiktok" | grep -o '"enabled":[a-z]*,"simulated":[a-z]*')"
}
ADMIN=check-admin-token-0123456789
check "TikTok off" TIKTOK_ENABLED=false ADMIN_TOKEN=$ADMIN
check "TikTok fake chat" TIKTOK_ENABLED=true TIKTOK_ADAPTER=fake TIKTOK_USERNAME=encycla_demo ADMIN_TOKEN=$ADMIN
echo "OK: built and served without tiktok-live-connector"
