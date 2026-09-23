# AI_ROUTE_1 closeout
| Call site | Class / effort |
|---|---|
| `src/ai/decisions.ts`: `one_off_order`, `supplier_fulfilment`; `src/ai/interpret.ts` and `src/ai/supplier-reply.ts` consumers | reasoning / high |
| `src/ai/decisions.ts`: `category_hint`, `urgency_override_reason`, `change_summary`, `supplier_terms_hint` | fast |
| `src/ai/drafting.ts`: supplier letter and run summary | reasoning / medium |
| `src/voice/typed.ts`: assistant intent label | fast |
Defaults: `gpt-5-mini` (formerly in `src/ai/provider.ts` and `src/ai/drafting.ts`); `gpt-4o-mini` (formerly in `src/voice/typed.ts`).
Env: `OPENAI_REASONING_MODEL`, `OPENAI_FAST_MODEL`; `OPENAI_MODEL` remains accepted but does not override class defaults. Jev keeps its existing models unless class model env names are supplied.
Evidence: `decision_record` and `agent_action` store internal `task_class` and `model_version`; `/api/modes` uses a plain Russian routing description.
Checks: keyless `npm run etl && npm run check` passed (273 pass, 0 fail, 7 live unverified); `npm run build` and `npx tsc --noEmit` passed.
Gate: GREEN for offline routing; live provider and Realtime smokes remain root-gated. Realtime voice and protected UI files untouched.
