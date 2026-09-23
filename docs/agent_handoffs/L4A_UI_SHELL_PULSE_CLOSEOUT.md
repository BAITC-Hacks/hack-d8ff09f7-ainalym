# L4a — shell, labels, Pulse, money closeout

BEFORE → AFTER: Next scaffold → API-backed replenishment shell, Pulse and money; no invented business records.
- Root font-only frame: `src/app/layout.tsx:7`; grouped shell: `src/app/(app)/layout.tsx:2`; `/` redirect: `src/app/page.tsx:2`.
- Navigation/phone/palette/offline: `src/components/shell/AppShell.tsx:14`; visible polling + URL-isolated snapshots: `src/components/shell/api.tsx:17`.
- Pulse money/queue/commitments/ledger: `src/components/pulse/Pulse.tsx:13`; Play/compose/replay: `src/components/feed/WorldFeed.tsx:10`.
- Money schedule, per-currency amounts and risks: `src/app/(app)/money/MoneyPage.tsx:9`.
- Every changed file, including test/dependency/evidence files: [L4A_FILES.md](L4A_FILES.md).

| Token family (`src/styles/tokens.css:2`) | Value |
|---|---|
| Page / panel / wash | #fdfdfc / #fff / #f4f5f7 |
| Ink / muted / accent / focus | #17212b / #5b6673 / #1f5fd1 / #236bd1 |
| Type | Inter local variable, 400/500/600; CJK system fallback; tabular numerals |
| Caption / body / section / lead | 12/16 · 15/20 · 17/24 · 20/24 px |
| Display / value | 32/36 · 36/40 px; display 28 desktop-small, 26 phone |
| Space / frame | 4–24 px; rail 224/56; bar 56; work rail 360; panel 20/16 |
| Targets / motion | Phone ≥44 px; 120/150 ms, popover 200 ms; cubic-bezier(.2,.8,.2,1); reduced motion |

Imports for L4b/L4c: `@/components/labels` exports `LABELS`, `TruthAxes`, `resultAxes`, `Chip`, `ModeChip`, `TruthAxisLabels`/`TruthLabels`, `TaskStateChip`, `ProposalStateChip`, `UrgencyChip`, `AgentsLabel`, `WorldLabel`.
`@/components/shell` exports `AppShell`, `ApiProvider`, `ApiError`, `apiRequest`, `useApi`, `useApiSync`, `Button`, `ActionStatus`, `LoadError`, `Skeleton`, `EmptyState`, `useApiAction`, `ModesResponse`.
Labels bind to each recorded result; missing axes remain unknown. Queue/ledger labels stay visible outside «Почему?». No live-mode substitution.

| State / property | Done / undone; evidence |
|---|---|
| Loading · empty · unavailable | DONE mechanisms + automated regressions; real unavailable cold-open captures |
| Pending · duplicate-click lock · failure | DONE; immediate aria-busy, API rejection preserves fields |
| Stale approval | DONE; only displayed version is submitted; missing version unavailable; 409 inline |
| Offline · retry · hidden-tab pause | DONE automated; unavailable band seen in browser; real offline root gate UNVERIFIED |
| Focus across updates | DONE tested input, removed queue row/disclosure, browser Play; global focus/CLS audit UNDONE |
| Feed Play · numeric compose · replay | DONE real isolated rules run; 2 canonical events; +100 applied once; repeat had no effect |
| Full Pulse queue · persisted ledger + ratio | IMPLEMENTED; live acceptance UNDONE, L1 dependency absent |
| Timing · screen reader · full keyboard budget | UNDONE measurement; no latency/CLS/performance claim |

Checks: `npm run check -- ui` → passed=30 failed=0; `npx tsc --noEmit`, scoped ESLint, `npm run build`, `git diff --check` PASS. Build retains upstream middleware-deprecation warning.
Screenshots: `docs/evidence/ui/today_1440_unavailable.png`, `today_390_unavailable.png`; additional `today_feed_phone.png`, `today_feed_replay.png`, `money_1728_partner.png`.
Browser widths 1440/390/1728: no horizontal overflow; observed phone targets ≥44×44; Inter loaded; viewport restored, QA server stopped.
Token contrast and exact browser/test limits: [today_verification.md](../evidence/ui/today_verification.md).
Fresh bounded independent refutation/fix verification: [L4A_REVIEW_FOLLOWUP.md](L4A_REVIEW_FOLLOWUP.md), GREEN within its stated scope; original RED retained.
Dependencies added: dev-only `@testing-library/react` 16.3.3 and `jsdom` 30.1.1; no UI runtime library. Inter/OFL bundled and listed in font/root READMEs.
Deviations: D-H46 calculation composer replaces trading evidence/goals; no timer or unsupported manual sales/stock compose; numeric fields match landed L6 API. Missing `/skus` catalogue is explained, with a link to replenishment.
Protected: no L4a edits to voice/backend/other UI lanes, secrets, partner exports, main, or production. Main changes merged normally; local QA uses isolated SQLite + rules, no paid provider calls.
Unverified: L1 today/queue/modes/state/calc/ledger routes and persistent ledger, hosted guard, live provider, populated Pulse and all browser timing budgets. Real Play creates proposals but ledger seam stores no actions.
Next route: merge L1, fix reset's custom database-path forwarding upstream, then prove Play→ledger→queue without reload or focus movement. [Exact findings](L4A_INTEGRATION_FINDINGS.md).
Gate: RED — full integration and measured budget gates unrun; UI checks and bounded review pass.
Tip below is the tested implementation plus a documentation-only main merge; this closeout follows in a documentation-only commit.
tip: f53f5f53ec2dd9ef6c88b500da7ed5ef64f5014b
