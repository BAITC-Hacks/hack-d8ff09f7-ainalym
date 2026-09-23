# L4b independent implementation review
Goal: independently assess src/components/{purchase,review}/ and pages /replenishment, /skus/[code], /review, /review/[id], /orders/[id] against docs/CONTRACTS.md and docs/PRODUCT.md reviewer path.
Outcome: human-visible, version-bound replenishment decisions; unknown != zero; API-only truth, request failure/409 preserves edits and does not imply success; queue/desk and chart content matches domain shapes.
Role: fresh implementation gate reviewer; gpt-6-sol xhigh (different-model R1 for Astra builder, MODEL_ROUTING_CURRENT ladder); no inherited conversation. Read oil-frontend SKILL.md first. Native short leaf task; no subagents.
Write tier: PATCH_ALLOWED only docs/agent_handoffs/L4B_INDEPENDENT_REVIEW.md (your closeout). All implementation, routes, runtime database, shell, labels, env and other paths READ ONLY. Never inspect credentials or call live providers.
Inputs: owned source, tests/ui/b_*.test.tsx; contracts; local code of API/domain. Other lanes are actively landing on main, so distinguish missing upstream contract from owned implementation defects.
Checks: npm run check -- ui; npx tsc --noEmit; source/contract tracing. Do not use browser (primary owns it). Do not change tests/source or git refs. No build while primary production server runs.
Evidence: concrete user-triggered bug, path:line, expected/actual behavior, priority; not test counts or stylistic taste. Anti-metric: passing assertions alone do not prove a decision remains accurate after a background update.
STOP: bounded report complete; report unverified integration separately. High confidence actionable findings only, no duplicate findings.
Closeout: docs/agent_handoffs/L4B_INDEPENDENT_REVIEW.md with findings, commands, inspected/unknown surfaces, Gate GREEN/YELLOW/RED. Return its path and key findings.
