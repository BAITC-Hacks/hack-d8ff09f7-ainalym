#!/usr/bin/env bash
# Clean-clone check: clone → install → .env.example → npm run check, as a stranger would.
# Usage: bash scripts/clean_clone_check.sh [remote-url] [ref]
# Fails on: any step error, missing check summary line, founder filesystem paths,
# hidden caches or untracked/ignored fixtures in the clone.
set -euo pipefail

REMOTE="${1:-https://github.com/BAITC-Hacks/hack-d8ff09f7-ainalym.git}"
REF="${2:-main}"
DIR="${CLEAN_DIR:-/tmp/ainalym-clean}"

fail() { echo "CLEAN-CLONE: FAIL — $*"; exit 1; }

rm -rf "$DIR"
git clone --quiet --branch "$REF" "$REMOTE" "$DIR" || fail "git clone $REMOTE ($REF)"
cd "$DIR"
echo "CLEAN-CLONE: cloned $REF @ $(git rev-parse --short HEAD)"

# 1) founder filesystem paths in tracked files
if git grep -nIE '/Users/|/home/[a-z]+/|~/Ventures|C:\\\\Users' -- . ':!scripts/clean_clone_check.sh' >/tmp/ainalym-clean-paths.txt; then
  cat /tmp/ainalym-clean-paths.txt
  fail "founder filesystem path in tracked files"
fi

# 2) hidden caches committed
if git ls-files | grep -E '(^|/)(\.next|node_modules|\.cache|\.turbo|\.vercel|__pycache__|\.DS_Store)(/|$)|\.db$|\.sqlite$|(^|/)\.env($|\.local)'; then
  fail "hidden cache, database or env file is tracked"
fi

# 3) no key needed: .env.example → .env.local, all keys empty
cp .env.example .env.local
if grep -E '^(TYPESAFE_API_KEY|AI_GATEWAY_API_KEY|OPENAI_API_KEY|NVIDIA_API_KEY|DEMO_ACCESS_CODE)=.+' .env.local; then
  fail ".env.example carries a non-empty secret value"
fi

npm install --no-audit --no-fund >/tmp/ainalym-clean-install.log 2>&1 || { tail -30 /tmp/ainalym-clean-install.log; fail "npm install"; }
echo "CLEAN-CLONE: npm install OK (node $(node -v))"

set +e
npm run etl 2>&1 | tail -3   # the partner checks fail closed without the ETL database (README: etl, then check)
npm run check 2>&1 | tee /tmp/ainalym-clean-check.log
CHECK_EXIT=${PIPESTATUS[0]}
set -e

# 4) fixtures the check needs must be tracked (untracked = produced or missing)
UNTRACKED=$(git status --porcelain --untracked-files=all -- fixtures tests/fixtures 2>/dev/null || true)
if [ -n "$UNTRACKED" ]; then
  echo "$UNTRACKED"
  fail "untracked fixture files appeared under fixtures/ or tests/fixtures/"
fi

SUMMARY=$(grep -E '^check: passed=[0-9]+ failed=[0-9]+' /tmp/ainalym-clean-check.log | tail -1 || true)
[ -n "$SUMMARY" ] || fail "no 'check: passed=… failed=…' summary line (exit $CHECK_EXIT)"
echo "CLEAN-CLONE: $SUMMARY"
[ "$CHECK_EXIT" -eq 0 ] || fail "npm run check exited $CHECK_EXIT"
echo "CLEAN-CLONE: PASS @ $(git rev-parse --short HEAD)"
