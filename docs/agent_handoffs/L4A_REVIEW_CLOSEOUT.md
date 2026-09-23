# L4a independent UI boundary review — 2026-09-23

Gate: RED — reviewed pre-fix state; approval and result-truth defects below require correction.
One finite review pass. The parent reported starting fixes after these findings; this closeout does not assess those fixes.

Context: purchasing manager reviewing replenishment proposals, agent work and cash commitments on desktop/phone.
Authority: persisted API records and the displayed proposal version; no unattended approval. Trust failure: approving unseen changes or labeling replay as live.
Lenses: Stripe for money/provenance precision; Basecamp for readable failures and retained context.
Craft contract: preserve the quiet shell, explicit unavailable states, separate currencies, stable edits, and result-specific truth labels.

## Findings, in priority order

1. **P1 — approval can authorize a version the user never saw.**
   `src/components/pulse/DecisionQueue.tsx:14` fetches current proposals when a displayed item lacks a version; line 17 returns that version, and line 23 submits it immediately.
   Trigger: an unversioned queue snapshot shows old amounts; proposal becomes v8 before the click; lookup returns v8. The UI approves v8 with the old title/reason still displayed, defeating 409 protection.
   Reproduced the resolver with a synthetic response: it returned v8 without a new displayed snapshot. Existing omitted-version test covers only an empty lookup response.
   Smallest fix: remove the current-version lookup; refuse inline writes without a displayed version and direct the user to refreshed review. Add the newer-version regression.

2. **P1 — result truth axes are discarded and replaced by current mode.**
   `src/components/pulse/DecisionQueue.tsx:22,35`, `src/components/pulse/AgentLedger.tsx:12` and `src/components/pulse/Pulse.tsx:15` select nested axes/labels but skip supported top-level axes (`types.ts:5`).
   Trigger: persisted row carries `ai=replay`, `provenance=synthetic`, but global modes say live/partner. The row receives global labels instead of its own facts.
   Reproduced with actual component SSR: a top-level replay row rendered «Живой AI» and omitted its replay label. `MoneyPage.tsx:21` similarly labels money using current modes alone.
   Smallest fix: normalize each result's nested/top-level axes once; use explicit unknown labels for missing result axes. Runtime mode belongs in the shell, not historical result attribution.

3. **P2 — pending money is described as an empty business state.**
   `src/app/(app)/money/MoneyPage.tsx:16,18,20` uses presence of `data` to claim no planned payments or approved orders, ignoring `MoneyView.empty_reason`.
   Trigger: `{cash:[], committed_by_supplier:[], next_60d:{out:[]}, risks:[], empty_reason:"domain pending"}`. Actual SSR produced «платежи не запланированы» and «Утверждённых заказов пока нет».
   This is a local handling bug for an explicitly supported pending payload, separate from the missing domain dependency itself.
   Smallest fix: branch on the pending reason before empty-state claims, consistently with MoneyStrip/DecisionQueue, and retain an unavailable/pending explanation.

4. **P2 — a run identifier is treated as proof of completed calculation.**
   `src/components/feed/WorldFeed.tsx:18` renders «расчёт выполнен» solely when compose returns `run_id`; the contract allows agent runs to be running/done/failed and gives no completion guarantee for that identifier.
   Trigger: event accepted with a run reference while its run is still running or has failed. The receipt asserts completion without checking the outcome.
   Source-confirmed; no live provider or endpoint reproduction attempted. Smallest fix: say the event is saved and link to the run; assert completion only from a persisted successful run/result state.

## Verification and limits

- `npm run check -- ui`: passed=20, failed=0, skipped=0, externally-unverified=0. Existing tests do not cover the counterexamples above.
- Read-only `rg`, `cat`, `sed`, `nl` inspected the specified source/tests/contracts/brief and skill guidance; `view_image` inspected existing Today screenshots at 1440×900 and 390×844.
- `node <<'NODE'` ran in-memory TypeScript compilation plus real React SSR with synthetic fixtures and a mocked fetch; confirmed findings 1–3. No source/test file or runtime data was changed by that probe.
- Screenshot observations: unavailable state stays readable; phone navigation and money cells fit the captured width. These screenshots do not prove populated or pending-write behavior.
- Rubric: comprehension 3, task completion 2, truth/trust 1, hierarchy 3, domain fit 3, visual craft 3, responsive quality 3, accessibility unverified, state completeness 2, coherence 3. Scores reflect inspected evidence only.
- Unverified: live today/queue/world/ledger/modes integration, populated browser states, all viewport/focus permutations, screen-reader output, latency, CLS and measured contrast. Missing routes are dependencies, not fabricated UI success.
- Protected: no builds, browser sessions, providers, DBs, git, other lanes, source/tests or dependencies touched. No partner rows or credentials read or included.
- Only changed file: `docs/agent_handoffs/L4A_REVIEW_CLOSEOUT.md`. No second review pass; the parent owns fixes and subsequent acceptance.
