# L4b integration requests — 2026-09-23

Owning UI: `/replenishment`, `/skus/[code]`, `/review`, `/review/[id]`, `/orders/[id]`. These requests do not authorize L4b to edit another lane.

1. L1/L2a: land `/api/recommendations`, `/api/calc/run`, `/api/calc/runs`, `/api/proposals`, `/api/queue`, `/api/state`, `/api/modes`, `/api/agent/ledger`. On main 303f2dc these routes are absent; UI renders unavailable and retries.
2. L1/L2a: each recommendation row needs `version`, `state`, `run_id`, `supplier_id`, `proposal_id`. Current L1 worktree response projects these away; qty editing is deliberately disabled if version is absent. Implement `/api/recommendations/:id/adjust {qty,reason,version}` with 409 and preserve original qty.
3. L6/L2a: `/api/orders/:id/export.xlsx|csv` must return binary files per CONTRACTS. Existing `/api/peers/onec-export/:id` is a view, not the declared download endpoint. UI handles missing export inline, never claims success.
4. L2a: `rationale_ru` currently states forecast + safety − stock − in transit = MOQ-rounded quantity (e.g. 11 = 15). UI now separates raw need, zero floor and rounding, but persisted prose still appears in proposal/order line disclosures and needs those distinct steps from the domain owner.
5. L2b/L2a: SKU `series.qty_regular` should expose the regular series; when absent the chart leaves gaps. Record truth axes on result responses, not just current modes. Missing metadata stays unknown in UI.
6. L4a: navigation now points to `/replenishment` (resolved in 303f2dc); `/skus` honestly unavailable until its page lands. Remaining request: add page shortcut labels to `?`: replenishment R focuses calculation, F focuses search; desk D focuses approval; order E focuses export. Existing shell and labels were imported, never edited by L4b.
7. L4c assistant export is now mounted in SKU facts rail with `{org_id:"partner", supplier_id, code_1c}`. No export request remains.
