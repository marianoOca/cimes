#!/usr/bin/env bash
# CIMES local dev: backend + website in ONE command; ctrl-C stops both.
#
#   ./dev.sh          stub backend (fake prices/coverage/orders, NOTHING real is
#                     written) + website                                 [default]
#   ./dev.sh --real   real backend (src: npm run dev, reads src/.env) + website
#
# Website:  http://localhost:$WEB_PORT   (the /api/* calls are proxied to the backend)
# Overrides: WEB_PORT (8080), API_PORT (stub, 4590), REAL_PORT (real backend, 3000)
#
# The website is a static site; dev/serve.mjs serves it and proxies /api/* to the
# backend, and rewrites config.js so the wizard talks to this same origin.
set -euo pipefail
cd "$(dirname "$0")"

WEB_PORT="${WEB_PORT:-8080}"
API_PORT="${API_PORT:-4590}"
REAL_PORT="${REAL_PORT:-3000}"
MODE="${1:-stub}"

free_port() {
  local pid
  pid="$(lsof -tiTCP:"$1" -sTCP:LISTEN 2>/dev/null || true)"
  if [ -n "$pid" ]; then echo "freeing :$1 (pid $pid)"; kill $pid 2>/dev/null || true; sleep 1; fi
}

pids=()
cleanup() {
  echo
  echo "stopping..."
  for p in "${pids[@]:-}"; do kill "$p" 2>/dev/null || true; done
}
trap cleanup EXIT INT TERM

free_port "$WEB_PORT"

if [ "$MODE" = "--real" ] || [ "$MODE" = "real" ]; then
  echo "backend: REAL on :$REAL_PORT  (reads src/.env)"
  echo "  WARNING: against the real backend, 'Confirmar pedido' writes a PRODUCTION order."
  ( cd src && PORT="$REAL_PORT" npm run dev ) &
  pids+=($!)
  BACKEND="http://localhost:$REAL_PORT"
else
  echo "backend: STUB on :$API_PORT  (fake data; nothing real is written)"
  free_port "$API_PORT"
  PORT="$API_PORT" node dev/stub-backend.mjs &
  pids+=($!)
  BACKEND="http://localhost:$API_PORT"
fi

sleep 1
WEBSITE_DIR="$(pwd)/website" PORT="$WEB_PORT" BACKEND="$BACKEND" node dev/serve.mjs &
pids+=($!)

echo
echo "  website  ->  http://localhost:$WEB_PORT/"
echo "  alta     ->  http://localhost:$WEB_PORT/alta/?city=mercedes"
echo "  (ctrl-C stops both)"
echo
wait
