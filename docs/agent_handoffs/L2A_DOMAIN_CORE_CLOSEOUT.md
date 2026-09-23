# L2a domain core closeout

BEFORE → AFTER: seam stubs and no decision path → deterministic supplier replenishment, review proposals, tasks, scheduled checks, money, and views.

- `src/domain/money.ts:22` — Decimal.js value object chosen to avoid binary rounding, exact 2 dp strings in KZT by default; arithmetic rejects mixed currencies, allocation gives remainder cents to earlier shares. Large values remain plain decimal strings.
- `src/domain/engine.ts:47` — sales/month/doc, stock and in-transit → outlier-cleaned regular demand, stockout-censored rate, own or supplier seasonality, capped YoY growth, lead-plus-review forecast, safety, MOQ, urgency; numbers and excluded documents in components and Russian rationale. Unknown or old stock is provisional and cannot enter a supplier proposal.
- `src/domain/params.ts:40` — validated supplier policy and `param_change` review proposal. `src/domain/apply.ts:25` persists runs/recommendations; `:89` groups one `supplier_order` proposal per supplier, preserves unaffected lines and supersedes unapproved versions; `:188` binds human quantity adjustment to a new proposal version; `:229` binds approval/rejection to the exact version and prepares a local PO draft. L2b's separate order approval creates obligations.
- `src/domain/tasks.ts:18` owns task creation/transition; `src/domain/schedule.ts:12` owns overdue supplier follow-up, lead-time cover reflag and affected-SKU recompute. Repeated quiet ticks write nothing.
- `src/domain/views.ts:13` builds money-first review queue; `:55` today pulse/decision/background; `:95` orders. It retains L2b `moneyView` and `skuView` exports.
- `src/app/api/proposals/route.ts`, `[id]/route.ts`, `[id]/approve/route.ts`, `[id]/reject/route.ts`, `_decision.ts` — list/detail and zod-validated versioned decisions with 409 stale envelope.

State machine:
| Object | From | Allowed next | Authority |
|---|---|---|---|
| task | preparing | awaiting_supplier, needs_review, ready_to_handover | autonomous transition |
| task | awaiting_supplier | preparing, needs_review | autonomous transition; overdue follow-up is a review proposal |
| task | needs_review | preparing, ready_to_handover | human decision |
| task | ready_to_handover | handed_over, handover_failed | peer result |
| task | handover_failed | ready_to_handover | retry |
| proposal | needs_review | approved, rejected, stale | exact-version human decision or newer evidence |
| order | draft | approved → exported | L2b human approval, then L6 file export |

Files changed: `src/domain/money.ts`, `engine.ts`, `params.ts`, `apply.ts`, `tasks.ts`, `schedule.ts`, `views.ts`; the five proposal route files above; `tests/domain/a_money.test.ts`, `a_engine.test.ts`, `a_apply.test.ts`, `a_schedule.test.ts`, `a_decisions.test.ts`, `a_partner.test.ts`, `a_params.test.ts`, `a_ledger.test.ts`; `docs/agent_handoffs/L2A_CHECKPOINT.md` and this closeout. Additive schema changes: none. Dependencies added: none (`decimal.js`, zod and vitest were in the base).

Evidence: `npm run etl` loaded 3,909 SKUs; named partner M1–M5 tests pass, including 100-unit in-transit sensitivity, Q3 seasonal peak, stockout uplift, existing one-off document and injected 5,000-unit exclusion. Full SE calculation produces one supplier proposal and names unresolved source gaps. `npx tsc --noEmit` and `npm run build` pass.

Gate: RED. Last `npm run check -- domain`: passed=62 failed=4. Two fail-first ledger cases await L1's persisted `src/server/ledger.ts` on `main`; strict `src/domain` no-float grep finds `Number(` / `toFixed` in L2b-owned `cashflow/events/obligations/orders`; L2b's `recomputeAffected` test supplies no sales source, which the engine correctly refuses. HTTP `/api/queue` and `/api/today` remain unverified after L1 merge (last curl had no server). L3's tick still uses its own scheduled check; L6's 1С export gate has not been run here.

Next route: merge L1 to main and rerun the ledger and HTTP gates; root/L2b resolve the two cross-lane domain failures without weakening source refusal or the mandated no-float scan; wire L3 tick to this schedule module; run L6 export gate. Concentrated single-document detection supplements the v0 max-threshold rule so the mandated 5,000-unit judge injection is excluded. No model calls, external sends, schema edits or partner fixture edits occurred.

tip: 13e8262
