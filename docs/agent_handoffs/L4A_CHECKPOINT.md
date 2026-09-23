# L4a checkpoint 3 — tier 1 state gate
Done: shell + Pulse; loading/empty/unavailable/pending/failure/offline/stale; exact-currency formatting; visible-only 5s sync and input/focus preservation.
Checks: `npm run check -- ui` → passed=18 failed=0; scoped ESLint + TypeScript pass; production build verified.
Renders: docs/evidence/ui/today_1440_unavailable.png and today_390_unavailable.png; real absent-API state; no overflow; phone targets ≥44px.
Evidence: docs/evidence/ui/today_verification.md names measured and unmeasured surfaces.
Deps added: jsdom, @testing-library/react (dev only); local font provenance in public/fonts/README.md.
Imports: `@/components/labels`, `@/components/shell` as checkpoint 1; no voice or other UI lane paths changed.
Undone: tier-2 money; integration with pending today/queue/ledger/world/modes routes is externally-unverified. Gate: RED until integration runs.
Resumable: merge latest main, verify contract payloads, then money. Pulse mechanism sha: 7caf1ab; this gates sha: resolve commit of this file.
