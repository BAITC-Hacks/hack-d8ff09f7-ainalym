#!/bin/sh
set -eu

: "${DATABASE_PATH:=./data/ainalym.db}"
case "$DATABASE_PATH" in
  /*|:memory:) ;;
  *) DATABASE_PATH="$PWD/$DATABASE_PATH" ;;
esac
export DATABASE_PATH
source_root=$PWD
command -v rsync >/dev/null

stage=$(mktemp -d /tmp/ainalym-start.XXXXXX)
server_pid=
cleanup() {
  if [ -n "$server_pid" ]; then kill "$server_pid" 2>/dev/null || true; fi
  if [ -d "$stage" ]; then rm -r "$stage"; fi
}
trap cleanup EXIT INT TERM
rsync -a --exclude='.env*' --exclude='.git' --exclude='node_modules' --exclude='.next' \
  package.json package-lock.json next.config.ts tsconfig.json src public fixtures scripts "$stage/"
(
  cd "$stage"
  env -u OPENAI_API_KEY -u AI_GATEWAY_API_KEY -u TYPESAFE_API_KEY -u NVIDIA_API_KEY -u DEMO_ACCESS_CODE npm ci --include=dev
  if [ ! -s "$DATABASE_PATH" ] && node -e "process.exit(require('./package.json').scripts.etl ? 0 : 1)"; then
    env -u OPENAI_API_KEY -u AI_GATEWAY_API_KEY -u TYPESAFE_API_KEY -u NVIDIA_API_KEY -u DEMO_ACCESS_CODE npm run etl -- --db "$DATABASE_PATH"
  fi
  env -u OPENAI_API_KEY -u AI_GATEWAY_API_KEY -u TYPESAFE_API_KEY -u NVIDIA_API_KEY -u DEMO_ACCESS_CODE npm run build
)
mkdir -p "$source_root/data"
ln -s "$source_root/data" "$stage/data"
cd "$stage"
npm start -- --hostname "${AINALYM_BIND_HOST:-127.0.0.1}" &
server_pid=$!
wait "$server_pid"
