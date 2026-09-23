#!/bin/sh
set -eu

: "${DATABASE_PATH:=./data/ainalym.db}"
export DATABASE_PATH

if [ ! -s "$DATABASE_PATH" ] && node -e "process.exit(require('./package.json').scripts.etl ? 0 : 1)"; then
  npm run etl -- --db "$DATABASE_PATH"
fi

npm run build
exec npm start
