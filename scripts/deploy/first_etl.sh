#!/bin/sh
set -eu

DATABASE_PATH=$(node --input-type=module -e 'import { databasePath } from "./src/db/path.mjs"; console.log(databasePath())')
export DATABASE_PATH
if [ ! -s "$DATABASE_PATH" ]; then
  npm run etl -- --db "$DATABASE_PATH"
fi
