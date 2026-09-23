# L4b checkpoint 2 — queue and desk
 done: /replenishment, /skus/[code], /review, /review/[id], /orders/[id]; API-only data, changed/prior fields, evidence, affects, qty adjustments, explicit decisions, stale choice retention.
 undone: tests + screenshots + live contract adaptation; L1/L2a routes not yet on main. Tier 1 UI gate unrun = RED.
 resumable: components/{purchase,review}; approved proposal creates PO draft, then «Утвердить заказ» creates obligations (server truth).
 shell request L4a: navigation /purchases → /replenishment; /skus list absent. Existing shell/labels untouched.
 API request: recommendations must expose version for /adjust; current L1 draft schema omits it. /api/orders/:id/export.xlsx|csv pending.
 checks: TypeScript PASS; production build PASS; integration externally-unverified; no live paid provider calls.
 deps: none added; npm install reported 1 pre-existing high vulnerability.
 sha: predecessor 643e296; checkpoint tip via git log -- docs/agent_handoffs/L4B_CHECKPOINT.md.
