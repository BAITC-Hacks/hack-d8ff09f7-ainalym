# JUDGE-FIX closeout — judge-sim P0/P1 on the must-have flow

Lane: `lane/judgefix` (cut from main `be9e1ad`). Date: 2026-09-23, commits before 12:33Z.

## Outcome

| # | Finding | Fix | Commit |
|---|---------|-----|--------|
| P0 | Affected-only recompute lost the organisation scope: `runCalculation` defaulted to the literal `ORG-1` while the live organisation is the `organization` row (`DEMO-PARTNER-A`), and the world-event worker never passed `row.org_id`. Result: after M1 the visible SE proposal kept the old quantity (126) and stayed approvable/exportable; hosted M4 showed regular demand +3.44 % after an injected document. | `recomputeAffected(codes, agentRunId, worldEventId, orgId)` passes `org_id` to `runCalculation`; `src/ai/worker.ts` passes `row.org_id`; `runCalculation` defaults the org to the `organization` row (literal `ORG-1` only when no row exists), so full and partial runs supersede the same visible proposal. | `89c2df7` |
| P1 | Today said «Обязательств нет» while /money showed obligations: `/api/today` read `needs_review` proposals (the decision queue), /money counts approved/exported supplier orders. | `/api/today` commitments = approved/exported `supplier_order` proposals for the org (the rows `moneyView` sums); `pending_reason` keys off `queue_count`. | `43c8e76` |
| P1 | «Смотреть позиции» built `/replenishment?supplier=SE:` (trailing colon) → empty list. | Regex captures the supplier code without the colon: `/поставщику ([^\s:]+)/`. | `43c8e76` |

## Evidence

- New test `tests/ai/org_scope_recompute.test.ts`: full run for `DEMO-PARTNER-A`, then an M1-style `in_transit_update` for `SE-A` through `processEvent`; asserts exactly one visible SE proposal for the org, with a new id, a changed `SE-A` quantity, the old proposal `stale`, and the affected-only `calc_run.org_id = DEMO-PARTNER-A`. Refutation: fails on the pre-fix source (stash), passes with the fix.
- `tests/skeleton/pipeline.test.ts` line 41 updated to the new semantics (no obligations before an order is approved).
- `npx tsc --noEmit`: clean (excluding stale `.next/types`).
- `npx vitest run tests/ai tests/skeleton tests/domain`: all green except `tests/domain/a_partner.test.ts` («opens the resolved ETL database»), which fails identically on the untouched baseline (worktree DB path is `:memory:` in this environment) — not caused by this lane.
- `node scripts/scenario.mjs`: 11 PASS, 0 FAIL.
- `npm run check`: see the line at the bottom of this file.

## Files changed

- `src/domain/recompute.ts`, `src/ai/worker.ts`, `src/domain/apply.ts`
- `src/app/api/today/route.ts`, `src/app/(v2)/today/page.tsx`
- `tests/ai/org_scope_recompute.test.ts` (new), `tests/skeleton/pipeline.test.ts`
- `docs/agent_handoffs/JUDGE_FIX_CLOSEOUT.md` (this file)

## Notes and residual risk

- The `runCalculation` default change is defensive: every caller that already passed `org_id` behaves the same; callers that passed nothing now land on the real organisation instead of `ORG-1`. Tests that seed `ORG-1` events without an `organization` row keep the `ORG-1` fallback.
- Hosted M4 «+3.44 %» was a symptom of the same scope gap (the injected document recomputed under `ORG-1`, the visible view read the org's stale run); re-verify on the hosted demo after merge.
- No new dependencies, no secrets, no absolute local paths.
