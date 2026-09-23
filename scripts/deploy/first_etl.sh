#!/bin/sh
set -eu

if [ ! -s "${DATABASE_PATH:?}" ] && node -e 'process.exit(require("./package.json").scripts.etl ? 0 : 1)'; then
  npm run etl -- --db "$DATABASE_PATH"
fi
