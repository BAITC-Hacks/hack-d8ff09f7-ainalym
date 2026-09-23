# L4b independent implementation review — final bounded recheck, 2026-09-23

**Gate: RED for the reviewer path.** The four original owned UI defects are addressed in code except for the still-visible rounded-need prose in proposal and order lines. The main API routes have not landed in this worktree, so no end-to-end decision can be certified. This is an integration gate distinct from the owned UI findings below.

## Owned UI findings and fixes

1. **Edited quantity / amount at stake — addressed.** `src/components/review/ProposalDesk.tsx:190-196,420-441` previews known-price value from the edited quantities, labels it preliminary, identifies partial cost, and retains the original amount as “До изменений”. `src/components/review/types.ts:137-162` computes with Decimal. The 12 → 120 units at 10.15 KZT case passes in `tests/ui/b_render.test.tsx:331-342`. Agreement with the eventual PO total remains unverified until the proposal API is available.

2. **Removed SKUs in the successor diff — addressed in UI.** `src/components/review/types.ts:132-135` finds lines absent from the new payload; `src/components/review/ProposalDesk.tsx:190-194,269-290` shows removed SKU identity, prior quantity, and unit cost in the main diff. `tests/ui/b_render.test.tsx:343-363` passes. The prior payload comes from the proposal list, whose real response is still unavailable here, so retention and lookup of prior versions remain an integration check.

3. **MOQ equation — structured SKU proof fixed; line prose still wrong.** `src/components/purchase/Rationale.tsx:13-31,39-68` shows raw need after the zero floor, then MOQ rounding, and suppresses legacy prose when all numeric components exist. It also identifies whether the seasonal basis is the SKU or supplier. The “11 = 15” regression case passes in `tests/ui/b_render.test.tsx:307-330`. However `src/domain/engine.ts:176` still persists the false direct equality when MOQ changes the result. `src/components/review/ProposalDesk.tsx:154-156` and `src/components/review/OrderDesk.tsx:199-203` still show that line rationale verbatim in the manager's review and saved order. With incomplete components, `Rationale.tsx:56-57` also falls back to the prose. **P2 residual:** correct the engine rationale at its owner, or render a consistent structured line explanation at those two review surfaces; verify the exported rationale as well.

4. **Selected historical run — UI logic addressed; API behavior unverified.** `src/components/purchase/Replenishment.tsx:266-282` chooses the newest returned run by maximum `started_at`, independent of list order. `:361-387` shows selected ID/date, warns on an older selection, and offers current recommendations; `:39-40,79-84` removes editing on historical rows. `src/components/purchase/QuantityEditor.tsx:29,116-135` blocks a form already open when the selection becomes historical. `tests/ui/b_render.test.tsx:384-398` checks the read-only table, but no real run-list response or background recompute was available for this gate.

The queue now distinguishes the upstream `empty_reason: "domain pending"` response from a clean empty queue in `src/components/review/ReviewQueue.tsx:12-23,57-68`; `tests/ui/b_render.test.tsx:295-306` covers both states. I found no other direct regression in these bounded fixes.

## Verification and integration boundary

- `npm run check -- ui`: **PASS**, 56/56 cases in the current UI gate.
- `npx tsc --noEmit`: **PASS**.
- Source/contract tracing was limited to the four findings and direct fixes. No browser, live provider, database mutation, build, source edit, or git ref change was made for this review.
- At this recheck, `src/app/api/` still lacks `/api/recommendations`, `/api/proposals`, `/api/queue`, `/api/calc/run[s]`, `/api/state`, `/api/modes`, `/api/agent/ledger`, and order export. `src/domain/views.ts:7-8` still returns a domain-pending empty queue. This upstream gap prevents verifying calculation → queue → version-bound decision → PO → export and any real selected-versus-latest run behavior.

**Closeout route:** correct the persisted need rationale, then run the reviewer sequence against the landed APIs with a priced quantity edit, a removed SKU in a successor proposal, an MOQ-rounded recommendation, and a newer world-event run. Check the resulting PO amount, exported per-line rationale, and 409 edit retention from server records.
