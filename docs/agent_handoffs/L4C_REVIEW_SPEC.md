# L4c independent review — one finite pass
Venture: ainalym; role: fresh gate reviewer; lane/model: gpt-6-astra xhigh per MODEL_ROUTING_CURRENT D-1309; context: fresh spec only; independence required.
Scope: `src/components/assistant/**`, `src/components/connections/**`, `src/components/world-console/**`, their page entries, `tests/ui/c_*` in this worktree.
Goal: refute interface/state correctness against `docs/PRODUCT.md` Voice+assistant/OS flow and `docs/CONTRACTS.md` §§3–5.
Use `/Users/adil/.codex/skills/oil-frontend/SKILL.md`; inspect the scope and relevant shared dependencies read-only.
Acceptance: API-backed results, complete honest states, preserved input/scope/focus, no duplicate effect per intent, truthful labels, responsive boundary; inspect what is implemented and name any missing required surface.
Questions: (1) Can async/scope transitions misattribute or lose results? (2) Can any label imply unavailable capability works? (3) Can controls become unreachable at the required desktop/phone sizes?
Write tier: PATCH_ALLOWED only for `docs/agent_handoffs/L4C_INDEPENDENT_REVIEW.md`; all application/test files read-only.
No browser or server mutations, no database writes, no network/paid APIs, no credentials, no other lane edits, no commits.
Validation: source/contract trace and `npm run check -- ui` if useful (isolated memory DB); evidence = concrete file:line and reproducible behavior, not test count.
Closeout: findings by severity with evidence, commands run, unverified surfaces, Gate GREEN/YELLOW/RED; also state no actionable findings if appropriate.
STOP after this bounded pass. Leaf only: do not spawn agents. No model-capacity lookup needed for this short native review; parent + reviewer are the only delegated Astra seats.
