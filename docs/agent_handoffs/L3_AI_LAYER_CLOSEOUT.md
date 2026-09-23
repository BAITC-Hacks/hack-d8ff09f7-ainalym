# L3 AI layer closeout — replenishment case

BEFORE → AFTER: `src/ai/provider.ts:104` supplies one typed choice interface through direct TypeSafe, Gateway fallback, OpenAI, rules, and replay; `src/ai/catalog.ts:16` validates the five proposal-only questions; `src/ai/decisions.ts:87` persists answer, full distribution, provider/model, subject versions, rubric, result state, mode, and cache key.

BEFORE → AFTER: `src/ai/interpret.ts:22` judges only borderline outlier documents and summarizes run changes; `src/ai/worker.ts:231` claims one run per inbox event, applies L2b world changes, recomputes affected SKUs, calls L2a recommendations, records proposals/decisions/failures, and drains scheduled checks (`:261`). The merged L6 change also scopes `tick(orgId)` to an organization.

BEFORE → AFTER: `src/ai/drafting.ts:72` prepares an approved-PO supplier email in RU and `:118` a run summary, checks factual consistency, and saves markdown+JSON under ignored `data/artifacts`. `src/ai/columns.ts:38` prepares source-backed category, supplier-term, and urgency columns; unsupported headers return `missing_inputs`. No semantic column writes to SKU or urgency.

Routes: `src/app/api/decisions/route.ts`, `src/app/api/columns/route.ts`, `src/app/api/drafts/route.ts`, `src/app/api/artifacts/[id]/route.ts`, `src/app/api/artifacts/[id]/download/route.ts` return typed records or artifacts; provider failure is 503 on decision/column calls. Drafts are marked «Подготовить, не отправлять».

Provider observations from live smoke: direct `jev:typesafe` → `jev-1.13.0` via `https://api.typesafe.ai/v1/systemone` (`jev-latest` request); fallback `jev:gateway` → `typesafe-ai/jev` via `https://ai-gateway.vercel.sh/v1/evaluate`; OpenAI → `gpt-5-mini-2025-08-07`; rules → `rules-v1`, «Правила без LLM». Direct response has `model,answers,usage`; Gateway also has `providerMetadata`. Live supplier draft used `gpt-5-mini-2025-08-07` and passed consistency.

Replay: `fixtures/decision_catalog.json` contains the five case questions; `fixtures/replay_decisions.json` has six recordings covering one-off/regular document, IEK category, stockout reason, run change, and prepayment terms. An unrecorded subject is `unsupported`, never a chosen default.

Guardrails: mocked 429/timeout → `provider_error`/503; direct provider error falls back to Gateway; unknown, insufficient, unsupported, and provider error remain distinct; foreign-org references are removed before model input; untrusted text remains data; image-only facts avoid a model call; short Chinese `预付` is retained; a SKU version change discards a stale answer.

Worker evidence: `tests/ai/partner_event.test.ts` processes WE-043/044/045 from partner ETL: injected 5,000-unit one-off excluded, transit +100, SE cost 360.00, each affected SKU recomputed. `tests/ai/worker_integration.test.ts` proves two pending rows → processed 2 and a second tick → 0. `tests/ai/worker_ledger.test.ts` will assert persisted run/action provider metadata and failed-row reason after L1 merges; a temporary cross-lane probe against L1's committed ledger passed that assertion.

Gate output on merged L6 state: `RUN_AI_DRAFT_LIVE=1 npm run check -- ai` → `passed=39 failed=0 skipped=1 externally-unverified=0` (only persisted L1 ledger test skipped); `npx tsc --noEmit` → exit 0; `npm run build` → exit 0. Earlier, before the ledger test was added, the live AI gate was `passed=39 failed=0 skipped=0`. Live provider smoke was 4/4.

Files changed: `src/ai/{provider,catalog,replay,decisions,interpret,worker,drafting,columns}.ts`; `tests/ai/{live_smoke,draft_live_smoke,decisions,guardrails,worker,worker_integration,worker_ledger,partner_event,drafting,columns}.test.ts`; `fixtures/{decision_catalog,replay_decisions}.json`; the five routes above; `docs/agent_handoffs/{L3_CHECKPOINT,L3_AI_LAYER_CLOSEOUT}.md`.

Dependencies added by L3: none. `npm install` was run first and rerun after L9's shared `xlsx` addition. Only additive runtime migration of `decision_record.evidence_versions`, `rubric_version`, `cache_key`, and an index; no schema file edit.

Unverified: L1's ledger implementation is not on `main` yet, so the portable persisted-trace test skips. Merge `main` when L1 lands and rerun it plus the AI gate. L6's supplier page currently shows a deterministic prepared letter; the generated AI artifact is exposed through `/api/drafts` and `/api/artifacts`, and page wiring is outside L3's allowed paths.

Protected surfaces: no UI file, `main`, history rewrite, or `tests/fixtures/eval/*` import from `src/` changed by L3. Case reframe uses RU supplier drafting and the five replenishment questions; trading-case objects were not introduced.

Gate: YELLOW

tip: 123d19e
