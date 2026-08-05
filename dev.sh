#!/usr/bin/env bash
# CIMES local dev: backend + website in ONE command; ctrl-C stops both.
#
#   ./dev.sh          stub backend (fake prices/coverage/orders, NOTHING real is
#                     written) + website                                 [default]
#   ./dev.sh --real   real backend (src: npm run dev, reads src/.env) + website
#
# Website:  http://localhost:$WEB_PORT   (the /api/* calls are proxied to the backend)
# Overrides: WEB_PORT (8080), API_PORT (stub, 4590), REAL_PORT (real backend, 3000),
#            MAPS_KEY (Google Maps browser key, for Places autocomplete testing)
#
# The website is a static site; dev/serve.mjs serves it and proxies /api/* to the
# backend, and rewrites config.js so the wizard talks to this same origin.
set -euo pipefail
cd "$(dirname "$0")"

# The website's Maps autocomplete reuses the backend's key from src/.env for local
# testing (MAPS_KEY env var still overrides it if set). Not for production — deploy
# uses a separate browser-restricted key in website/config.js (ops/DEPLOY.md).
if [ -z "${MAPS_KEY:-}" ] && [ -f src/.env ]; then
  MAPS_KEY="$(grep -E '^GOOGLE_MAPS_API_KEY=' src/.env | head -1 | cut -d= -f2-)"
fi

WEB_PORT="${WEB_PORT:-8080}"
API_PORT="${API_PORT:-4590}"
REAL_PORT="${REAL_PORT:-3000}"
MODE="${1:-stub}"

free_port() {
  local pid
  pid="$(lsof -tiTCP:"$1" -sTCP:LISTEN 2>/dev/null || true)"
  if [ -n "$pid" ]; then echo "freeing :$1 (pid $pid)"; kill $pid 2>/dev/null || true; sleep 1; fi
}

# Job control, so every `&` job becomes its own process-group leader. Two reasons,
# both needed for a single ctrl-C to be enough:
#   - Without it the jobs share the script's process group, so the tty delivers ctrl-C
#     to `tsx watch` directly; our kill then arrives as a *second* signal and tsx
#     answers "Previous process hasn't exited yet. Force killing...".
#   - `$!` is the PID of the `( ... ) &` subshell, not of npm/tsx underneath it, so
#     killing it alone orphans the backend. Killing the whole group reaches everything.
set -m

pids=()
stopping=0
cleanup() {
  # INT fires this, then the EXIT trap fires it again — guard, or "stopping..." twice.
  if [ "$stopping" = 1 ]; then return; fi
  stopping=1
  # Leave monitor mode before killing, or bash reports each job ("[1]- Terminated: 15
  # ( cd src && ... )") on its way out. The groups are already established.
  set +m
  echo
  echo "stopping..."
  # Negative PID = the job's whole process group (subshell + npm + tsx + its child).
  for p in "${pids[@]:-}"; do kill -TERM -"$p" 2>/dev/null || true; done
  # Give them a moment to go down cleanly, then insist.
  for _ in $(seq 20); do
    local alive=0
    for p in "${pids[@]:-}"; do
      if kill -0 "$p" 2>/dev/null; then alive=1; fi
    done
    if [ "$alive" = 0 ]; then return; fi
    sleep 0.1
  done
  for p in "${pids[@]:-}"; do kill -KILL -"$p" 2>/dev/null || true; done
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
  echo "backend: STUB on :$API_PORT  (real app logic incl. city matching; external"
  echo "         WaterService/Sheets faked — nothing real is written)"
  free_port "$API_PORT"
  ( cd src && PORT="$API_PORT" npm run dev:stub ) &
  pids+=($!)
  BACKEND="http://localhost:$API_PORT"
fi

sleep 1
WEBSITE_DIR="$(pwd)/website" PORT="$WEB_PORT" BACKEND="$BACKEND" MAPS_KEY="${MAPS_KEY:-}" node dev/serve.mjs &
pids+=($!)

echo
echo "  website  ->  http://localhost:$WEB_PORT/"
echo "  alta     ->  http://localhost:$WEB_PORT/alta/?city=mercedes"
echo "  (ctrl-C stops both)"
echo
wait
