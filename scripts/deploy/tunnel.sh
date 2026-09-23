#!/bin/sh
set -eu

# Same-day fallback only. All credentials arrive through the invoking shell.
: "${DEMO_ACCESS_CODE:?Set the demo access code in the shell}"
: "${OPENAI_API_KEY:?Set the server-held event key in the shell}"
: "${AI_GATEWAY_API_KEY:?Set the server-held Jev gateway key in the shell}"
command -v cloudflared >/dev/null
command -v caffeinate >/dev/null

export AINALYM_MODE=live
export PORT=3000

scripts/start_prod.sh >/dev/null 2>&1 &
app_pid=$!
cleanup() {
  kill "$app_pid" 2>/dev/null || true
  wait "$app_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

ready=0
for _attempt in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24; do
  if curl --silent --fail http://127.0.0.1:3000/api/health >/dev/null; then ready=1; break; fi
  if ! kill -0 "$app_pid" 2>/dev/null; then break; fi
  sleep 5
done
if [ "$ready" -ne 1 ]; then
  printf 'Demo app did not become healthy on port 3000.\n' >&2
  exit 1
fi

printf 'Cloudflare prints the public HTTPS URL below. Keep this terminal open; restart this script if the tunnel stops.\n' >&2
caffeinate -dimsu cloudflared tunnel --url http://127.0.0.1:3000
