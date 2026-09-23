# L4a independent follow-up — 2026-09-23

Gate: GREEN — the four original defects and the additional focus counterexample are closed within this bounded review.
Scope: fixes identified by the parent as `5581740`, the focus patch identified as `adc7cdb`, and subsequent money fallback/disclosure-focus deltas. Commit identity is parent-reported; no git commands were run.
Method: fresh bounded source/test inspection under the existing oil-frontend/frontend-craft review contract; no implementation edits.

## Verified fixes

- **Displayed approval version:** `DecisionQueue.tsx:13–16,22` reads only `proposal_version`/`version` from the displayed row. Missing version raises an inline error before any fetch; no unseen-version lookup remains. Tests exercise displayed v7, a 409, and an omitted version despite a mocked available v8.
- **Historical truth axes:** `labels/index.tsx:5` merges the result's nested/top-level fields. Queue and ledger prefer their own metadata; current Pulse callers supply no runtime fallback (`Pulse.tsx:21,27`). Money uses its response metadata (`MoneyPage.tsx:22`); compose retains its response metadata. Missing axes remain unknown on current production call paths. Replay-versus-live regression passes.
- **Pending money:** `MoneyPage.tsx:10,16–21` separates an unavailable/pending response from a ready empty snapshot. No claims of absent approved orders or payments are produced for `empty_reason:"domain pending"`.
- **Additional money delta:** unavailable cash/stock summaries now say «Нет данных» (`MoneyPage.tsx:17`); ready empty snapshots keep domain wording. The extended pending-money test and existing ready-snapshot test both pass.
- **Compose completion:** `WorldFeed.tsx:19` no longer treats `run_id` as completion evidence. An accepted event is described as saved with its processing result deferred to the ledger; response without an event has an explicitly unconfirmed event status. The running-run regression passes.
- **Focused record retention:** the existing test confirms that a removed queue row stays mounted while its approval control owns focus, pending writes are blocked by the shared Button handler, and explicit update applies the new snapshot.

## Additional focus verification

The first follow-up probe reproduced loss of focus when a focused «Ещё решения (1)» summary disappeared on `[first, second] → [first]`; the original guard covered only record descendants.
The parent corrected that guard during this review. Current `useFocusSnapshot.ts:13,22` protects any focused descendant of the queue region, excluding the stable region itself.
An independent in-memory jsdom/React probe against the updated actual component confirms: the disclosure stays connected and focused on 2→1 refresh; pending clears when the incoming snapshot returns to the displayed one; moving focus to an outside button applies the newest snapshot without stealing focus.
The new repository disclosure regression also passes. No remaining counterexample found in the bounded surface.

## Evidence and limits

- `npm run check -- ui`: passed=26, failed=0, skipped=0, externally-unverified=0.
- After the money delta, `npx vitest run tests/ui/a_money_page.test.tsx`: 3 passed. A non-failing Vite configuration compatibility warning was emitted.
- After the disclosure fix, `npx vitest run tests/ui/a_actions.test.tsx tests/ui/a_money_page.test.tsx`: 14 passed; includes the new focus regression and all four defect cases.
- Read-only `cat`, `rg`, `nl` inspected the affected files and current call sites. `node <<'NODE'` compiled source in memory and used synthetic fixtures; the successful focus probe wrote no files or runtime data.
- The first standalone probe failed during harness setup because Next expected `self`; rerunning with the jsdom global supplied reproduced the product focus defect above. This was not a product test failure.
- Browser evidence, real viewport focus behavior, live providers/endpoints, DB changes, build/lint/typecheck results and broader UI acceptance were not independently verified here; the parent owns those checks.
- No source/tests, dependency files, DBs, browser sessions, git or other lanes touched. Only changed file: `docs/agent_handoffs/L4A_REVIEW_FOLLOWUP.md`.
- This gate covers the explicitly rechecked disclosure and money deltas; it is not overall product/browser acceptance.
