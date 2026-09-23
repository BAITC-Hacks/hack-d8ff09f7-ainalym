# L4a integration findings — 2026-09-23

- At merged main 02b088e, today/queue/modes/state/agent-ledger/world routes are still absent. UI shows real unavailable states and retries; no fabricated records. Next route: merge L1/L6 checkpoints and run the replenishment Play→ledger→queue path.
- `DATABASE_PATH=data/ui-a-qa.sqlite npm run demo:reset` fails `no such table: organization`: demo_reset passes an env var, but ETL chooses its DB only via `--db`. The loader consequently wrote this worktree's default `data/partner.db` instead; neither DB is production. Root/L1 owns the fix: pass `--db databasePath` to the loader.
- Running `node scripts/etl/load.mjs --db data/ui-a-qa.sqlite` succeeds (counts only inspected), but the loader/schema currently leaves organization empty, so `/api/money` correctly returns Organization not found. Root/L1/L9 must seed the declared partner organization as part of reset. L4a does not invent organization or money records to obtain a populated screenshot.
- The existing font README and root README now both list the bundled Inter SIL OFL font; no extra root README edit was needed.
- All UI-only acceptance defects in L4A_REVIEW_CLOSEOUT.md are being resolved in L4a source with counterexample regressions; no backend/voice/other-UI-lane changes requested by these fixes.
