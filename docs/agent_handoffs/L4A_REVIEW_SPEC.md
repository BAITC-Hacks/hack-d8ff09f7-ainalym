# L4a independent UI boundary review
Role: fresh gate reviewer; venture ainalym; primary implementer Astra xhigh; review seat Astra xhigh, Codex own pool, no inherited history. Routing: MODEL_ROUTING_CURRENT D-1309 code review; one finite pass, bounded to this boundary.
Write tier: PATCH_ALLOWED only `docs/agent_handoffs/L4A_REVIEW_CLOSEOUT.md`. No source, test, dependency, git, database or browser mutations. Leaf: do not spawn agents.
Goal: independently refute correctness of shell, labels, Pulse and money UI against the replenishment contract. This is the OS frame for recommendations and human approval; false success and lost edits matter.
Read: oil-frontend SKILL.md; docs/CONTRACTS.md; docs/PRODUCT.md; prep brief at prep/briefs/L4_UI_AMBITION_SPEC.md §§0–3,10–14 with D-H46 replenishment objects; current implementation and tests.
Review surface: src/components/{shell,labels,pulse,feed}/**, src/styles/**, src/app/{page.tsx,layout.tsx,globals.css}, src/app/(app)/{layout.tsx,today/**,money/**}, tests/ui/a_*.test.tsx.
Questions: Do API payloads and write/version boundaries remain honest? Are failure/loading/offline/empty states distinct? Do state refresh and async writes preserve focus and edits? Are there high-impact responsive/accessibility gaps? Do all results disclose source/AI/external truth without overclaiming?
Evidence: deterministic `npm run check -- ui`, scoped source inspection, existing docs/evidence/ui/today* (screenshots captured from production build with pending APIs). Do not run live providers or modify DBs. Do not include secrets or partner row dumps.
Anti-metric: number of components/tests is not acceptance; findings need a concrete trigger and path:line. Distinguish locally reproducible bugs from dependencies not yet landed.
Stop after one finite pass. Report prioritized actionable findings, smallest legitimate fixes, commands actually run, unverified surfaces, and Gate GREEN/YELLOW/RED in the closeout (≤60 lines).
