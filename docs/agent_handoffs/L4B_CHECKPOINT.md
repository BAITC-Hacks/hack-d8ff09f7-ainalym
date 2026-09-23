# L4b checkpoint 1 — replenishment workspace
done: /replenishment supplier groups, qty/reason/version adjustment, rationale, ledger; /skus/[code] chart + sources + facts; /purchases redirects.
undone: review queue / order desk; tests and screenshots; real API integration (L1 routes pending).
resumable: components/purchase; every surface reads /api/*, missing dependencies show error/loading/empty states.
shell request L4a: navigation /purchases → /replenishment; /skus list has no owner/page yet (SKU links use /skus/[code]). No shell/label export missing.
checks: npm run build + npx tsc --noEmit PASS; UI gate unrun = RED; integration externally-unverified.
dependencies: none added; npm install completed (reported 1 existing high vulnerability).
sha: checkpoint commit (see git log -- docs/agent_handoffs/L4B_CHECKPOINT.md).
