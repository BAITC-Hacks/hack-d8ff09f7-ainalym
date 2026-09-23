# POLISH-2 independent review

- Venture: ainalym. Role: independent frontend reviewer; fresh context, leaf assignment. Routing: owner-selected gpt-6-astra, xhigh; class 2 reversible visual changes. Independence required by oil-frontend for shared styles across multiple pages. Primary agent owns implementation and final acceptance.
- Write tier: READ_ONLY. No file, database, browser-state, git or external mutations. Return the review in chat; the primary agent persists it to `docs/agent_handoffs/POLISH_2_REVIEW.md`.
- Object: diff from `230b038d9c118146ff2ba9f59c7dacc394ead71e` to current HEAD on `lane/polish2`, plus screenshots and measurements under `docs/evidence/polish2` as available.
- Scope: Today, Replenishment, Orders, Suppliers, SKU list/detail, Money, World and Settings. Use oil-frontend. Inspect shared-card coverage, responsive layout, CSS specificity, semantic states, type and interaction regressions. Browser is exclusively owned by the primary agent; review saved screenshots if present.
- Acceptance: key metric/hero surfaces white/near-white, hairline borders, low shadows, semibold tabular values, muted 13 px labels and comfortable padding; secondary panels retain warm tones. No structure/copy/business-logic changes. 1440/1280/390 px fit. Existing focus and actions remain usable.
- Constraints: no assistant/voice/CartPanel/documents changes. Today/Money CSS and SKU table edits limited to card fill/border/shadow. No dependencies, secrets, absolute local paths or personal names introduced in tracked files.
- Evidence that counts: specific changed-file/line findings and rendered visual failures. Do not equate test counts or screenshot quantity with acceptance. Primary agent separately owns tsc/check/build.
- Unknowns: distinguish proven regression, existing issue and unverified viewport/state. Review the produced diff, not hypothetical redesigns.
- STOP: report before 12:15 UTC; no work after 12:25 UTC. Do not spawn agents. Return findings by severity, exact files, what was verified, uncertainties and Gate GREEN|YELLOW|RED.
