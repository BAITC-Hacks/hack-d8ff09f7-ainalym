# L2a domain core closeout

BEFORE → AFTER: seam stubs and no decision path → deterministic supplier replenishment, review proposals, tasks, scheduled checks, money, and views.

- `src/domain/money.ts:22` — Decimal.js value object chosen to avoid binary rounding, exact 2 dp strings in KZT by default; arithmetic rejects mixed currencies, allocation gives remainder cents to earlier shares. Large values remain plain decimal strings.
- `src/domain/engine.ts:47` — sales/month/doc, stock history/current snapshot and in-transit → outlier-cleaned regular demand, stockout-censored rate, own or supplier seasonality, capped YoY growth, lead-plus-review forecast, safety, MOQ, urgency; numbers and excluded documents in components and Russian rationale. The accepted outlier ceiling is `max(20,min(3×median month,5×p95 document))`. A missing stock history refuses the calculation; old or unknown current stock cannot enter a supplier proposal.
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

Evidence: `npm run etl` loaded 3,909 SKUs; named partner M1–M5 tests pass, including 100-unit in-transit sensitivity, Q3 seasonal peak, stockout uplift, existing one-off document and injected 5,000-unit exclusion. Full SE calculation produces one supplier proposal and names unresolved source gaps. `node scripts/scenario.mjs` passes all 10 checks; `npm run check -- peers` passes 9/9 including 1С CSV/XLSX export after approval. `npx tsc --noEmit` and `npm run build` pass.

Gate: RED. Last `npm run check -- domain`: passed=74 failed=2; the two fail-first ledger cases await L1's persisted `src/server/ledger.ts` on `main`. Strict `src/domain` no-float scan and L2b recompute tests pass. HTTP `/api/queue` and `/api/today` remain unverified because L1 routes are not on `main`. L3's tick still uses its own scheduled check.

Next route: merge L1 to main and rerun domain and HTTP gates; L3 should call this schedule module in its tick. No model calls, external sends, schema edits or partner fixture edits occurred. L2a added no dependency; the merged `main` provided additive `sku.on_hand_qty/on_hand_as_of` columns.

tip: c028e27
